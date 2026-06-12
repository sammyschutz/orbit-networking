-- Review fixes (2026-06-10 security/quality pass):
-- 1. Distinct audit decisions for safety ACTIONS (block/unblock/report) so they
--    are no longer conflated with message-send verdicts in message_audit_log.
-- 2. delete_user_and_relations also removes the user's profile photos from
--    storage (path convention: <user_id>/<basename>, same as the bucket RLS).
-- 3. Partial index supporting the nightly raw_excerpt purge cron.

-- --- 1. extend the decision taxonomy -----------------------------------------
-- The check constraint was created inline, so its name is auto-generated; find
-- and drop whichever check constraint mentions `decision`, then re-add named.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.message_audit_log'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%decision%'
  loop
    execute format('alter table public.message_audit_log drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.message_audit_log
  add constraint message_audit_log_decision_check check (
    decision in (
      -- send-attempt verdicts (one row per send attempt, spec §4.5)
      'allowed', 'blocked_content', 'blocked_rate', 'blocked_relationship',
      -- safety actions taken by a user (block-user / unblock-user / report-user)
      'action_block', 'action_unblock', 'action_report'
    )
  );

-- --- 2. clean up storage objects on account deletion -------------------------
create or replace function delete_user_and_relations(uid uuid) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  -- Messaging data owned by / addressed to the user.
  -- Conversations cascade-delete their messages; also clear messages where the
  -- user is sender/recipient in any surviving conversation, to be safe.
  delete from messages where sender_id = uid or recipient_id = uid;
  delete from conversations where user_a_id = uid or user_b_id = uid;
  delete from blocks where blocker_id = uid or blocked_id = uid;
  delete from reports where reporter_id = uid or reported_id = uid;

  -- Anonymize audit trail rather than delete it (retain for compliance).
  -- Replace the actor id with a stable hash so patterns survive without PII.
  update message_audit_log
  set actor_id = null,
      raw_excerpt = null,
      filter_verdicts = filter_verdicts
        || jsonb_build_object('actor_anonymized', md5(uid::text))
  where actor_id = uid;

  -- Existing app tables.
  delete from swipes where from_user_id = uid or to_user_id = uid;
  delete from connections where user_a_id = uid or user_b_id = uid;
  delete from notifications where user_id = uid or source_user_id = uid;

  -- Uploaded profile photos (objects live under <user_id>/..., the same path
  -- convention the bucket RLS policies enforce).
  delete from storage.objects
  where bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = uid::text;

  -- Finally delete profile row.
  delete from profiles where user_id = uid;
end;
$$;

grant execute on function delete_user_and_relations(uuid) to authenticated;

-- --- 3. index for the nightly excerpt purge ----------------------------------
-- The cron deletes raw excerpts older than 90 days; as the log grows the
-- partial index keeps that scan from touching already-purged rows.
create index if not exists idx_message_audit_log_purge
  on public.message_audit_log (created_at)
  where raw_excerpt is not null;
