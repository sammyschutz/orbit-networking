-- Table-level grants for the discover-algorithm tables. RLS policies gate
-- rows but don't confer privileges, and tables in this project don't receive
-- default grants (same lesson as 20260610125000_grant_messaging_authenticated).
-- Caught by smoke-testing get_discover_candidates as a demo user.
grant select on public.cities to authenticated;
grant select, insert, delete on public.user_interests to authenticated;
grant select, insert, update on public.discovery_settings to authenticated;
