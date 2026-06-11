// send-message — the safety gateway (spec §3, §8.1).
//
// Sends go client -> Edge Function -> DB. The client can NEVER insert into
// `messages` directly (RLS `with check (false)`). This function is the only
// writer: it validates the caller's JWT, runs the safety pipeline, then writes
// over a direct Postgres connection (the trusted server, bypassing RLS).
// Pipeline: authn -> validate connection is 'connected' -> block check ->
// rate limit -> content safety -> (tx: create conversation + insert message +
// update meta + audit) -> respond. Rejected attempts still write one audit row.
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";
import { evaluateContent } from "../_shared/safety/denylist.ts";
import { evaluateAbuse } from "../_shared/safety/abuse.ts";
import { checkRateLimits, type Sql } from "../_shared/safety/rateLimit.ts";
import { toExcerpt, writeAudit } from "../_shared/safety/audit.ts";
import { MAX_MESSAGE_LENGTH, RATE_LIMITS } from "../_shared/safety/constants.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_PUBLIC_URL");
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

const PREVIEW_MAX = 80;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // --- 1. authn (validate the caller's JWT via the auth endpoint) ---
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
  const token = authHeader.replace("Bearer ", "");
  const authClient = createClient(SUPABASE_URL!, ANON_KEY);
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
  const senderId = userData.user.id;

  // --- 2. parse + validate input ---
  let payload: { conversation_id?: string; recipient_id?: string; body?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const body = (payload.body ?? "").trim();
  if (!body) return json({ error: "Message body is required" }, 400);
  if (body.length > MAX_MESSAGE_LENGTH) {
    return json({ error: `Message exceeds ${MAX_MESSAGE_LENGTH} characters` }, 400);
  }
  if (!payload.conversation_id && !payload.recipient_id) {
    return json({ error: "conversation_id or recipient_id is required" }, 400);
  }

  // deno-lint-ignore no-explicit-any
  const sql: any = postgres(DB_URL, { prepare: false });
  const sqlForSafety = sql as Sql;
  try {
    // --- 3. resolve connection + recipient ---
    let recipientId: string;
    let connectionId: string | null = null;

    if (payload.conversation_id) {
      const [conv] = await sql`
        select id, connection_id, user_a_id, user_b_id
        from conversations where id = ${payload.conversation_id}`;
      if (!conv) return json({ error: "Conversation not found" }, 404);
      if (conv.user_a_id !== senderId && conv.user_b_id !== senderId) {
        return json({ error: "Not a participant" }, 403);
      }
      recipientId = conv.user_a_id === senderId ? conv.user_b_id : conv.user_a_id;
      connectionId = conv.connection_id;
    } else {
      recipientId = payload.recipient_id!;
      if (recipientId === senderId) return json({ error: "Cannot message yourself" }, 400);
    }

    const [conn] = connectionId
      ? await sql`select id, status, created_at from connections where id = ${connectionId}`
      : await sql`
          select id, status, created_at from connections
          where (user_a_id = ${senderId} and user_b_id = ${recipientId})
             or (user_a_id = ${recipientId} and user_b_id = ${senderId})
          limit 1`;

    if (!conn || conn.status !== "connected") {
      await writeAudit(sqlForSafety, {
        actor_id: senderId,
        conversation_id: null,
        message_id: null,
        decision: "blocked_relationship",
        filter_verdicts: { reason: "not_connected" },
        rate_state: {},
        raw_excerpt: toExcerpt(body),
      });
      return json({ error: "You can only message established connections" }, 403);
    }
    connectionId = conn.id as string;
    const connectionCreatedAt = conn.created_at as string;

    // --- 4. block check (either direction) ---
    const blockRows = await sql`
      select 1 from blocks
      where (blocker_id = ${senderId} and blocked_id = ${recipientId})
         or (blocker_id = ${recipientId} and blocked_id = ${senderId})
      limit 1`;
    if (blockRows.length > 0) {
      await writeAudit(sqlForSafety, {
        actor_id: senderId,
        conversation_id: null,
        message_id: null,
        decision: "blocked_relationship",
        filter_verdicts: { reason: "block" },
        rate_state: {},
        raw_excerpt: toExcerpt(body),
      });
      // Generic message — never leak that a block exists.
      return json({ error: "You can't message this user" }, 403);
    }

    // Existing conversation (may be null on the very first message).
    const [existingConv] = await sql`
      select id from conversations where connection_id = ${connectionId}`;
    const conversationId: string | null = existingConv?.id ?? null;

    // Recent sender bodies in this conversation (for duplicate + abuse checks).
    let recentBodies: string[] = [];
    if (conversationId) {
      const recent = await sql`
        select body from messages
        where conversation_id = ${conversationId} and sender_id = ${senderId}
          and created_at >= now() - (${RATE_LIMITS.duplicateWindowSec} * interval '1 second')
        order by created_at desc limit 20`;
      recentBodies = recent.map((r: { body: string }) => r.body);
    }

    // --- 5. rate limit ---
    const rate = await checkRateLimits(
      sqlForSafety,
      { senderId, recipientId, conversationId, connectionCreatedAt },
      recentBodies,
      body,
    );
    if (!rate.allowed) {
      await writeAudit(sqlForSafety, {
        actor_id: senderId,
        conversation_id: conversationId,
        message_id: null,
        decision: "blocked_rate",
        filter_verdicts: { reason: rate.reason },
        rate_state: rate.state,
        raw_excerpt: toExcerpt(body),
      });
      return json(
        { error: "Slow down — too many messages", reason: rate.reason, retry_after: rate.retryAfter },
        429,
      );
    }

    // --- 6. content safety (denylist + abuse heuristics) ---
    const content = evaluateContent(body);
    const abuse = evaluateAbuse(body, recentBodies);
    if (content.decision === "block" || abuse.block) {
      const categories = [...new Set([...content.categories, ...abuse.categories])];
      await writeAudit(sqlForSafety, {
        actor_id: senderId,
        conversation_id: conversationId,
        message_id: null,
        decision: "blocked_content",
        filter_verdicts: {
          profanity: content.matchedTerms,
          categories,
          denylist_version: content.denylistVersion,
          abuse_score: abuse.score,
          abuse_flags: abuse.flags,
          provider: "deterministic",
        },
        rate_state: rate.state,
        raw_excerpt: toExcerpt(body),
      });
      return json({ reason: "content", categories }, 422);
    }

    // --- 7. passed: create conversation if needed, insert message + meta +
    //         audit, atomically in one transaction ---
    const userA = senderId < recipientId ? senderId : recipientId;
    const userB = senderId < recipientId ? recipientId : senderId;
    const auditVerdicts = JSON.stringify({
      categories: [],
      denylist_version: content.denylistVersion,
      abuse_score: abuse.score,
      provider: "deterministic",
    });
    const rateStateJson = JSON.stringify(rate.state);
    const excerpt = toExcerpt(body);
    const preview = body.slice(0, PREVIEW_MAX);

    // deno-lint-ignore no-explicit-any
    const message = await sql.begin(async (tx: any) => {
      let convId = conversationId;
      if (!convId) {
        const [c] = await tx`
          insert into conversations (connection_id, user_a_id, user_b_id)
          values (${connectionId}, ${userA}, ${userB})
          on conflict (connection_id) do update set updated_at = now()
          returning id`;
        convId = c.id;
      }

      const [msg] = await tx`
        insert into messages (conversation_id, sender_id, recipient_id, body)
        values (${convId}, ${senderId}, ${recipientId}, ${body})
        returning *`;

      // Advance the sender's own read pointer with their message so it never
      // shows as unread to them; the recipient's pointer is left untouched so
      // the new message surfaces as unread on their side.
      await tx`
        update conversations
        set last_message_at = ${msg.created_at},
            last_message_preview = ${preview},
            user_a_last_read_at = case when user_a_id = ${senderId}
              then ${msg.created_at} else user_a_last_read_at end,
            user_b_last_read_at = case when user_b_id = ${senderId}
              then ${msg.created_at} else user_b_last_read_at end
        where id = ${convId}`;

      await tx`
        insert into message_audit_log
          (actor_id, conversation_id, message_id, decision, filter_verdicts, rate_state, raw_excerpt)
        values (${senderId}, ${convId}, ${msg.id}, 'allowed',
                ${auditVerdicts}::jsonb, ${rateStateJson}::jsonb, ${excerpt})`;

      return msg;
    });

    return json({ message }, 200);
  } catch (err) {
    console.error("send-message error", err);
    return json({ error: (err as Error).message || String(err) }, 500);
  } finally {
    await sql.end();
  }
});
