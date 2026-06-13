-- "My algorithm" — account deletion (zap-discover-algorithm-spec.md §8,
-- migration 4). user_interests and discovery_settings rows would cascade via
-- their auth.users FKs, but the function's explicit-delete style stays
-- consistent so nothing depends on auth-user deletion ordering.
--
-- NOTE: create or replace preserves the existing ACL — execute stays with
-- service_role only (20260611100000 hardening); no grant is re-added here.
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

  -- Discover algorithm data (interest selections + locality tuning).
  delete from user_interests where user_id = uid;
  delete from discovery_settings where user_id = uid;

  -- Uploaded profile photos (objects live under <user_id>/..., the same path
  -- convention the bucket RLS policies enforce).
  delete from storage.objects
  where bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = uid::text;

  -- Finally delete profile row.
  delete from profiles where user_id = uid;
end;
$$;
