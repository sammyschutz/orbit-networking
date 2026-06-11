// Sliding-window rate limiting (spec §7). Counts are queried against the
// messages table over a direct Postgres connection (postgres.js) — the function
// is the trusted server, so it bypasses RLS. Enforced server-side only; the
// client may show a friendly cooldown but never enforces it.

import { normalize } from "./normalize.ts";
import { RATE_LIMITS } from "./constants.ts";

// postgres.js tagged-template client (callable). Kept minimal so this module
// stays driver-light and the pure logic remains unit-testable.
export type Sql = <T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...args: unknown[]
) => Promise<T[]>;

export interface RateContext {
  senderId: string;
  recipientId: string;
  conversationId: string | null;
  connectionCreatedAt: string; // ISO timestamp of the connection row
}

export type RateReason = "global" | "conversation" | "duplicate" | "new_connection";

export interface RateResult {
  allowed: boolean;
  reason?: RateReason;
  retryAfter?: number; // seconds
  state: Record<string, unknown>;
}

async function count(sql: Sql, query: Promise<{ n: number }[]>): Promise<number> {
  const rows = await query;
  return rows[0]?.n ?? 0;
}

/**
 * Evaluate all rate-limit windows for a pending send.
 * @param recentBodies the sender's recently-stored bodies in this conversation
 *                     (within the duplicate window), for duplicate detection.
 */
export async function checkRateLimits(
  sql: Sql,
  ctx: RateContext,
  recentBodies: string[],
  rawBody: string,
): Promise<RateResult> {
  const state: Record<string, unknown> = {};

  // 1. Global anti-flood (per sender, all conversations).
  const globalCount = await count(
    sql,
    sql<{ n: number }>`
      select count(*)::int as n from messages
      where sender_id = ${ctx.senderId}
        and created_at >= now() - (${RATE_LIMITS.globalWindowSec} * interval '1 second')`,
  );
  state.global = { count: globalCount, max: RATE_LIMITS.globalMax };
  if (globalCount >= RATE_LIMITS.globalMax) {
    return { allowed: false, reason: "global", retryAfter: RATE_LIMITS.globalWindowSec, state };
  }

  // 2. Per-conversation throttle (only meaningful once a conversation exists).
  if (ctx.conversationId) {
    const convCount = await count(
      sql,
      sql<{ n: number }>`
        select count(*)::int as n from messages
        where sender_id = ${ctx.senderId}
          and conversation_id = ${ctx.conversationId}
          and created_at >= now() - (${RATE_LIMITS.perConversationWindowSec} * interval '1 second')`,
    );
    state.conversation = { count: convCount, max: RATE_LIMITS.perConversationMax };
    if (convCount >= RATE_LIMITS.perConversationMax) {
      return {
        allowed: false,
        reason: "conversation",
        retryAfter: RATE_LIMITS.perConversationWindowSec,
        state,
      };
    }
  }

  // 3. Duplicate-body spam.
  const norm = normalize(rawBody);
  const dupes = recentBodies.filter((b) => normalize(b) === norm).length;
  state.duplicate = { count: dupes, max: RATE_LIMITS.duplicateMax };
  if (dupes >= RATE_LIMITS.duplicateMax) {
    return { allowed: false, reason: "duplicate", retryAfter: RATE_LIMITS.duplicateWindowSec, state };
  }

  // 4. New-connection cooldown: stricter limits right after connecting, until
  //    the other party replies once (§12-F).
  const ageSec = (Date.now() - new Date(ctx.connectionCreatedAt).getTime()) / 1000;
  if (ctx.conversationId && ageSec < RATE_LIMITS.newConnectionWindowSec) {
    const otherReplied = await count(
      sql,
      sql<{ n: number }>`
        select count(*)::int as n from messages
        where sender_id = ${ctx.recipientId} and conversation_id = ${ctx.conversationId}`,
    );
    if (otherReplied === 0) {
      const sentSinceConnect = await count(
        sql,
        sql<{ n: number }>`
          select count(*)::int as n from messages
          where sender_id = ${ctx.senderId}
            and conversation_id = ${ctx.conversationId}
            and created_at >= ${ctx.connectionCreatedAt}`,
      );
      state.new_connection = {
        sent: sentSinceConnect,
        max: RATE_LIMITS.newConnectionMax,
        other_replied: false,
      };
      if (sentSinceConnect >= RATE_LIMITS.newConnectionMax) {
        return {
          allowed: false,
          reason: "new_connection",
          retryAfter: Math.max(1, Math.ceil(RATE_LIMITS.newConnectionWindowSec - ageSec)),
          state,
        };
      }
    } else {
      state.new_connection = { other_replied: true };
    }
  }

  return { allowed: true, state };
}
