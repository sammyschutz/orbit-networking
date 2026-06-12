// Lightweight abuse heuristics beyond the denylist (spec §6.2.2, §6.3).
// Cheap signals for harassment/spam that, when they cross a threshold, escalate
// a send to a hard block. Deterministic and dependency-free.

import { normalize } from "./normalize.ts";
import { ABUSE_BLOCK_THRESHOLD } from "./constants.ts";

export interface AbuseSignals {
  score: number;
  block: boolean;
  categories: string[];
  flags: Record<string, boolean>;
}

const LINK_RE = /(https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|net|org|io|co|xyz|link|me|app)\b/gi;
const PHONE_RE = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;

/**
 * Score abuse signals for a single message.
 * @param raw            the raw message body
 * @param recentBodies   the sender's recent bodies in this conversation
 *                       (already-stored), for repeated-identical detection
 */
export function evaluateAbuse(raw: string, recentBodies: string[] = []): AbuseSignals {
  const flags: Record<string, boolean> = {};
  let score = 0;

  const letters = raw.replace(/[^a-zA-Z]/g, "");
  const uppers = raw.replace(/[^A-Z]/g, "");
  if (letters.length >= 8 && uppers.length / letters.length > 0.8) {
    flags.all_caps = true;
    score += 1;
  }

  const links = raw.match(LINK_RE)?.length ?? 0;
  if (links >= 3) {
    // many links in one message — clear spam, blocks on its own
    flags.link_flood = true;
    score += 3;
  } else if (links >= 1 && raw.replace(LINK_RE, "").trim().length < 12) {
    // a bare link with little else — classic drive-by spam
    flags.bare_link = true;
    score += 1;
  }

  if (PHONE_RE.test(raw)) {
    flags.contact_info = true;
    score += 1;
  }

  const norm = normalize(raw);
  const dupes = recentBodies.filter((b) => normalize(b) === norm).length;
  if (dupes >= 3) {
    // hammering the same message — blocks on its own
    flags.repeated_identical = true;
    score += 3;
  }

  const categories: string[] = [];
  if (flags.link_flood || flags.bare_link || flags.repeated_identical) {
    categories.push("spam");
  }
  if (flags.all_caps) categories.push("harassment");

  return {
    score,
    block: score >= ABUSE_BLOCK_THRESHOLD,
    categories,
    flags,
  };
}
