-- Cleanup of pre-messaging-era grants flagged by the Supabase advisors.

-- 1) delete_user_and_relations is SECURITY DEFINER, takes an arbitrary uid,
--    and has no internal caller check — yet PostgREST exposed it to anon and
--    authenticated, letting anyone with the anon key wipe any user's data.
--    Its only legitimate caller is the delete-account Edge Function, which
--    uses the service role.
revoke execute on function public.delete_user_and_relations(uuid)
  from public, anon, authenticated;
grant execute on function public.delete_user_and_relations(uuid)
  to service_role;

-- 2) interests is a future-feature lookup table that shipped with RLS
--    disabled while authenticated held insert/update on it. Read-only for
--    clients until the interests feature defines real write paths.
alter table public.interests enable row level security;

drop policy if exists interests_select_authenticated on public.interests;
create policy interests_select_authenticated
  on public.interests for select
  to authenticated
  using (true);

revoke insert, update on public.interests from authenticated;

-- 3) Pin the trigger helper's search_path (advisor: mutable search_path).
alter function public.set_updated_at() set search_path = public;
