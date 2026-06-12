// Severe content denylist + threat/abuse pattern matching (spec §6.2).
//
// TWO TIERS, NO MASKING: a term is either severe (hard-blocked, never stored)
// or it passes through verbatim. This list is deliberately SMALL and
// HIGH-CONFIDENCE — only terms we are comfortable hard-blocking. Mild profanity
// (shit, ass, damn) is intentionally absent and sends unmodified.
//
// Matching is word-boundary / token based against NORMALIZED text, which
// avoids the Scunthorpe problem ("assistant" is one token, never "ass").

import { normalize, tokenize } from "./normalize.ts";

// Bump when the list changes so audit rows record which version judged a send.
export const DENYLIST_VERSION = "2026-06-09.1";

// Single-token severe terms (slurs + harsh directed profanity). Matched as
// whole tokens only. Curated, high-confidence; tune here without a migration.
const SEVERE_TOKENS: ReadonlySet<string> = new Set([
  // Harsh directed profanity (§12-C examples).
  "cunt",
  "motherfucker",
  "motherfuckers",
  // Hard slurs (racial / ethnic / homophobic / transphobic / ableist).
  "nigger",
  "nigga",
  "faggot",
  "faggots",
  "tranny",
  "chink",
  "spic",
  "kike",
  "wetback",
  "coon",
  "gook",
  "retard",
  "retards",
]);

// Explicit threats of violence directed at the recipient.
const THREAT_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:i(?:'?ll| will)|i am (?:gonna|going to)|im gonna|imma|gonna)\s+(?:\w+\s+){0,3}(?:kill|murder|rape|hurt|beat|stab|shoot|strangle|choke)\s+(?:you|u|ya|yall|your|ur|u're)\b/,
  /\bk+y+s+\b/, // "kys" and stretched variants
  /\b(?:kill|hang|neck)\s+your\s?self\b/,
];

// Sexual content toward minors: requires BOTH a minor reference AND a sexual
// term in the same message (keeps unambiguous-only to avoid false positives).
const MINOR_PATTERN =
  /\b(?:child|children|kid|kids|minor|minors|underage|preteen|pre-teen|toddler|infant|13yo|12yo|11yo)\b/;
const SEXUAL_PATTERN =
  /\b(?:sex|sexual|sexy|nude|nudes|naked|fuck|fucking|porn|horny|cum|rape|hookup)\b/;

export interface ContentVerdict {
  decision: "allow" | "block";
  categories: string[]; // for the 422 payload + audit
  matchedTerms: string[];
  denylistVersion: string;
}

/**
 * Deterministic content check. Returns `block` only for high-confidence severe
 * content; everything else (including mild profanity) returns `allow`.
 */
export function evaluateContent(raw: string): ContentVerdict {
  const norm = normalize(raw);
  const tokens = tokenize(norm);
  const matched: string[] = [];
  const categories = new Set<string>();

  for (const token of tokens) {
    if (SEVERE_TOKENS.has(token)) {
      matched.push(token);
      categories.add("hate");
    }
  }

  for (const re of THREAT_PATTERNS) {
    if (re.test(norm)) {
      matched.push("threat");
      categories.add("threat");
      break;
    }
  }

  if (MINOR_PATTERN.test(norm) && SEXUAL_PATTERN.test(norm)) {
    matched.push("minor_sexual");
    categories.add("sexual");
  }

  return {
    decision: matched.length > 0 ? "block" : "allow",
    categories: [...categories],
    matchedTerms: matched,
    denylistVersion: DENYLIST_VERSION,
  };
}
