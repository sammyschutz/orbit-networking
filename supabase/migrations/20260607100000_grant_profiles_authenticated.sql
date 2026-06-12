-- Grant the authenticated role permissions needed for all app tables
-- This is required when row-level security is enabled and the authenticated
-- user must insert/update/select rows via client requests.

grant select, insert, update on public.profiles, public.swipes, public.connections, public.notifications, public.interests to authenticated;
