# Zap — "My Algorithm" Discover Customization Specification

> **Status: IMPLEMENTED (2026-06-12).** All three phases (data + algorithm,
> My Algorithm surface, onboarding step). Product decisions locked in §11.
> §12 records how each provisional call was resolved during the build —
> notably the cities seed is **GeoNames cities5000**, not SimpleMaps.

---

## 1. Goal

Let users **tune who they see on Discover** and make it feel like **they are
building their own algorithm** — the opposite of the opaque feed every other
app gives them. Two concrete inputs, one framing:

1. **Interests** — pick from a curated list, plus free-form tags, and Discover
   ranks people who share them toward the front.
2. **Locality** — a self-reported city plus a "show me people nearby first /
   only" control, where *nearby* means a real radius (default 25 mi), not
   string-equal city names.
3. **The framing is the feature**: the surface is called **"My algorithm."**
   Every edit visibly recomposes a plain-language summary of what Discover
   will do, and Discover itself shows *why* each person appeared. The user
   should feel authorship, not configuration.

Brand-neutral throughout (possible rename pending): no ⚡ motif in new UI; a
generic "tuning" icon (sliders / sparkles) for the surface.

---

## 2. What exists today

| Surface | Current behavior |
|---|---|
| `appStore.fetchCandidates` | Three client queries (own swipes, own connections, then profiles `not in (…)`), ordered by `created_at desc`, limit 20. **No ranking signal at all.** Doesn't exclude blocked users. |
| `profiles` | Has `industry`, `experience_level`, `timezone` — **no city, no coordinates, no interests.** |
| `interests` table | Exists but **empty**: `(id, name, created_at)`. RLS enabled, select-only for `authenticated`; insert/update revoked (20260611100000 hardening). No join table to users. |
| Settings (`app/(tabs)/settings.tsx`) | Rows + delete-account flow. Natural home for a "My algorithm" entry row. |
| Discover (`DiscoveryIntro.tsx`) | One-at-a-time introduction view consuming `candidates` in store order — **ranking slots in underneath it with zero interaction change.** |
| Blocking | `has_active_block(a, b)` helper exists (messaging era); Discover currently never calls it. |

**Key insight:** the handshake revamp deliberately left the candidate queue
dumb (handshake spec, "Out of scope"). This feature is the other half: it
**reorders and filters the queue** that `DiscoveryIntro` already consumes. No
interaction changes on Discover beyond new "why" chips — the work is a data
model, a ranking RPC, and the My Algorithm surface.

---

## 3. The "My algorithm" surface

A dedicated screen (`/my-algorithm`), opened from a new Settings row
(**"My algorithm"**, tuning icon) — and reachable from Discover (§7). Not
buried inside profile editing: interests and locality are *discovery
controls*, and giving them their own named surface is what sells authorship.

```
┌──────────────────────────────────────┐
│  ←  My algorithm                     │
│                                      │
│  ╭──────────────────────────────────╮│
│  │ Show me people into **AI/ML**,   ││  ← live summary card: recomposes
│  │ **Climbing**, or **Fintech** —   ││    as a sentence on every edit.
│  │ near **Austin** (25 mi) first.   ││    This IS the algorithm, readable.
│  ╰──────────────────────────────────╯│
│                                      │
│  YOUR INTERESTS  (3 of 10)           │
│  [AI/ML ✓] [Fintech ✓] [Design]      │  ← curated chips, multi-select
│  [Climbing ✓] [Coffee] [Gaming] …    │
│  ┌─────────────────────────────┐     │
│  │ + Add your own…             │     │  ← free-form tag input (§4.2)
│  └─────────────────────────────┘     │
│                                      │
│  WHERE                               │
│  City        Austin, TX          ›   │  ← typeahead against cities table
│  Nearby only              [toggle]   │
│  Radius      ( 10 | 25 | 50 | 100 )  │  ← segmented; visible whenever a
│                                      │    city is set (drives ranking too)
│  Updates apply the next time         │
│  Discover refreshes.                 │
└──────────────────────────────────────┘
```

- **The live summary card is the centerpiece.** It rewrites itself on every
  chip toggle: no interests → "Show me interesting people near Austin first.";
  no city → "Show me people into AI/ML or Climbing first."; nothing set →
  "Discover is unfiltered — pick interests or a city to tune it."
- Saves are **implicit** (each change persists immediately); a small
  "Algorithm updated" confirmation appears, and the store clears the cached
  candidate queue so the next Discover visit refetches with the new tuning.
