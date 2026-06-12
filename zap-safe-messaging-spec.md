# Zap — Safe Messaging Technical Specification

> **Status: REVIEWED — decisions locked.** No code has been written yet. The
> options below are kept for context, but the design is now decided; final calls
> are summarized in **§12 Locked Decisions**. Ready to implement on your go.

---

## 1. Goal

Add **instant, 1:1 messaging between connected users** ("connections") to Zap,
with safety as a first-class requirement, not an afterthought. Every message
must pass through a server-side safety gateway before it is stored or delivered.

Hard requirements (from product owner):

1. **Messaging only between established connections** (`connections.status = 'connected'`).
2. **Block & report users** — first-class, available from the chat surface.
3. **Profanity + abuse filtering.**
4. **Rate limiting** (anti-spam / anti-flood).
5. **Message audit log** (append-only record of every safety decision).
6. **All safety logic lives in an Edge Function** — the client is never trusted
   to enforce safety, and direct DB writes for messages are forbidden by RLS.

---

## 2. Design principles (carried over from the existing codebase)

These mirror patterns already in the repo so messaging feels native to Zap:

- **Locked-down RLS, server-mediated writes.** `connections` and `notifications`
  already use `with check (false)` to block all client inserts; mutations flow
  through a `security definer` function (`submit_swipe`). Messaging follows the
  same shape: **clients can read their own messages but can never insert them
  directly** — sends go through the `send-message` Edge Function.
- **Edge Function = trusted server.** `delete-account` already verifies the
  caller (`supabase.auth.getUser(token)`) and acts with the service-role key.
  The messaging safety gateway reuses this exact pattern.
- **Connections are the messaging boundary.** A pair is unique
  (`idx_connections_unique_pair`) and ordered (`least/greatest`). We reuse that.

---

## 3. The security/safety architecture decision (the big one)

### 3.1 Where safety runs — chosen: **Edge Function gateway**

```
                     ┌─────────────────────────────────────────────┐
                     │            send-message Edge Function         │
 client  ──POST──▶   │  1. authn (verify JWT → sender_id)            │
 (RLS cannot         │  2. authz (connection exists & connected?)    │
  INSERT messages)   │  3. block check (either side blocked?)        │
                     │  4. rate limit (sliding window)               │
                     │  5. content safety (profanity/abuse)          │
                     │  6. write message (service role)              │
                     │  7. write audit-log row (always)              │
                     └───────────────────┬─────────────────────────┘
                                         │ insert (service role)
                                         ▼
                            messages table  ──Realtime──▶  recipient
                                                          (RLS-filtered)
```

- **Sends** go `client → Edge Function → DB`. The client never touches the
  `messages` table for writes.
- **Reads** go `client → DB` directly, protected by RLS, and **delivery is
  push** via Supabase Realtime on the `messages` table (RLS-filtered per user).
  This keeps the read path cheap and "instant" without routing reads through the
  function.

**Why an Edge Function and not a Postgres `security definer` RPC** (like
`submit_swipe`)? Both run server-side and both are valid. We choose the Edge
Function because the safety stack benefits from things Postgres is bad at:
calling external moderation APIs over HTTP, richer string normalization,
maintainable filter lists, and easy future swap-in of an LLM/3rd-party
moderation provider. The user's requirement ("safety logic should live in an
Edge Function") also makes this explicit. *(See §12-A — we can do a hybrid where
the final atomic write is a small RPC the function calls.)*

### 3.2 Encryption — DECIDED: **TLS in transit + at-rest encryption, NOT E2E**

This is a deliberate, important trade-off worth surfacing:

| Option | Pros | Cons |
|---|---|---|
| TLS + at-rest (recommended) | Server can read plaintext → **moderation, profanity/abuse filtering, audit all work**. Simple. | Operator can technically read messages (mitigated by RLS, access controls, audit). |
| **End-to-end encryption** | Strongest confidentiality. | **Fundamentally incompatible with server-side content moderation** — you cannot profanity/abuse-filter ciphertext. Also heavy key-management on mobile. |

