-- Grant the authenticated role SELECT on the client-readable messaging tables.
-- This project does not rely on Supabase default privileges (see
-- 20260607100000_grant_profiles_authenticated.sql); table grants are explicit.
--
-- Clients read these tables directly under RLS (select-own model); all writes
-- flow through Edge Functions using the service role, so no INSERT/UPDATE/DELETE
-- grants are given here. message_audit_log is intentionally omitted — it has no
-- client access at all (service role only).

grant select on public.conversations, public.messages, public.blocks, public.reports to authenticated;
