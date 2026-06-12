-- Account deletion lifecycle for messaging (spec §9/§12-H).
-- Extends delete_user_and_relations to remove the user's messaging data, and
-- ANONYMIZES (does not delete) their message_audit_log rows so abuse-pattern
-- history survives a self-deletion and a banned actor can't erase their trail.

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

  -- Finally delete profile row.
  delete from profiles where user_id = uid;
end;
$$;

grant execute on function delete_user_and_relations(uuid) to authenticated;
