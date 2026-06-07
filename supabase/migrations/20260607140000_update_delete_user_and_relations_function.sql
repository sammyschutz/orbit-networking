-- Migration: Update delete_user_and_relations RPC to match actual schema
-- This is a new migration file. Existing migrations are left unchanged.

create or replace function delete_user_and_relations(uid uuid) returns void
language plpgsql security definer
as $$
begin
  -- Delete dependent rows from app-specific tables using actual schema columns.
  delete from swipes where from_user_id = uid or to_user_id = uid;
  delete from connections where user_a_id = uid or user_b_id = uid;
  delete from notifications where user_id = uid or source_user_id = uid;

  -- Finally delete profile row.
  delete from profiles where user_id = uid;
end;
$$;

-- Grant execute to authenticated remains the same as before.
grant execute on function delete_user_and_relations(uuid) to authenticated;