Because requirements #3 (profanity/abuse) and #5 (audit) demand the server read
message content, **E2E is off the table for this feature.** We rely on:
Supabase TLS, Postgres at-rest encryption, strict RLS, append-only audit, and
least-privilege (only the Edge Function's service role writes messages). This
should be stated plainly in the app's privacy copy. *(§12-B)*

---

## 4. Data model

New tables. All follow existing conventions (`uuid` PKs, `timestamptz`,
`created_at`/`updated_at`, RLS enabled, references `auth.users` with cascade).

### 4.1 `conversations`
One row per connected pair. Lazily created on first message (or at connect time).
Holds lightweight metadata so the inbox list is cheap.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `connection_id` | uuid unique → connections(id) | 1:1 with a connection |
| `user_a_id` / `user_b_id` | uuid → auth.users | ordered `least/greatest`, mirrors connections |
| `last_message_at` | timestamptz null | for inbox sort |
| `last_message_preview` | text null | short, already-filtered snippet |
| `created_at` / `updated_at` | timestamptz | |

### 4.2 `messages`
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `conversation_id` | uuid → conversations(id) on delete cascade | |
| `sender_id` | uuid → auth.users | |
| `recipient_id` | uuid → auth.users | denormalized for RLS/rate-limit simplicity |
| `body` | text not null | stored **as sent**. Mild profanity passes through unmasked; severe terms are hard-blocked so they never reach this table (audit only). See §6. |
| `status` | text not null default `sent` | only `sent` in v1 (blocked attempts live in the audit log, not here). Column kept for forward-compat. |
| `created_at` | timestamptz | |
| `deleted_at` | timestamptz null | soft delete (sender "unsend") |

> **No `read_at` in v1** — read receipts are Phase 2 (§12-E). Adding the column
> later is a trivial migration.

Indexes: `(conversation_id, created_at desc)`, `(recipient_id, created_at desc)`.

### 4.3 `blocks`
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `blocker_id` | uuid → auth.users | |
| `blocked_id` | uuid → auth.users | |
| `reason` | text null | optional |
| `created_at` | timestamptz | unique `(blocker_id, blocked_id)` |

Semantics when A blocks B (**DECIDED, §12-D**): **bidirectional silence** —
neither can send to the other; the conversation is hidden for A; **B is also
hidden from A's connections feed while the block is active**; B is not told they
were blocked (industry standard). The underlying `connections` row is **not
severed** — unblocking restores both the chat and the connections-feed entry.
This means the connections feed and conversation queries must exclude pairs with
an active block (see §5).

### 4.4 `reports`
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `reporter_id` | uuid → auth.users | |
| `reported_id` | uuid → auth.users | |
| `conversation_id` | uuid null | context |
| `message_id` | uuid null | the specific offending message, if any |
| `category` | text check (`harassment`,`spam`,`hate`,`sexual`,`threat`,`other`) | |
| `details` | text null | free text |
| `status` | text check (`open`,`reviewing`,`actioned`,`dismissed`) default `open` | moderation queue |
| `created_at` / `updated_at` | timestamptz | |

### 4.5 `message_audit_log` (append-only)
The compliance backbone. **One row per send attempt**, allowed or not.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `actor_id` | uuid → auth.users | who attempted |
| `conversation_id` | uuid null | |
| `message_id` | uuid null | set if a message was stored |
| `decision` | text check (`allowed`,`blocked_content`,`blocked_rate`,`blocked_relationship`) | no `redacted` — v1 has no masking tier (§6) |
| `filter_verdicts` | jsonb | `{profanity: [...], abuse_score, matched_terms, provider}` |
| `rate_state` | jsonb | window counts at decision time |
| `raw_excerpt` | text null | redacted/truncated original for review — **retention-limited**, see §9 |
| `created_at` | timestamptz | |

Append-only: no UPDATE/DELETE grants to anyone; only the Edge Function's service
role inserts.

### 4.6 Remove connection — no new table (reuses `swipes`)
Removing a connection (§13) needs **no new table**. It reuses the existing
`swipes` ledger to drive a time-based cooldown: removal severs the connection,
deletes the conversation, and refreshes both users' swipe rows to a dated `pass`.
The 6-month re-surface window (§13) is computed from `swipes.created_at`. This
does require the existing `submit_swipe` RPC and discovery deck query to become
**recency-aware** (today they exclude swiped users permanently). See §13.

---

## 5. Row-Level Security (RLS)

Mirroring the existing "select-own, no-client-write" model:

- **`messages`**
  - `SELECT`: caller is `sender_id` OR `recipient_id`, **AND no active block
    exists between the two parties**, AND `deleted_at is null` for the viewer
    where appropriate.
  - `INSERT` / `UPDATE` / `DELETE`: `with check (false)` — **Edge Function only.**
- **`conversations`**
  - `SELECT`: caller is a participant **and not in an active block** with the
    other party (so a blocked thread disappears).
  - `INSERT`/`UPDATE`: no client (Edge Function creates/updates).
- **`connections`** (existing table — policy needs updating)
  - The connections-feed `SELECT` must additionally **exclude pairs with an
    active block** (DECIDED §12-D: blocked users vanish from the feed without
    severing the row). Implement via a `not exists (... from blocks ...)` clause
    or a wrapping view used by the client.
- **`blocks`**
  - `SELECT`: caller is `blocker_id` (read your own block list).
  - `INSERT`/`DELETE`: **no client — via the `block-user` / `unblock-user` Edge
    Functions** (DECIDED §12-A) so each block/unblock writes an audit row and
    performs side-effects atomically.
- **`reports`**
  - `INSERT`: **no client — via the `report-user` Edge Function** (DECIDED §12-A).
    `SELECT`: own reports only.
  - `UPDATE` (status changes): no client — moderation tooling/service role only.
- **`message_audit_log`**: **no client access at all.** Service role only.

> Realtime respects RLS, so a recipient subscribed to `messages` only receives
> rows they're allowed to see, and blocked relationships are filtered out
> automatically.

---

## 6. Content safety (profanity + abuse filtering)

### 6.1 Options weighed

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Deterministic denylist + normalization** (in-function wordlist, leetspeak/diacritic normalization, regex for threats) | Free, fast (<1ms), offline, predictable, easy to unit-test | Crude; misses context/nuance; needs list upkeep | **MVP core** |
| **B. Third-party moderation API** (hosted content-moderation endpoint) | Trained models, multi-category scores (hate/sexual/harassment/self-harm), multilingual | Latency, cost, external dependency/PII egress | **Phase 2 / pluggable** |
| **C. LLM-based moderation (Claude)** | Context-aware, explainable, flexible policy | Cost/latency per message, prompt-injection surface | **Optional escalation only** |

### 6.2 DECIDED: **two-tier deterministic filter — no masking** (§12-C)

There is **no redaction/masking tier**. A term is either severe (hard-blocked)
or it passes through verbatim.

1. **Synchronous deterministic pass (always):** normalize the text (lowercase,
   strip diacritics, collapse repeats, de-leet `@→a 3→e 1→i 0→o $→s`), then
   match against a curated **severe denylist**:
   - **`block` (severe only):** slurs, hate/identity attacks, explicit threats,
     sexual content toward minors, and **harsh profanity directed as abuse**
     (e.g. `cunt`, `motherfucker`). → reject the send, return a clear error,
     audit as `blocked_content`. The message is **never stored** (audit only).
   - **`allow` (everything else, including mild profanity):** words like `shit`,
     `ass`, `damn` **send through unmodified** — no masking, no asterisks.
     Audited as `allowed`.

   > The denylist is therefore deliberately **small and high-confidence** — only
   > terms we are comfortable hard-blocking. We'll seed it together; it lives in
   > a versioned, unit-tested module so it's easy to tune without a migration.
   > Word-boundary matching is required to avoid the "Scunthorpe problem" (don't
   > block `assistant` for containing `ass`).

2. **Abuse heuristics (always):** lightweight scoring for harassment/spam
   signals — repeated targeting, all-caps shouting, link/PII flooding, repeated
   identical messages. Crossing a threshold escalates to `block` and may
   auto-create a `reports` row / flag the account.
3. **Pluggable escalation (Phase 2, behind a flag — §12-J):** for borderline
   cases, call an external/LLM moderation provider asynchronously; the seam
   exists from day one but is **off by default**, so v1 takes no extra
   cost/latency.

The denylist + heuristics live in a versioned module inside the function
(`_shared/safety/`) so they're unit-testable and updatable without schema
changes.

### 6.3 What "abuse" covers beyond profanity
Threats of violence, sexual harassment, hate/identity attacks, doxxing/PII
solicitation, and spam/scam patterns (links, repeated boilerplate, contact-info
fishing). Each maps to a `reports.category` for consistency.

---

## 7. Rate limiting

### 7.1 Options weighed

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **Count query on `messages`/audit within a window** | No new infra, leverages existing indexes, exact | A query per send | **MVP** |
| Dedicated counters table (token bucket) | Cheap reads | More moving parts, contention | Later |
| External store (Redis/Upstash) | Scales, sub-ms | New dependency/cost | At scale |

### 7.2 Recommended limits (sliding windows, enforced in the function)
Tune later; starting points:

- **Global:** ≤ 30 messages / 60s per sender (anti-flood).
- **Per conversation:** ≤ 15 messages / 60s.
- **Duplicate spam:** ≤ 3 identical bodies / 5 min per conversation.
- **New-connection cooldown (DECIDED on, §12-F):** stricter limits in the first
  ~10 min after a connection is created — e.g. ≤ 5 messages until the other
  party replies once, to blunt drive-by abuse from a fresh match. Exact numbers
  tunable via constants.

Exceeding a limit → reject with a `429`-style payload, audit as `blocked_rate`,
include `retry_after`. Limits are **counted server-side only**; the client may
display a friendly cooldown but never enforces it.

---

## 8. API surface

### 8.1 `POST /functions/v1/send-message` (Edge Function — the gateway)
**Auth:** `Authorization: Bearer <jwt>` (verified via `supabase.auth.getUser`).
**Body:** `{ conversation_id?, recipient_id?, body }` (accept either an existing
conversation or a connection/recipient to lazily create one).

**Pipeline:** authn → resolve/validate connection is `connected` → block check →
rate limit → content safety → (insert message + upsert conversation metadata via
service role) → **always insert audit row** → respond.

**Responses:**
- `200 { message }` (sent as-is; no masking in v1).
- `400` validation, `401` auth, `403` not connected / blocked,
  `422 { reason: 'content', categories }`, `429 { retry_after }`.

### 8.2 `POST /functions/v1/report-user` (Edge Function)
Creates a `reports` row, writes an audit entry. Centralized here so reporting
side-effects (e.g., auto-thresholds, notifying moderation) stay server-side.

### 8.3 `POST /functions/v1/block-user` and `/unblock-user` (Edge Functions)
**DECIDED (§12-A):** block/unblock run as Edge Functions. `block-user` inserts
the `blocks` row, hides the conversation, removes the pair from the connections
feed (without severing the connection, §12-D), and writes an audit row — all
server-side and atomic. `unblock-user` reverses it.

### 8.5 `remove_connection(p_connection_id)` (`security definer` RPC)
**DECIDED (§12-K):** removing a connection is a **neutral, non-safety** action,
so it lives in a Postgres `security definer` RPC alongside `submit_swipe` (not in
the safety Edge Function). It severs the connection for both parties, deletes the
conversation + messages, and writes a 6-month cooldown via the swipe ledger. Full
behavior in **§13**. Distinct from block (§8.3), which preserves the connection.

### 8.4 Reads (no new endpoint)
- List conversations: `select` on `conversations` (RLS).
- Load history: paginated `select` on `messages` (RLS), newest-first.
- Live updates: **Supabase Realtime** subscription on `messages` filtered by
  `conversation_id`; relies on RLS for safety.

---

## 9. Privacy, retention, abuse-handling lifecycle

- **Audit retention (DECIDED §12-G):** `message_audit_log.raw_excerpt` is purged
  after **90 days** via a scheduled cleanup (pg_cron); decision metadata
  (verdicts, scores, decision type) is kept longer.
- **Report workflow:** `open → reviewing → actioned/dismissed`. MVP has no admin
  UI; reports are reviewed via SQL/Supabase dashboard. A future moderation
  console is out of scope here.
- **Account deletion (DECIDED §12-H):** extend the existing
  `delete_user_and_relations` RPC / `delete-account` function to remove the
  user's messages, conversations, blocks, and reports. **Audit rows are
  retained but anonymized** — the user id is scrubbed/hashed so abuse-pattern
  history survives and a banned actor can't erase their trail by deleting their
  account.
- **Blocked-user experience:** blocker stops seeing the thread; blocked user's
  sends are rejected with a generic "can't send" (no leakage that they were
  blocked).

---

## 10. Client UX (high level — not the focus, but for completeness)

- **Conversation list** screen (inbox) — sorted by `last_message_at`.
- **Chat** screen reachable from `ConnectionDetail` ("Message" button already
  hinted at in the connections flow) — bubble list, composer, optimistic send
  that reconciles with the function's verdict (a hard-blocked message surfaces a
  clear error and rolls back from the UI; a rate-limited send shows a cooldown).
