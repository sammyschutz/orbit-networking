-- Migration: Create helper RPC to delete a user and their related rows
-- This function performs deletes inside a transaction. It should be
-- executed by a trusted server (service_role) or via an Edge Function.

create or replace function delete_user_and_relations(uid uuid) returns void
language plpgsql security definer
as $$
begin
  -- Delete dependent rows from app-specific tables. Add or remove tables
  -- here to match your schema. Use explicit deletes to make behavior clear.
  -- If you prefer referential integrity, consider adding FK constraints
  -- with ON DELETE CASCADE instead and simplify this function.

  delete from connections where user_id = uid or other_user_id = uid;
  delete from candidates where user_id = uid;
  delete from notifications where user_id = uid;
  delete from messages where sender_id = uid or receiver_id = uid;
  delete from sessions where user_id = uid;

  -- Finally delete profile row
  delete from profiles where user_id = uid;
end;
$$;

-- Grant execution to the authenticated role if you want clients to be able
-- to call this via a RLS policy, but in general this should be invoked by
-- a server process holding the service_role key.
grant execute on function delete_user_and_relations(uuid) to authenticated;
