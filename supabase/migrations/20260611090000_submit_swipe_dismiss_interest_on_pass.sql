-- Handshake revamp §7.1: declining an extended hand ("Maybe later") must
-- dismiss the actor's pending incoming_interest notification from that user.
-- Previously only the 'like' branch marked it read, so a declined hand stayed
-- unread forever — a zombie entry once "Hands extended to you" is a queue.

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

  -- Declining dismisses the pending "extended a hand" notification. Runs
  -- before the duplicate-swipe early return so a repeat pass still clears it.
  if p_direction = 'pass' then
    update public.notifications
    set read_at = coalesce(read_at, now())
    where user_id = v_from_user_id
      and source_user_id = p_to_user_id
      and type = 'incoming_interest'
      and read_at is null;
  end if;

  insert into public.swipes (from_user_id, to_user_id, direction)
  values (v_from_user_id, p_to_user_id, p_direction)
  on conflict (from_user_id, to_user_id) do nothing
  returning * into v_swipe;

  if v_swipe.id is null then
    select *
    into v_swipe
    from public.swipes
    where from_user_id = v_from_user_id
      and to_user_id = p_to_user_id;

    select c.id
    into v_connection_id
    from public.connections c
    where c.status = 'connected'
      and least(c.user_a_id, c.user_b_id) = least(v_from_user_id, p_to_user_id)
      and greatest(c.user_a_id, c.user_b_id) = greatest(v_from_user_id, p_to_user_id)
    limit 1;

    swipe_id := v_swipe.id;
    is_match := v_connection_id is not null;
    connection_id := v_connection_id;
    notification_id := null;
    return next;
    return;
  end if;

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