- **Safety affordances:** overflow menu with **Block** and **Report** on every
  conversation and long-press on a message; confirmation dialogs; clear error
  toasts for rate-limit/blocked-content responses.
- Implementation must follow the pinned **Expo v56** docs
  (`docs.expo.dev/versions/v56.0.0/`) per `AGENTS.md`.

---

## 11. Implementation phases (proposed, for when we proceed)

1. **Schema + RLS migration** (tables in §4, policies in §5).
2. **`_shared/safety/` module** — normalization, denylist, abuse heuristics,
   rate-limit helpers — with unit tests.
3. **`send-message` Edge Function** wiring the pipeline + audit.
4. **`report-user` + block/unblock** server pieces.
5. **Client:** inbox, chat, Realtime subscription, block/report UI.
6. **Delete-account extension** for the new tables.
7. **Phase 2 (optional):** pluggable moderation provider, admin/moderation views,
   read receipts, typing indicators.

---

## 12. Locked Decisions

| # | Decision | Resolution |
|---|---|---|
| A | Block/report mechanism | **Edge Functions** (`block-user`, `unblock-user`, `report-user`) — keeps audit + side-effects centralized server-side. |
| B | Privacy / encryption | **Server-readable messages** (TLS + at-rest, no E2E). Required for moderation. Reflect in privacy copy. |
| C | Profanity handling | **Two tiers, no masking.** Hard-block a small high-confidence severe denylist (e.g. `cunt`, `motherfucker`, slurs, threats). Mild profanity (`shit`, `ass`, `damn`) sends **verbatim**. |
| D | Block scope | **Hide chat + hide from connections feed** while blocked; **do not sever** the connection row. Unblock fully restores. |
| E | Receipts / typing | **Neither in v1** — Phase 2. |
| F | New-connection cooldown | **Yes** — stricter limits (~10 min / until first reply) right after connecting. |
| G | Audit excerpt retention | **90 days** for `raw_excerpt`; decision metadata kept longer. |
| H | Account deletion | Purge messages/conversations/blocks/reports; **retain audit rows anonymized**. |
| I | Rate limits | **Use defaults** — 30/60s global, 15/60s per conversation, 3 identical/5min (+ §F cooldown). Tunable via constants. |
| J | Moderation provider | **Pluggable seam, off by default.** Deterministic-only in v1; external/LLM provider can drop in later. |
| K | Remove connection (unmatch) | **Neutral action, separate from block.** `security definer` RPC severs the connection, deletes the conversation/messages, and hides both users from each other for **6 months** before they can resurface/re-match (§13). |
| L | Discovery cooldown for passes | A plain **swipe-left now hides for 6 months** (today it's permanent). Requires making `submit_swipe` + the deck query recency-aware (§13). |

### Still to nail down at implementation time
- The **exact contents of the severe denylist** — I'll propose a starter list for
  your sign-off (high-confidence terms only, word-boundary matched).
- Final **cooldown numbers** for §F.

---

## 13. Remove connection (unmatch) & discovery cooldown

A neutral counterpart to blocking: "I no longer want this connection," with **no
implication of abuse.** It does *not* create a report or a block.

### 13.1 Remove vs. Block — the two relationship exits

| | **Remove connection** (§13) | **Block** (§3–§8.3) |
|---|---|---|
| Intent | Neutral ("not for me") | Safety ("make them stop") |
| Connection row | **Severed** (deleted) | **Preserved**, just hidden |
| Conversation + messages | **Deleted** | Hidden (restored on unblock) |
| Reversible by actor | No (would need a fresh re-match) | Yes (unblock) |
| Effect on the other party | Symmetric & silent | Symmetric & silent |
| Re-appears in deck | After **6 months** | Never while blocked; normal rules after unblock |
| Creates a report | No | No (Report is its own separate action) |
| Where it runs | `security definer` RPC (§8.5) | Edge Function (§8.3) |

### 13.2 What `remove_connection(p_connection_id)` does (atomic)
Caller must be a participant in the connection. In one transaction:
1. **Delete the `connections` row** (gone for both — you can't have a one-sided
   connection).
2. **Delete the `conversations` row + its `messages`** (cascade). Since this is
   not an abuse action, message content is removed for both parties. *(Safety
   audit rows in `message_audit_log` are untouched — they persist per §G/§H.)*
3. **Refresh both swipe rows to a dated `pass`:** upsert `A→B` and `B→A` in
   `swipes` to `direction = 'pass', created_at = now()`. This is what powers the
   6-month symmetric cooldown via the deck query below.

> Why flip *both* directions: the requirement is that **neither** person sees the
> other for 6 months, after which both decks may resurface the other and a fresh
> mutual like can re-match. Setting both swipe rows achieves that symmetrically.

### 13.3 The 6-month cooldown (changes to existing discovery, decision §12-L)
Today the deck excludes **everyone** you've ever swiped on, permanently
(`appStore.ts` builds `excludeIds` from all `swipes`). Two changes make passes
(and removals) expire:

1. **Deck query becomes recency-aware.** Exclusion rule:
   - exclude `like` swipes (you've already expressed interest / matched), **and**
   - exclude `pass` swipes **only where `created_at > now() - interval '6 months'`**.
   - (current connections are already excluded separately.)
   After 6 months a passed/removed person becomes eligible to resurface.
2. **`submit_swipe` becomes an upsert that refreshes the timestamp.** Today it's
   `on conflict do nothing`, so a re-swipe after expiry would keep the stale
   `created_at` and the person would keep reappearing every load. Change to
   `on conflict (from_user_id, to_user_id) do update set direction = excluded.direction, created_at = now()`
   so each new swipe restarts the clock. (Guard: don't let a re-swipe silently
   alter an active matched relationship — only refresh when there's no live
   connection.)

> **Scope note:** the 6-month pass cooldown is technically a *discovery* change,
> not a messaging one, but it's the same mechanism removal relies on, so it's
> specified here. Worth a sanity check that you want plain left-swipes (not just
> removals) to resurface after 6 months — that's how I've written it per your
> note.

### 13.4 Client UX
- **Remove connection** lives in the same overflow menu as Block/Report (on the
  conversation and the connection detail), with a clear confirmation
  ("Remove connection? Your conversation will be deleted.").
- Distinct, less-alarming styling than Block (which is a safety action).

---

*Decisions locked. On your go-ahead I'll implement in the phase order of §11
(remove-connection RPC + discovery cooldown slot in after the messaging core),
starting with the schema + RLS migration. Still no code written.*
