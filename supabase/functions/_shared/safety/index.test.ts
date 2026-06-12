// Unit tests for the deterministic safety modules (spec §6, §11.2).
// Run: deno test supabase/functions/_shared/safety/
import {
  assert,
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalize, tokenize } from "./normalize.ts";
import { evaluateContent } from "./denylist.ts";
import { evaluateAbuse } from "./abuse.ts";

Deno.test("normalize: lowercase, diacritics, leet, stretch, zero-width", () => {
  assertEquals(normalize("HELLO"), "hello");
  assertEquals(normalize("café"), "cafe");
  assertEquals(normalize("fuuuuck"), "fuck");
  assertEquals(normalize("c u n t".replace(/ /g, "")), "cunt");
  // leetspeak de-substitution
  assertEquals(normalize("a$$"), "ass"); // $ -> s
  assertEquals(normalize("h3llo"), "hello"); // 3 -> e
  // zero-width char between letters is stripped
  assertEquals(normalize("cu​nt"), "cunt");
});

Deno.test("tokenize splits on non-letters (Scunthorpe-safe)", () => {
  assertEquals(tokenize(normalize("the assistant helped")), [
    "the",
    "assistant",
    "helped",
  ]);
});

Deno.test("content: mild profanity passes through verbatim (no masking)", () => {
  for (const ok of ["this is shit", "what an ass", "damn that's cool", "hello there"]) {
    assertEquals(evaluateContent(ok).decision, "allow", ok);
  }
});

Deno.test("content: Scunthorpe problem — substrings do not false-positive", () => {
  for (const ok of [
    "i am an assistant",
    "scunthorpe is a town",
    "class assignment",
    "cockpit instruments",
  ]) {
    assertEquals(evaluateContent(ok).decision, "allow", ok);
  }
});

Deno.test("content: harsh directed profanity is hard-blocked", () => {
  assertEquals(evaluateContent("you are a cunt").decision, "block");
  assertEquals(evaluateContent("shut up motherfucker").decision, "block");
  // evasion via stretched letters is caught (motherfuuucker -> motherfucker)
  assertEquals(evaluateContent("shut up motherfuuucker").decision, "block");
  // evasion via spacing + zero-width is caught
  assertEquals(evaluateContent("c​u​n​t").decision, "block");
});

Deno.test("content: explicit threats are blocked", () => {
  assert(evaluateContent("i will kill you").decision === "block");
  assert(evaluateContent("im gonna hurt you").decision === "block");
  assert(evaluateContent("kys").decision === "block");
  // benign uses of 'kill' are not threats toward the recipient
  assertEquals(evaluateContent("this workout is gonna kill me").decision, "allow");
});

Deno.test("content: minor-sexual requires both signals", () => {
  assertEquals(evaluateContent("my kid started school").decision, "allow");
  assertEquals(evaluateContent("let's hookup tonight").decision, "allow");
  assertEquals(evaluateContent("send nudes of a minor").decision, "block");
});

Deno.test("content verdict carries categories + version", () => {
  const v = evaluateContent("you are a cunt");
  assert(v.categories.includes("hate"));
  assert(v.matchedTerms.includes("cunt"));
  assert(v.denylistVersion.length > 0);
});

Deno.test("abuse: all-caps shouting scores but does not alone block", () => {
  const a = evaluateAbuse("STOP MESSAGING ME RIGHT NOW");
  assert(a.flags.all_caps);
  assertFalse(a.block);
});

Deno.test("abuse: link flooding blocks", () => {
  const a = evaluateAbuse(
    "buy http://spam.xyz http://more.io http://cheap.link deals",
  );
  assert(a.flags.link_flood);
  assert(a.block);
  assert(a.categories.includes("spam"));
});

Deno.test("abuse: a couple of links does not block", () => {
  const a = evaluateAbuse(
    "loved these two reads https://blog.dev/a and https://blog.dev/b — thoughts?",
  );
  assertFalse(a.block);
});

Deno.test("abuse: repeated identical messages block", () => {
  const body = "hello hello hello";
  const recent = [body, body, body];
  const a = evaluateAbuse(body, recent);
  assert(a.flags.repeated_identical);
  assert(a.block);
});

Deno.test("abuse: normal message is clean", () => {
  const a = evaluateAbuse("Hey! Loved your talk on distributed systems.");
  assertEquals(a.score, 0);
  assertFalse(a.block);
});
