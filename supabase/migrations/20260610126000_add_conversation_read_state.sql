-- Safe messaging: per-participant read/unread state.
-- Each conversation is 1:1, so we track a read pointer per side directly on the
-- conversations row. A conversation is "unread" for a participant when
-- last_message_at is newer than that participant's last_read_at (or the pointer
-- is null). Writes go through SECURITY DEFINER RPCs since clients have no
-- UPDATE grant on conversations (all conversation writes are server-side).

-- --------------------------------------------------
-- Columns: one read pointer per participant.
-- --------------------------------------------------
alter table conversations
  add column if not exists user_a_last_read_at timestamptz null,
  add column if not exists user_b_last_read_at timestamptz null;

-- Treat all existing history as read so deploying this doesn't flood every
-- thread with a false unread badge.
update conversations
set user_a_last_read_at = coalesce(user_a_last_read_at, last_message_at),
    user_b_last_read_at = coalesce(user_b_last_read_at, last_message_at)
where last_message_at is not null;

-- --------------------------------------------------
-- mark_conversation_read(p_conversation_id) — advance my pointer to the latest
-- message (or now() if the thread is empty).
-- --------------------------------------------------
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_conv public.conversations%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_conv from public.conversations where id = p_conversation_id;
  if v_conv.id is null then
    raise exception 'Conversation not found' using errcode = '22023';
  end if;

  if v_uid <> v_conv.user_a_id and v_uid <> v_conv.user_b_id then
    raise exception 'Not a participant in this conversation' using errcode = '42501';
  end if;

  update public.conversations
  set user_a_last_read_at = case when user_a_id = v_uid
        then coalesce(last_message_at, now()) else user_a_last_read_at end,
      user_b_last_read_at = case when user_b_id = v_uid
        then coalesce(last_message_at, now()) else user_b_last_read_at end
  where id = p_conversation_id;
end;
$$;

-- --------------------------------------------------
-- mark_conversation_unread(p_conversation_id) — clear my pointer so the thread
-- shows as unread again.
-- --------------------------------------------------
create or replace function public.mark_conversation_unread(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_conv public.conversations%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_conv from public.conversations where id = p_conversation_id;
  if v_conv.id is null then
    raise exception 'Conversation not found' using errcode = '22023';
  end if;

  if v_uid <> v_conv.user_a_id and v_uid <> v_conv.user_b_id then
    raise exception 'Not a participant in this conversation' using errcode = '42501';
  end if;

  update public.conversations
  set user_a_last_read_at = case when user_a_id = v_uid then null else user_a_last_read_at end,
      user_b_last_read_at = case when user_b_id = v_uid then null else user_b_last_read_at end
  where id = p_conversation_id;
end;
$$;

revoke execute on function public.mark_conversation_read(uuid) from public;
revoke execute on function public.mark_conversation_unread(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.mark_conversation_unread(uuid) to authenticated;
