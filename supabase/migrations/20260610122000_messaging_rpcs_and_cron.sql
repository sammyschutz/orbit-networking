-- Safe messaging: neutral remove-connection RPC, recency-aware swipes,
-- and the 90-day audit-excerpt purge (spec §8.5, §13, §9/§12-G).

-- --------------------------------------------------
-- remove_connection(p_connection_id) — neutral "unmatch" (§13).
-- Distinct from block: severs the connection, deletes the conversation +
-- messages, and writes a dated `pass` for BOTH directions so neither user
-- resurfaces for the other for 6 months (enforced by the recency-aware deck).
-- Safety audit rows in message_audit_log are intentionally untouched.
-- --------------------------------------------------
create or replace function public.remove_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_conn public.connections%rowtype;
  v_other uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_conn from public.connections where id = p_connection_id;
  if v_conn.id is null then
    raise exception 'Connection not found' using errcode = '22023';
  end if;

  if v_uid <> v_conn.user_a_id and v_uid <> v_conn.user_b_id then
    raise exception 'Not a participant in this connection' using errcode = '42501';
  end if;

  v_other := case when v_uid = v_conn.user_a_id then v_conn.user_b_id
                  else v_conn.user_a_id end;

  -- Delete the conversation + its messages (FK cascade also covers this when
  -- the connection is removed, but be explicit and order-independent).
  delete from public.conversations where connection_id = p_connection_id;

  -- Sever the connection for both parties.
  delete from public.connections where id = p_connection_id;

  -- Clear any match / interest notifications between the pair (would dangle).
  delete from public.notifications
  where type in ('match','incoming_interest')
    and (
      (user_id = v_uid and source_user_id = v_other)
      or (user_id = v_other and source_user_id = v_uid)
    );

  -- Refresh both swipe directions to a dated pass => symmetric 6-month cooldown.
  insert into public.swipes (from_user_id, to_user_id, direction)
  values (v_uid, v_other, 'pass')
  on conflict (from_user_id, to_user_id)
  do update set direction = 'pass', created_at = now();

  insert into public.swipes (from_user_id, to_user_id, direction)
  values (v_other, v_uid, 'pass')
  on conflict (from_user_id, to_user_id)
  do update set direction = 'pass', created_at = now();
end;
$$;

revoke execute on function public.remove_connection(uuid) from public;
grant execute on function public.remove_connection(uuid) to authenticated;

