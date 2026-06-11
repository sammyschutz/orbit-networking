// report-user (spec §8.2). Creates a `reports` row over a direct Postgres
// connection (trusted server) and writes an audit entry. Centralized here so
// reporting side-effects (auto-thresholds, notifying moderation) stay
// server-side. MVP reviews reports via SQL/dashboard.
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_PUBLIC_URL");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const DB_URL = Deno.env.get("SUPABASE_DB_URL")!;

const CATEGORIES = ["harassment", "spam", "hate", "sexual", "threat", "other"];

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
  const reporterId = userData.user.id;

  let payload: {
    reported_id?: string;
    conversation_id?: string;
    message_id?: string;
    category?: string;
    details?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { reported_id, category } = payload;
  if (!reported_id) return json({ error: "reported_id is required" }, 400);
  if (reported_id === reporterId) return json({ error: "Cannot report yourself" }, 400);
  if (!category || !CATEGORIES.includes(category)) {
    return json({ error: `category must be one of ${CATEGORIES.join(", ")}` }, 400);
  }

  // deno-lint-ignore no-explicit-any
  const sql: any = postgres(DB_URL, { prepare: false });
  try {
    const [report] = await sql`
      insert into reports (reporter_id, reported_id, conversation_id, message_id, category, details)
      values (${reporterId}, ${reported_id}, ${payload.conversation_id ?? null},
              ${payload.message_id ?? null}, ${category}, ${payload.details ?? null})
      returning id`;

    await sql`
      insert into message_audit_log (actor_id, conversation_id, message_id, decision, filter_verdicts, rate_state)
      values (${reporterId}, ${payload.conversation_id ?? null}, ${payload.message_id ?? null}, 'allowed',
              ${JSON.stringify({ action: "report", reported_id, category, report_id: report.id })}::jsonb, '{}'::jsonb)`;

    return json({ ok: true, report_id: report.id }, 200);
  } catch (err) {
    console.error("report-user error", err);
    return json({ error: (err as Error).message || String(err) }, 500);
  } finally {
    await sql.end();
  }
});