- Interest selections cap at **10** (enough to express identity, keeps overlap
  scoring meaningful; the counter "3 of 10" makes the cap feel like curation,
  not a limit).
- "Nearby only" is disabled (with explanatory subtext) until a city is set.

---

## 4. Interests

### 4.1 Curated list

Seed the existing `interests` table with ~45 rows, `curated = true` (new
column). Working seed — professional-leaning with enough life in it to spark
conversation (these are also conversation starters, per the handshake model):

> AI & Machine Learning · Web Development · Mobile Development · Data Science ·
> Cybersecurity · Cloud & DevOps · Open Source · AR/VR · Robotics · Product
> Management · UX/UI Design · Graphic Design · Marketing · Growth · Sales ·
> Founding a Startup · Venture Capital · Investing · Fintech · Healthtech ·
> Climate & Sustainability · Edtech · E-commerce · Gaming · Music · Film & TV ·
> Photography · Writing · Podcasting · Public Speaking · Mentorship · Career
> Pivots · Job Hunting · Remote Work · Freelancing · Side Projects · Books ·
> Fitness · Running · Climbing · Yoga · Hiking · Travel · Cooking · Coffee

### 4.2 Free-form tags

The "+ Add your own…" input creates a non-curated interest via RPC (clients
keep zero direct write access to `interests` — the hardening migration's
revoke stands):

- **`add_custom_interest(p_name text) → interest_id`** (SECURITY DEFINER):
  trims, collapses internal whitespace, enforces 2–30 chars and a
  letters/digits/space/`&+-/`' charset, then upserts against a new
  **`unique index on lower(name)`** — if "climbing" exists in any case, you
  get the existing row back instead of a duplicate. Stores display case as
  typed.
- Custom tags participate in overlap scoring exactly like curated ones (exact
  normalized match — two people typing "homebrewing" connect; that's the
  point). No moderation queue for v1: tags are only visible on the profiles
  of people who chose them, the existing report-user flow covers abuse, and
  the charset + length rules block the worst. Revisit if reports show
  otherwise.

### 4.3 `user_interests` junction

```sql
create table user_interests (
  user_id     uuid not null references auth.users(id) on delete cascade,
  interest_id uuid not null references interests(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, interest_id)
);
```

- RLS: `select` to `authenticated` `using (true)` — interests are **public**
  (locked, §11-D): they render on profiles and power shared-interest chips.
  `insert`/`delete` own rows only (`user_id = auth.uid()`).
- The 10-per-user cap is enforced by a `before insert` trigger (count check),
  not client-side only.

---

## 5. Locality

### 5.1 City, with real geometry behind it

Locked (§11-A): **self-reported city, but "nearby" is a radius**, because
string-equal city names make small towns islands. So the city picker is backed
by a coordinates lookup:

```sql
create table cities (
  id      uuid primary key default gen_random_uuid(),
  name    text not null,          -- "Austin"
  region  text null,              -- "TX" / admin area
  country text not null,          -- "US"
  lat     double precision not null,
  lng     double precision not null,
  population int null             -- typeahead ranking
);
```

- Seeded from the **GeoNames cities5000 dataset** (free, CC BY 4.0 — ~69k
  places with population > 5,000 plus administrative seats; attribution line
  rendered at the bottom of the My Algorithm screen). SimpleMaps was the
  original pick (§12-2) but blocks automated download; GeoNames is the same
  license with comparable coverage. The table also gained an `ascii_name`
  column so typeahead input like "Sao Paulo" matches "São Paulo"; `region`
  keeps only alphabetic admin-1 codes ("TX", "ENG").
- `profiles.city_id uuid null references cities(id)` — display string is
  composed (`Austin, TX`); the user's coordinates are **always a city
  centroid**, never a device location. Privacy story is one sentence: "We only
  know the city you told us."
- Typeahead: client queries `cities` (`ilike 'prefix%'`, order by
  `population desc nulls last`, limit 8). RLS: select-only to `authenticated`.
- Distance via the `cube` + `earthdistance` extensions (both available on
  Supabase): `earth_distance(ll_to_earth(a.lat, a.lng), ll_to_earth(b.lat,
  b.lng))` in meters; 25 mi = 40 233.6 m. At centroid-to-centroid granularity
  this is honest "metro math," which is exactly what was asked for.

### 5.2 The toggle and radius

Per-user discovery preferences live in their own owner-only table —
`profiles` is publicly selectable and a user's filter settings are nobody
else's business:

