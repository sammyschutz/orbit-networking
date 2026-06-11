-- Tighten has_active_block(): it's a SECURITY DEFINER helper used by the
-- messages / conversations / connections SELECT policies. Those policies only
-- ever evaluate for signed-in users, so anon never needs to call it. Revoking
-- the default public EXECUTE removes a minor block-relationship info leak via
-- /rest/v1/rpc/has_active_block while keeping RLS working for authenticated.
revoke execute on function public.has_active_block(uuid, uuid) from public;
grant execute on function public.has_active_block(uuid, uuid) to authenticated;
