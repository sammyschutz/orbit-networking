// unblock-user (spec §8.3). Removes the block row over a direct Postgres
// connection (trusted server) and writes an audit entry. Reverses block-user:
// the chat and connections-feed entry (only hidden, never severed) are restored.
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

  let payload: { blocked_id?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const blockedId = payload.blocked_id;
  if (!blockedId) return json({ error: "blocked_id is required" }, 400);

  // deno-lint-ignore no-explicit-any
  const sql: any = postgres(DB_URL, { prepare: false });
  try {
    await sql`
      delete from blocks where blocker_id = ${blockerId} and blocked_id = ${blockedId}`;

    await sql`
      insert into message_audit_log (actor_id, decision, filter_verdicts, rate_state)
      values (${blockerId}, 'allowed',
              ${JSON.stringify({ action: "unblock", blocked_id: blockedId })}::jsonb, '{}'::jsonb)`;

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("unblock-user error", err);
    return json({ error: (err as Error).message || String(err) }, 500);
  } finally {
    await sql.end();
  }
});
