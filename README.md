# Orbit

A casual, swipe-based **networking** app for people who want to explore careers, meet professionals outside their field, and have low-pressure conversations — without the LinkedIn formality. Swipe through career snapshots, connect on mutual interest, and chat through a safety-first messaging layer.

Built with **React Native + Expo (SDK 56)** and **Supabase** (Postgres, Auth, Storage, Realtime, Edge Functions).

---

## Features

- **Swipe-based discovery** — a card deck of career profiles; swipe right to show interest, left to pass.
- **Mutual-interest connections** — two right-swipes create a connection; one-sided interest surfaces as a pending notification.
- **Profiles** — photo, role, industry, experience level, bio, and prompts ("Ask me about", "I'm learning about", "My side project").
- **Safe 1:1 messaging** — instant chat between connected users, with every message routed through a server-side safety gateway.
- **Safety first-class** — block & report from the chat surface, profanity/abuse filtering, rate limiting, and an append-only audit log.
- **Realtime delivery** — messages and notifications push to the client via Supabase Realtime (RLS-filtered per user).

---

## Tech stack

| Layer | Choice |
|---|---|
| Mobile | React Native `0.85`, Expo SDK `56`, Expo Router (typed routes) |
| State | Zustand |
| Backend | Supabase — Postgres + RLS, Auth, Storage, Realtime |
| Server logic | Supabase Edge Functions (Deno / TypeScript) |
| Language | TypeScript |

> ⚠️ This project targets **Expo SDK 56**, which introduced breaking changes. Always check the versioned docs at <https://docs.expo.dev/versions/v56.0.0/> before adding or upgrading code.

---

## Architecture

### App (`app/` + `src/`)

Expo Router drives navigation. On launch, `app/_layout.tsx` checks the Supabase session and routes to **auth → onboarding → tabs** depending on session and profile-completion state.

```
app/
  _layout.tsx              Root stack + session-based routing
  auth.tsx                 Sign in / sign up
  onboarding.tsx           Profile creation gate
  (tabs)/
    index.tsx              Discovery deck
    connections.tsx        Mutual connections
    messages.tsx           Conversations list
    settings.tsx           Account & safety settings
  chat/[id].tsx            1:1 chat
  connection/[id].tsx      Connection detail
  public-profile/[userId]  Read-only profile view

src/
  components/              Avatar, Button, Card, TextInput, SafetyMenu, …
  screens/                 Screen implementations
  services/supabase.ts     Supabase client + shared types + Edge Function helper
  store/appStore.ts        Zustand app state
  hooks/useAuth.ts         Auth helpers
  constants/theme.ts       Design tokens
```

### Backend (`supabase/`)

Writes are **server-mediated**. Sensitive tables (`connections`, `notifications`, `messages`) lock client inserts via RLS (`with check (false)`); all mutations flow through `security definer` RPCs (e.g. `submit_swipe`) or Edge Functions. Clients **read** their own rows directly, protected by RLS.

```
supabase/
  migrations/              Forward-only SQL migrations (schema, RLS, RPCs, cron)
  functions/
    send-message/          Safety gateway: authn → authz → block → rate-limit → filter → write → audit
    block-user/            Block a user
    unblock-user/          Remove a block
    report-user/           File a report (categories shared with the client)
    delete-account/        Verifies caller, deletes user + relations (service role)
    _shared/safety/        normalize, denylist, abuse, rateLimit, audit, constants
```

**Messaging safety flow** — the client never writes to `messages`. A send goes `client → send-message Edge Function → DB`:

1. Verify JWT → `sender_id`
2. Authorize (connection exists and is `connected`)
3. Block check (either side blocked?)
4. Rate limit (sliding window)
5. Content safety (profanity / abuse)
6. Write message (service role)
7. Append audit-log row (always)

Delivery back to the recipient is push via Supabase Realtime on the `messages` table, RLS-filtered.

---

## Getting started

### Prerequisites

- Node.js 18+ and npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for backend/migrations)
- Expo Go on a device, or an iOS/Android simulator

### 1. Install

```bash
npm install
```

### 2. Configure environment

Create `.env.local` in the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
EXPO_PUBLIC_SUPABASE_BUCKET=profile-photos
SUPABASE_PROJECT_REF=<your-project-ref>
```

Only `EXPO_PUBLIC_*` vars are exposed to the app. The service-role key is used **only** by Edge Functions and is set via Supabase secrets — never put it in the client.

### 3. Set up the backend

```bash
# Link to your Supabase project
supabase link --project-ref <your-project-ref>

# Apply schema, RLS, and RPCs
supabase db push

# Deploy the Edge Functions
supabase functions deploy send-message
supabase functions deploy block-user
supabase functions deploy unblock-user
supabase functions deploy report-user
supabase functions deploy delete-account
```

You also need a Storage bucket named `profile-photos` (created by migration; verify in the dashboard) and Email/Password auth enabled.

### 4. Run the app

```bash
npm start        # Expo dev server (press i / a / w)
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # web
```

---

## Database & migrations

Migrations are the source of truth — **forward-only**, never edit a pushed file. See [`supabase/README.md`](supabase/README.md) for the full workflow.

```bash
supabase migration new <descriptive_name>   # scaffold a migration
supabase db push                            # apply pending migrations
supabase migration list                     # verify status
```

Core tables: `profiles`, `swipes`, `connections`, `notifications`, `conversations`, `messages`, `blocks`, plus the safety audit log.

---

## Testing

The safety module has unit tests (Deno):

```bash
deno test supabase/functions/_shared/safety/
```

---

## Project specs

Design and product context live alongside the code:

- [`zap-mvp-spec.md`](zap-mvp-spec.md) — product + MVP technical spec
- [`zap-mvp-setup.md`](zap-mvp-setup.md) — Supabase + app setup checklist
- [`zap-safe-messaging-spec.md`](zap-safe-messaging-spec.md) — safe messaging architecture (decisions locked)
- [`design-system/MASTER.md`](design-system/MASTER.md) — colors, typography, components

---

## License

MIT
