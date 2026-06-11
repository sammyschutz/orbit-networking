// Append-only audit logging (spec §4.5, §3). EXACTLY ONE row per send attempt,
// allowed or not. Written over the function's direct Postgres connection.

import { AUDIT_EXCERPT_MAX } from "./constants.ts";
import type { Sql } from "./rateLimit.ts";

export type AuditDecision =
  | "allowed"
  | "blocked_content"
  | "blocked_rate"
  | "blocked_relationship";

export interface AuditRow {
  actor_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  decision: AuditDecision;
  filter_verdicts: Record<string, unknown>;
  rate_state: Record<string, unknown>;
  raw_excerpt: string | null;
}

/** Truncate the original body to a bounded, review-only excerpt. */
export function toExcerpt(body: string | null | undefined): string | null {
  if (!body) return null;
  const trimmed = body.slice(0, AUDIT_EXCERPT_MAX);
  return body.length > AUDIT_EXCERPT_MAX ? `${trimmed}…` : trimmed;
}

/**
 * Insert the audit row. Never throws into the request path — auditing failures
 * are logged but must not mask the user-facing result of the send decision.
 * (For the allowed path the caller inserts the audit row inside the same
 * transaction as the message, so the two commit atomically.)
 */
export async function writeAudit(sql: Sql, row: AuditRow): Promise<void> {
  try {
    await sql`
      insert into message_audit_log
        (actor_id, conversation_id, message_id, decision, filter_verdicts, rate_state, raw_excerpt)
      values (
        ${row.actor_id},
        ${row.conversation_id},
        ${row.message_id},
        ${row.decision},
        ${JSON.stringify(row.filter_verdicts)}::jsonb,
        ${JSON.stringify(row.rate_state)}::jsonb,
        ${row.raw_excerpt}
      )`;
  } catch (err) {
    console.error("audit insert failed", err);
  }
}