```sql
create table discovery_settings (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  nearby_only        boolean not null default false,
  nearby_radius_miles int not null default 25
    check (nearby_radius_miles in (10, 25, 50, 100)),
  updated_at         timestamptz not null default now()
);
-- RLS: select/insert/update own row only.
```

- **Toggle OFF (default):** radius still matters — people within it get a
  ranking *boost* (§6). Nearby-first, never nearby-only, out of the box.
- **Toggle ON:** radius becomes a **hard filter**. Candidates with **no city
  set are excluded** while it's on (you can't be "within 25 miles" from
  nowhere); the My Algorithm screen says so under the toggle: *"Only people
  who've added their city will appear."*
- Radius is one segmented control reused for both meanings — fewer concepts,
  and tuning it is part of the algorithm-authorship feel.

---

## 6. The algorithm — `get_discover_candidates` RPC

Candidate selection moves from three client queries into one
`get_discover_candidates(p_limit int default 20)` RPC. This is where the
feature actually lives, and it also retires two latent problems: the
`not in (…)` URL that grows with every swipe, and Discover never checking
blocks.

```
eligible  = complete profiles
          − self
          − liked-ever / passed-within-6-months   (existing §13.3 semantics)
          − already-connected
          − has_active_block(viewer, candidate) in either direction
          − (nearby_only ? outside-radius or no-city : nothing)

score     = 10 × shared_interest_count        -- the headline signal
          +  8 × is_nearby                    -- 1 shared interest > nearby alone
          +  2 × is_same_city                 -- small nudge inside the radius
          + recency tiebreak (newer profiles first on equal score)
```

- Returns profile fields **plus the transparency payload**:
  `shared_interests text[]`, `distance_miles numeric null`, `is_nearby bool`
  — Discover renders *why* without extra round-trips (§7).
- Weights are named constants at the top of the function body with a comment
  block — tuning is a one-line migration, and the spec's numbers are a
  starting point, not gospel.
- **SECURITY INVOKER.** Everything it reads is already visible to the caller
  under existing RLS (own swipes/connections/settings, public profiles and
  `user_interests`, `cities`). No new definer surface. One pre-build check
  (§12-4): confirm `authenticated` still holds execute on
  `has_active_block` after the 2026-06-10 hardening.
- `appStore.fetchCandidates` collapses to one `supabase.rpc(…)` call; the
  `Profile` type gains the optional transparency fields; `DiscoveryIntro`
  consumes the same array it does today.

---

## 7. Discover surface changes (small by design)

- **"Why you're seeing them" chips** on the `ProfileCard`, between the header
  and the bio — at most one line, overlap first:
  `[ ✦ You both: AI/ML · Climbing ]  [ ◦ ~12 mi away ]`
  (distance rounded; "Same city" when centroids match; nothing renders when
  there's no signal — no fake reasons, that would break trust in the whole
  conceit).
- **Header hint:** under the Discover title, a quiet pressable line —
  *"Tuned by your algorithm ›"* → `/my-algorithm`. When the user has tuned
  nothing yet: *"Build your algorithm ›"*. This is the discovery loop for the
  feature itself.
- **New empty state** when `nearby_only` drains the queue: *"Your algorithm
  ran out of people near Austin."* with inline actions **"Widen radius"** and
  **"Show people everywhere"** (writes `discovery_settings` directly and
  refetches — recovery in one tap, without leaving Discover).
- Public profile (`PublicProfileDetail`) shows the person's interest chips,
  shared ones highlighted — consistent with chips existing because they're
  public (§11-D).

---

## 8. Backend changes

One migration file per concern, in order:

