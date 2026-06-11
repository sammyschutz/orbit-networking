// block-user (spec §8.3, §12-D). Inserts the block row over a direct Postgres
// connection (trusted server, bypassing RLS) and writes an audit entry.
// Side-effects (chat hidden, user removed from the connections feed) are
// enforced automatically by RLS via has_active_block — the underlying
// connections row is NOT severed, so unblocking fully restores the relationship.
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_PUBLIC_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const DB_URL = Deno.env.get("SUPABASE_DB_URL")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await createClient(
    SUPABASE_URL!,
    ANON_KEY,
  ).auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
  const blockerId = userData.user.id;

  let payload: { blocked_id?: string; reason?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const blockedId = payload.blocked_id;
  if (!blockedId) return json({ error: "blocked_id is required" }, 400);
  if (blockedId === blockerId) return json({ error: "Cannot block yourself" }, 400);

  // deno-lint-ignore no-explicit-any
  const sql: any = postgres(DB_URL, { prepare: false });
  try {
    await sql`
      insert into blocks (blocker_id, blocked_id, reason)
      values (${blockerId}, ${blockedId}, ${payload.reason ?? null})
      on conflict (blocker_id, blocked_id) do update set reason = excluded.reason`;

    await sql`
      insert into message_audit_log (actor_id, decision, filter_verdicts, rate_state)
      values (${blockerId}, 'action_block',
              ${JSON.stringify({ action: "block", blocked_id: blockedId })}::jsonb, '{}'::jsonb)`;

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("block-user error", err);
    return json({ error: (err as Error).message || String(err) }, 500);
  } finally {
    await sql.end();
  }
});
