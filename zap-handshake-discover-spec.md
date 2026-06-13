# Zap — Handshake Discover Revamp Specification

> **Status: IMPLEMENTED (2026-06-11).** All three phases shipped: introduction
> view (`DiscoveryIntro.tsx`), info-first `ProfileCard`, `ExtendHandButton` +
> `HandshakeOverlay`, "Hands extended to you" banner, public-profile responses,
> copy sweep, and the §7.1 migration (applied). Options below kept for context;
> final calls in **§10 Locked Decisions**.

---

## 1. Goal

Make discovery feel like **professional networking, not dating**. Three product
asks, treated as one coherent change:

1. **Replace the swipe gesture** — left/right swiping with LIKE/NOPE stamps
   reads as Hinge/Tinder, which undercuts Zap's positioning.
2. **Make "handshake" the core metaphor of connecting:**
   - an **extended-hand** moment when you express interest in someone, and
   - a **handshake** moment when the other person reciprocates and you connect.
3. **De-emphasize the profile photo** on Discover — today the photo is the
   entire card; the person's role, bio, and conversation prompt should lead.

---

## 2. What exists today (and the key insight)

| Surface | Current behavior |
|---|---|
| `src/screens/DiscoveryDeck.tsx` | Tinder-style deck: PanResponder drag, rotation, LIKE/NOPE stamps, ❤️/✕ gradient buttons, "It's a match!" toast |
| `src/components/Card.tsx` → `ProfileCard` | **Full-bleed photo** with a scrim; name/role/bio/prompt overlaid at the bottom |
| `submit_swipe(p_to_user_id, p_direction)` RPC | `like`/`pass`; mutual like → `connections` row + `match` notifications for both; one-way like → `incoming_interest` notification for the recipient |
| Candidate fetch (`appStore.fetchCandidates`) | Excludes `like` swipes permanently; `pass` swipes expire after 6 months (MVP spec §13.3) |
| `NotificationsBanner` | Shows **one** unread notification ("Someone wants to connect" / "New match") at the top of Discover |