| # | Migration | Contents |
|---|---|---|
| 1 | `discover_algorithm_schema` | `cube`/`earthdistance` extensions; `cities` table + RLS; `profiles.city_id`; `interests.curated` column + `unique index on lower(name)`; `user_interests` + RLS + cap trigger; `discovery_settings` + RLS |
| 2 | `discover_algorithm_seeds` | 45 curated interests; GeoNames cities load (69,066 rows, bulk-loaded out-of-band — procedure documented in the migration file) |
| 3 | `discover_algorithm_rpcs` | `add_custom_interest`, `get_discover_candidates`; grants (`authenticated` only) |
| 4 | `extend_delete_user_for_algorithm` | `delete_user_and_relations` also clears `user_interests`, `discovery_settings` (rows cascade via FK, but the function's explicit-delete style stays consistent) |
| 5 | `grant_discover_algorithm_authenticated` | Table-level grants for the new tables — RLS policies don't confer privileges, and tables in this project get no default grants (found by smoke-testing the RPC as a demo user) |

No Edge Functions. No changes to `swipes`/`connections`/`notifications` or the
messaging layer. The §13.3 pass-expiry semantics move verbatim into the RPC.

---

## 9. Client changes by file

| File | Change |
|---|---|
| `src/screens/MyAlgorithm.tsx` (new) + `app/my-algorithm.tsx` (new) | The §3 surface: summary card, interest chips + custom-tag input, city typeahead, toggle + radius |
| `app/(tabs)/settings.tsx` | "My algorithm" row (tuning icon) above the danger zone |
| `src/store/appStore.ts` | `fetchCandidates` → RPC; new slices: `myInterests`, `discoverySettings`, `city` + their load/save actions; clear `candidates` on any algorithm edit |
| `src/services/supabase.ts` | `Profile` gains `city_id`/display + optional `shared_interests`, `distance_miles`, `is_nearby`; new `Interest`, `DiscoverySettings` types |
| `src/components/Card.tsx` (`ProfileCard`) | "Why" chips row (§7) |
| `src/screens/DiscoveryIntro.tsx` | Header hint line; nearby-only empty state with inline recovery actions |
| `src/screens/PublicProfileDetail.tsx` | Interest chips, shared highlighted |
| `src/screens/ProfileOnboarding.tsx` | Phase 3: interests + city step (§10) |

Copy register: "your algorithm," "tuned," "built" — never "filters,"
"preferences," or "settings" in user-facing text on these surfaces.

---

## 10. Phasing

1. **Phase 1 — Data + algorithm:** migrations 1–4, RPC-backed
   `fetchCandidates`, "why" chips on the card. *Ship: Discover is ranked and
   block-aware; nobody can tune it yet but shared chips already appear for
   seeded data.*
2. **Phase 2 — My Algorithm surface:** the screen, settings row, header hint,
   nearby-only empty state. *Ship: the actual feature.*
3. **Phase 3 — Onboarding step:** interests + city as one step before photo
   (skippable). Without it only motivated users feed the algorithm; with it
   the chips/ranking work from day one. Recommended, but independently
   shippable later.

1 and 2 must land in order; 3 floats.

## Out of scope (noted for compatibility)

- Device-GPS radius ("true nearby") — the schema is ready for it: add
  `profiles.geo_lat/geo_lng` later and the RPC swaps its coordinate source;
  nothing else changes.
- Industry/experience as tunable signals — natural v2 chips on the same
  screen; the scoring function is built to take more terms.
- Feed-style Discover (handshake spec §3 Option B) — this feature is its
  prerequisite; revisit once ranking is observed working.
- Push notification "3 new people match your algorithm" — retention lever,
  separate effort.

---

## 11. Locked Decisions (user-reviewed 2026-06-11)

| # | Decision | Locked call |
|---|---|---|
| A | "Nearby" definition | **Self-reported city + radius** (default 25 mi) — not string-equal city names |
| B | Interest vocabulary | **Curated list + free-form tags** |
| C | Interests' effect on Discover | **Rank boost** — never starves the queue; hard filtering is locality's job only |
| D | Interest visibility | **Public + shared-overlap chips** on Discover and profiles |

## 12. Provisional calls — how each resolved at build time (2026-06-12)

| # | Call | Resolution |
|---|---|---|
| 1 | Radius is a picker (10/25/50/100, default 25), not fixed | **Built as specced** — segmented control on the My Algorithm screen |
| 2 | SimpleMaps World Cities as the cities seed | **Changed → GeoNames cities5000** (same CC BY 4.0 license, ~69k rows): SimpleMaps blocks automated download behind Cloudflare. Attribution line lives at the bottom of the My Algorithm screen |
| 3 | Custom tags: no moderation queue in v1 | **Built as specced** — charset/length enforced in the RPC |
| 4 | Verify `has_active_block` execute grant for `authenticated` | **Verified** — grant intact after the hardening; the helper is also symmetric (checks both directions), so the RPC calls it once |
| 5 | Interest cap = 10 per user | **Built as specced** — before-insert trigger with a per-user advisory lock so concurrent inserts can't race past the count |
| 6 | Implicit save on the My Algorithm screen | **Built as specced** — every edit persists immediately, shows "Algorithm updated", and clears the cached candidate queue |