-- --------------------------------------------------
-- submit_swipe: make the swipe insert an upsert that refreshes the timestamp
-- so a pass expires after 6 months and a re-swipe restarts the clock (§13.3).
-- Guard: if a live connection already exists, the re-swipe is a no-op on the
-- relationship. Otherwise upsert (refresh direction + created_at) and run the
-- normal match/notification logic — preserved verbatim from the prior version.
-- --------------------------------------------------
create or replace function public.submit_swipe(
  p_to_user_id uuid,
  p_direction text
)
returns table (
  swipe_id uuid,
  is_match boolean,
  connection_id uuid,
  notification_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_user_id uuid := (select auth.uid());
  v_swipe public.swipes%rowtype;
  v_connection_id uuid;
  v_notification_id uuid;
begin
  if v_from_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_to_user_id is null then
    raise exception 'Target user is required' using errcode = '22023';
  end if;

  if p_direction not in ('like', 'pass') then
    raise exception 'Swipe direction must be like or pass' using errcode = '22023';
  end if;

  if p_to_user_id = v_from_user_id then
    raise exception 'Users cannot swipe on themselves' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles
    where user_id = p_to_user_id
      and is_complete = true
  ) then
    raise exception 'Target profile is not available' using errcode = '22023';
  end if;

  -- Guard: a live connection already exists -> re-swipe is a no-op (don't let a
  -- re-swipe silently alter an active matched relationship).
  select c.id
  into v_connection_id
  from public.connections c
  where c.status = 'connected'
    and least(c.user_a_id, c.user_b_id) = least(v_from_user_id, p_to_user_id)
    and greatest(c.user_a_id, c.user_b_id) = greatest(v_from_user_id, p_to_user_id)
  limit 1;

  if v_connection_id is not null then
    select *
    into v_swipe
    from public.swipes
    where from_user_id = v_from_user_id
      and to_user_id = p_to_user_id;

    swipe_id := v_swipe.id;
    is_match := true;
    connection_id := v_connection_id;
    notification_id := null;
    return next;
    return;
  end if;

  -- No live connection: upsert the swipe, refreshing direction + timestamp so
  -- the 6-month pass cooldown clock restarts on every swipe.
  insert into public.swipes (from_user_id, to_user_id, direction)
  values (v_from_user_id, p_to_user_id, p_direction)
  on conflict (from_user_id, to_user_id)
  do update set direction = excluded.direction, created_at = now()
  returning * into v_swipe;

  swipe_id := v_swipe.id;
  is_match := false;
  connection_id := null;
  notification_id := null;

  if p_direction = 'like' then
    if exists (
      select 1
      from public.swipes
      where from_user_id = p_to_user_id
        and to_user_id = v_from_user_id
        and direction = 'like'
    ) then
      insert into public.connections (user_a_id, user_b_id, status)
      values (
        least(v_from_user_id, p_to_user_id),
        greatest(v_from_user_id, p_to_user_id),
        'connected'
      )
      on conflict do nothing
      returning id into v_connection_id;

      if v_connection_id is null then
        select c.id
        into v_connection_id
        from public.connections c
        where least(c.user_a_id, c.user_b_id) = least(v_from_user_id, p_to_user_id)
          and greatest(c.user_a_id, c.user_b_id) = greatest(v_from_user_id, p_to_user_id)
        limit 1;
      end if;

      update public.notifications
      set read_at = coalesce(read_at, now())
      where user_id = v_from_user_id
        and source_user_id = p_to_user_id
        and type = 'incoming_interest'
        and read_at is null;

      with inserted as (
        insert into public.notifications (user_id, type, source_user_id, payload)
        values (
          v_from_user_id,
          'match',
          p_to_user_id,
          jsonb_build_object('connection_id', v_connection_id)
        )
        on conflict do nothing
        returning id
      )
      select id
      into v_notification_id
      from (
        select id from inserted
        union all
        select id
        from public.notifications
        where user_id = v_from_user_id
          and source_user_id = p_to_user_id
          and type = 'match'
      ) n
      limit 1;

      insert into public.notifications (user_id, type, source_user_id, payload)
      values (
        p_to_user_id,
        'match',
        v_from_user_id,
        jsonb_build_object('connection_id', v_connection_id)
      )
      on conflict do nothing;

      is_match := true;
      connection_id := v_connection_id;
      notification_id := v_notification_id;
    else
      with inserted as (
        insert into public.notifications (user_id, type, source_user_id)
        values (p_to_user_id, 'incoming_interest', v_from_user_id)
        on conflict do nothing
        returning id
      )
      select id
      into v_notification_id
      from (
        select id from inserted
        union all
        select id
        from public.notifications
        where user_id = p_to_user_id
          and source_user_id = v_from_user_id
          and type = 'incoming_interest'
          and read_at is null
      ) n
      limit 1;

      notification_id := v_notification_id;
    end if;
  end if;

  return next;
end;
$$;

revoke execute on function public.submit_swipe(uuid, text) from public;
grant execute on function public.submit_swipe(uuid, text) to authenticated;

-- --------------------------------------------------
-- Audit-excerpt retention: purge raw_excerpt after 90 days (§9/§12-G).
-- Decision metadata (verdicts, scores, decision type) is retained.
-- --------------------------------------------------
create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'purge-audit-excerpts') then
    perform cron.schedule(
      'purge-audit-excerpts',
      '0 3 * * *',
      $job$
        update public.message_audit_log
        set raw_excerpt = null
        where raw_excerpt is not null
          and created_at < now() - interval '90 days';
      $job$
    );
  end if;
end
$$;
