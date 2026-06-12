-- Safe messaging: Row-Level Security (spec §5)
-- Mirrors the existing "select-own, no-client-write" model. All writes flow
-- through Edge Functions (service role), never directly from clients.

-- Helper: is there an active block between two users (either direction)?
-- Used by message/conversation SELECT policies and the connections feed so a
-- blocked relationship disappears without severing the connections row (§12-D).
create or replace function public.has_active_block(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blocks b
    where (b.blocker_id = p_user_a and b.blocked_id = p_user_b)
       or (b.blocker_id = p_user_b and b.blocked_id = p_user_a)
  );
$$;

-- --------------------------------------------------
-- RLS: conversations
-- --------------------------------------------------
create policy conversations_select on conversations
  for select
  using (
    (auth.uid() = user_a_id or auth.uid() = user_b_id)
    and not public.has_active_block(user_a_id, user_b_id)
  );

create policy conversations_insert_no_client on conversations
  for insert
  with check (false);

create policy conversations_update_no_client on conversations
  for update
  with check (false);

-- --------------------------------------------------
-- RLS: messages
-- --------------------------------------------------
create policy messages_select on messages
  for select
  using (
    (auth.uid() = sender_id or auth.uid() = recipient_id)
    and deleted_at is null
    and not public.has_active_block(sender_id, recipient_id)
  );

create policy messages_insert_no_client on messages
  for insert
  with check (false);

create policy messages_update_no_client on messages
  for update
  with check (false);

create policy messages_delete_no_client on messages
  for delete
  using (false);

-- --------------------------------------------------
-- RLS: blocks  (read your own block list; writes via Edge Function)
-- --------------------------------------------------
create policy blocks_select_own on blocks
  for select
  using (auth.uid() = blocker_id);

create policy blocks_insert_no_client on blocks
  for insert
  with check (false);

create policy blocks_delete_no_client on blocks
  for delete
  using (false);

-- --------------------------------------------------
-- RLS: reports  (read your own; writes via Edge Function)
-- --------------------------------------------------
create policy reports_select_own on reports
  for select
  using (auth.uid() = reporter_id);

create policy reports_insert_no_client on reports
  for insert
  with check (false);

create policy reports_update_no_client on reports
  for update
  with check (false);

-- --------------------------------------------------
-- RLS: message_audit_log  (no client access at all; service role only)
-- RLS is enabled with zero policies => authenticated/anon get nothing.
-- --------------------------------------------------

-- --------------------------------------------------
-- Update connections feed to exclude active blocks (§12-D).
-- Blocked users vanish from the feed without severing the connections row.
-- --------------------------------------------------
drop policy if exists connections_select on connections;
create policy connections_select on connections
  for select
  using (
    (auth.uid() = user_a_id or auth.uid() = user_b_id)
    and not public.has_active_block(user_a_id, user_b_id)
  );

-- --------------------------------------------------
-- Realtime: deliver new messages to RLS-permitted recipients.
-- --------------------------------------------------
alter publication supabase_realtime add table messages;
