// Text normalization for content safety (spec §6.2).
// Goal: defeat trivial evasion (casing, diacritics, leetspeak, padding,
// zero-width chars, stretched letters) before denylist matching — while
// staying deterministic and dependency-free so it is fast and unit-testable.

const LEET: Record<string, string> = {
  "@": "a",
  "3": "e",
  "1": "i",
  "0": "o",
  "$": "s",
};

// Combining diacritical marks (U+0300–U+036F).
const COMBINING_MARKS = /[̀-ͯ]/g;
// Zero-width space, ZWNJ, ZWJ, and BOM.
const ZERO_WIDTH = /[​‌‍﻿]/g;

/**
 * Normalize free text to a comparable canonical form.
 * lowercase → strip diacritics → strip zero-width → de-leet → collapse
 * stretched runs (3+ identical chars → 1) → collapse whitespace.
 */
export function normalize(input: string): string {
  let s = (input ?? "").toLowerCase();

  // Strip diacritics (é → e) via NFKD decomposition + combining-mark removal.
  s = s.normalize("NFKD").replace(COMBINING_MARKS, "");

  // Strip zero-width / BOM characters used to split words.
  s = s.replace(ZERO_WIDTH, "");

  // De-leet the specific, high-confidence substitutions from the spec.
  s = s.replace(/[@310$]/g, (c) => LEET[c] ?? c);

  // Collapse stretched runs ("fuuuck" → "fuck"); leaves doubles intact.
  s = s.replace(/(.)\1{2,}/g, "$1");

  // Collapse whitespace.
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

/** Tokenize normalized text into alphabetic word tokens (Scunthorpe-safe). */
export function tokenize(normalized: string): string[] {
  return normalized.split(/[^a-z]+/).filter(Boolean);
}