**Key insight: the backend already implements the handshake model.** A one-way
like already notifies the recipient (`incoming_interest` = "a hand is extended
to you"); a reciprocal like already forms the connection (= "the handshake").
This revamp is therefore an **interaction, vocabulary, and presentation
change** — the data model, RLS posture, and `submit_swipe` flow survive almost
untouched (one small RPC fix, §7).

**DB vocabulary stays `like`/`pass`.** The handshake language lives in UI copy
and component names only. Renaming columns/RPC values would churn migrations,
the audit trail, and the messaging layer for zero user-visible gain.

---

## 3. Replacing swipe — the interaction decision (the big one)

### Options

| | Option A — "Introduction" view (recommended) | Option B — Vertical feed | Option C — Browse grid + detail |
|---|---|---|---|
| Shape | One profile at a time, **button-driven, no drag gesture** | Scrollable list of cards, extend-hand button on each | Compact grid; tap into full profile |
| Feel | Being *introduced* to one person; deliberate | LinkedIn-feed-like; low pressure | Directory-like |
| "Pass" semantics | Preserved exactly: "Maybe later" = today's `pass` (6-month expiry already built) | Fuzzy — scrolling past is not a recorded decision; needs impression tracking or profiles never leave the feed | Same fuzziness as B |
| Backend change | **None** | New ranking/impression model to keep the feed fresh | Same as B |
| Photo de-emphasis fit | Strong — one info-first card has room for bio/prompt | Medium — cards compete for scroll attention, get skimmed | **Poor — a grid is inherently photo-forward** |
| Hinge-distance | Structurally still card-by-card, but no gesture, no stamps, new card design + vocabulary make it read very differently | Maximum distance from swipe apps | Medium |

### Recommendation: **Option A**, with B as a future layer

- The "Hinge feeling" comes from the **gesture + stamps + photo-first card**,
  not from seeing one person at a time. Kill those three and the same
  one-at-a-time structure reads as "meet someone," which is the product's
  actual promise.
- A requires **zero backend change** — the existing candidate queue, pass
  expiry, and `submit_swipe` all keep working.
- One profile at a time gives the **extend-hand animation a stage** (§6); in a
  scrolling feed the animation has nowhere to live.
- A feed (B) only beats one-at-a-time when ranking is good. The
  **interests + locality algorithm is a separate planned feature** — revisit B
  after that exists, when there's something real to rank by.

### Option A interaction detail

- The deck's drag/PanResponder, rotation, and LIKE/NOPE stamps are **removed
  entirely** (delete, don't hide).
- Actions become two buttons under the card:
  - **Primary: "Extend a hand"** — wide gradient pill (brand gradient), hand
    icon. Triggers the extend-hand animation (§6.1), then `submit_swipe('like')`.
  - **Secondary: "Maybe later"** — quiet text/ghost button. Triggers
    `submit_swipe('pass')` with a subtle card-dismiss fade (no fling-off-screen).
  - Copy note: "Maybe later" is honest — passes really do expire after 6
    months, so the person can reappear. No ✕/NOPE iconography anywhere.
- Advancing to the next profile uses a gentle crossfade/slide-up
  (Reanimated layout transition), not a fling.
- **Drop the "N of M nearby" counter** (locked, §10-F): a cleaner header, and
  it avoids advertising a small pool while the user base is early. Revisit
  alongside the locality feature, when "nearby" means something real.

---

## 4. The handshake model — vocabulary and flows

| Concept | DB reality | User-facing language |
|---|---|---|
| You like someone | `swipes.direction = 'like'` | "You extended a hand to Alex" |
| Someone likes you | `incoming_interest` notification | "Alex extended a hand to you" |
| Mutual like | `connections` row, `match` notifications | **"You shook hands!"** — never "match" |
| Pass | `swipes.direction = 'pass'` | "Maybe later" |

### 4.1 Incoming hands become first-class

Today an incoming like surfaces as a single dismissible banner. Under the
handshake model an extended hand is a *social gesture awaiting a response* and
deserves more weight:

- **Upgrade `NotificationsBanner`** on Discover into an **"Hands extended to
  you"** row: avatar(s) + "2 people extended a hand" + chevron when more than
  one is pending (it currently shows only the single most recent unread).
- Tapping opens the existing `public-profile/[userId]` screen, where the
  responses are **"Shake hands"** (→ `submit_swipe('like')` → handshake moment
  §6.2) or **"Maybe later"** (→ `submit_swipe('pass')`).
- Declining must dismiss the pending notification — this needs the small RPC
  fix in §7.1, since today only the `like` path marks `incoming_interest` read.

### 4.2 The connect moment

Replace the current match **toast** with a **full-screen handshake overlay**
(§6.2). The toast ("It's a match! …") is dating-app language and far too small
for the product's single most important moment. Overlay CTA buttons:
**"Say hello"** (→ chat, the messaging layer is live) and **"Keep discovering"**.

---

## 5. De-emphasizing the photo — `ProfileCard` redesign

### Options

| | (a) Info-first card, avatar-sized photo (recommended) | (b) Photo lower half / below fold | (c) Blur photo until tap |
|---|---|---|---|
| Layout | Card on `surfaceCard` background; 72px avatar beside name/role header; bio + prompt are the hero | Top half text, bottom half photo | Full-bleed kept, blurred |
| Signal | "This is a professional profile" (LinkedIn-shaped) | Compromise; photo still dominates visually | Gimmicky; blur reads as NSFW-app pattern |
| Effort | Moderate (new layout, no full-bleed/scrim) | Low | Low |

### Recommendation: **(a)** — sketch:

```
┌────────────────────────────────────┐
│  ╭────╮   Jordan Lee               │   ← 72px Avatar (component exists),
│  │ 🙂 │   Product Designer         │     name 24–26pt
│  ╰────╯   Fintech · Early career   │   ← industry + experience pill inline
│ ──────────────────────────────────  │
│  Building design systems at a       │
│  payments startup. Ex-agency,       │   ← bio, 3–4 lines, PRIMARY text color
│  recovering perfectionist.          │     (vs. 2 scrim-squeezed lines today)
│                                     │
│  💬 Ask me about…                   │
│  ┌───────────────────────────────┐  │
│  │ Breaking into fintech design  │  │   ← prompt chip: the conversation
│  └───────────────────────────────┘  │     starter is the hero element
│                                     │
│        [photo strip — optional]     │   ← decision §10-D
└────────────────────────────────────┘
```

- Reuses the existing `Avatar` component (already handles missing-photo
  fallback with initials gradient — the giant 140pt fallback initial dies).
- Bio and "ask me about" gain room and real text colors instead of fighting a
  photo scrim. The prompt chip becomes the largest visual element after the
  name: **what you'd talk about** outranks **what they look like**.
- Tapping the card (or a "More" affordance) can open the full profile with
  larger photo — judging by photo is possible, just not the default.
- `ConnectionCard` and chat/inbox avatars are untouched; this redesign applies
  to the **Discover** `ProfileCard` only.

---

## 6. Animations

**Stack: Reanimated 4 (`react-native-reanimated@4.3.1`, already installed and
the documented animation library for Expo SDK 56).** Lottie no longer has a
page in the SDK 56 docs and would add an asset pipeline for two animations;
build these with Reanimated `withSequence`/`withSpring` + static hand assets
(emoji `🤝`/`👋` for v1, swappable for custom SVGs later). Emoji is also
deliberately **brand-neutral** — a rebrand away from the "Zap" name is under
consideration, so the connect moment must not hinge on the ⚡ motif (the spark
burst in §6.2 step 2 is decorative and trivially swappable). Add `expo-haptics`
(`npx expo install expo-haptics`) for tactile feedback — not currently
installed.

### 6.1 Extend-hand (on "Extend a hand" tap)

~700 ms, plays **before** the card advances; `submit_swipe` fires concurrently:

1. Button compresses (scale 0.95, ~80 ms) — light haptic.
2. A hand (`👋`) springs from the button toward the card's avatar
   (translateY + slight arc, `withSpring`), trailing a brand-gradient streak.
3. Hand reaches the avatar, holds a beat (~150 ms), fades.
4. Card crossfades to the next profile; brief "Hand extended to Jordan ✋"
   inline confirmation where the buttons sit.

### 6.2 Handshake (on connect)

Full-screen overlay (`Modal`/absolute-fill), ~1.6 s before CTAs appear:

1. Dimmed brand-gradient backdrop fades in; both users' avatars settle
   top-center (yours slides from left, theirs from right, `withSpring`).
2. Two hands enter from opposite edges and **meet in the center**; on contact:
   medium haptic + a small zap/spark burst (the brand ⚡, scale+fade particles).
3. Joined hands (`🤝`) do 2–3 shake cycles (`withSequence` rotation ±8°).
4. **"You shook hands!"** + "You and Jordan are now connected" + CTAs:
   **Say hello** / **Keep discovering**.

Triggered wherever a connect can happen: Discover (you complete someone else's
handshake) and the public-profile "Shake hands" response (§4.1). Replaces the
match toast in both.

Honor OS reduced-motion (`useReducedMotion` from Reanimated): skip 6.1, render
6.2 as a static card.

---

## 7. Backend changes (deliberately tiny)

### 7.1 `submit_swipe`: dismiss `incoming_interest` on pass — **the one real fix**

Today only the `like` branch marks the actor's pending `incoming_interest` from
the target as read. If Alex extends a hand and you **decline** ("Maybe later"),
your "Alex wants to connect" notification stays unread forever — under §4.1
that means a zombie entry in "Hands extended to you." New migration, inside the
`p_direction = 'pass'` case:

```sql
update public.notifications
set read_at = coalesce(read_at, now())
where user_id = v_from_user_id
  and source_user_id = p_to_user_id
  and type = 'incoming_interest'
  and read_at is null;
```

### 7.2 Everything else: no change

`swipes`, `connections`, `notifications` schemas, RLS, the candidate query, and
the messaging layer are untouched. No new tables, no Edge Functions.

---

## 8. Client changes by file

| File | Change |
|---|---|
| `src/screens/DiscoveryDeck.tsx` | Becomes `DiscoveryIntro.tsx` (or rewritten in place): delete PanResponder/stamps/fling; button-driven advance; mount handshake overlay; "Hands extended to you" row |
| `src/components/Card.tsx` (`ProfileCard`) | Info-first redesign (§5); full-bleed photo + scrim removed on Discover |
| `src/components/HandshakeOverlay.tsx` (new) | Full-screen connect moment (§6.2) |
| `src/components/ExtendHandButton.tsx` (new) | Primary CTA + extend-hand animation (§6.1) |
| `src/components/NotificationsBanner.tsx` | Upgrade to "Hands extended to you" row with pending count (§4.1) |
| `src/screens/PublicProfileDetail.tsx` | "Shake hands" / "Maybe later" responses; trigger handshake overlay on connect |
| `src/store/appStore.ts` | No structural change; `submitSwipe` signature stays. Audit all user-facing match/like copy |
| New migration | §7.1 |

Copy sweep: grep for "match", "like", "It's a match" across screens — the words
should not survive anywhere user-visible (DB/internal identifiers keep them).

---

## 9. Phasing

1. **Phase 1 — Card + interaction (the de-Hinge-ing):** `ProfileCard` redesign,
   gesture removal, "Extend a hand"/"Maybe later" buttons, copy sweep,
   §7.1 migration. *Ship: discovery no longer resembles a dating app even with
   zero animation.*
2. **Phase 2 — Handshake moments:** `HandshakeOverlay`, `ExtendHandButton`
   animation, haptics, reduced-motion.
3. **Phase 3 — Incoming hands surface:** banner → pending-hands row,
   public-profile shake/decline responses.

Each phase is independently shippable; 2 and 3 can swap order.

## Out of scope (separate efforts, noted for compatibility)

- **Interests + locality ranking** — orthogonal: it reorders the candidate
  queue this spec consumes. Also the gate for revisiting feed-style discovery
  (§3, Option B).
- **LinkedIn connect button** post-handshake — independent quick win on the
  connection/chat surface.

---

## 10. Locked Decisions (reviewed 2026-06-11)

| # | Decision | Locked call |
|---|---|---|
| A | Interaction model | **Option A** — one-at-a-time "introduction" view, button-driven, gesture deleted |
| B | Photo treatment | **(a)** info-first card with 72px avatar; full photo one tap away |
| C | Hand art | **Emoji v1** (`👋`/`🤝`) — also brand-neutral given a possible rename (§6) |
| D | Small photo strip at card bottom? | **No** — avatar only |
| E | Decline copy | **"Maybe later"** (matches the real 6-month pass expiry) |
| F | "N of M nearby" counter | **Dropped** — revisit with the locality feature |
