# Zap MVP Setup and Implementation Plan

## 1. What this is

This file turns the previous specs into a concrete MVP implementation plan and Supabase setup checklist. It is intended to get the app from spec into a working foundation.

---

## 2. Recommended implementation stack

- Mobile: `React Native` with `Expo`
- Backend service: `Supabase`
- Custom business logic: `TypeScript` via Supabase Edge Functions or Node.js if needed
- Storage: Supabase Storage for profile photos
- Database: Supabase Postgres with RLS policies

---

## 3. Supabase setup checklist

### 3.1 Create the Supabase project

1. Create a new Supabase project.
2. Note the project URL and anon/public key.
3. Create a service role key for secure server-side logic if you will use Edge Functions or a trusted backend.

### 3.2 Configure Auth

1. Enable Email/Password authentication.
2. Optionally enable OAuth providers later (Google, Apple).
3. Configure redirect URLs if using web-based auth flows.

### 3.3 Create Storage bucket

1. Create a bucket named `profile-photos`.
2. Set access to private if you want signed URLs, or public if you prefer simple profile images.
3. Make sure the mobile app uploads files to this bucket and saves the returned URL in the profile record.

### 3.4 Create database schema

Create the following tables in Supabase SQL editor or using the table editor:

- `profiles`
- `swipes`
- `connections`
- `notifications`
- Optional: `interests`

Use the implementation-ready schema from `zap-mvp-implementation-spec.md` as the exact table definition.

### 3.5 Enable Row-Level Security (RLS)

Turn on RLS for all user-facing tables:
- `profiles`
- `swipes`
- `connections`
- `notifications`

Define policies using `auth.uid()` as described in the implementation spec.

### 3.6 Add RLS policies

Implement policies for each table:

- `profiles`
  - allow users to insert/update their own profile
  - allow users to select only completed public profiles for discovery
  - allow users to select their own profile record

- `swipes`
  - allow insert for the current user only
  - allow select for the current or target user

- `connections`
  - allow select only for users who are part of the connection
  - create connections through safe server-side logic rather than direct client inserts

- `notifications`
  - allow select only for the recipient
  - allow update of `read_at` by the recipient
  - allow insert only through trusted server-side logic or Edge Functions

### 3.7 Add helper functions / Edge Functions

For MVP, use one or more of these to keep client logic simple and safe:

- `processSwipe` / `handleSwipe` function
  - insert swipe record
  - detect reciprocal like
  - create connection record on mutual like
  - create pending interest notification on one-sided like
  - create match notifications when mutual
- `fetchDiscoveryCandidates`
  - return candidate profiles excluding swiped or connected users
  - optionally apply simple diversity rules
- `markNotificationRead`
  - update `read_at`

### 3.8 Realtime configuration (optional)

- Use Supabase realtime on `notifications` if you want live updates.
- For MVP, in-app fetch-on-open plus manual refresh is sufficient.

---

## 4. Mobile app setup checklist

### 4.1 Install prerequisites

- Node.js 18+ or latest stable
- `npm` or `yarn`
- `expo-cli` or `npx expo`

### 4.2 Create the app

1. `npx create-expo-app zap-app`
2. Install dependencies:
   - `@supabase/supabase-js`
   - `react-navigation` and dependencies
   - swipe UI library such as `react-native-deck-swiper` or custom animated cards
   - `expo-image-picker` or equivalent for photo upload

### 4.3 Configure Supabase client

Set up environment variables for:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_BUCKET=profile-photos`

### 4.4 Build screens in this order

1. Auth screen
2. Profile onboarding screen
3. Photo upload and prompt screen
4. Discovery / swipe deck screen
5. Notifications/interest banner screen
6. Connections list screen

### 4.5 Implement app flows

- Initialize user session and profile state on app launch
- Force onboarding if profile is incomplete
- Request candidate profiles from Supabase
- Record swipes and handle server responses
- Show incoming interest notifications on app open
- Show connections when mutual match occurs

---

## 5. Required Supabase project values

When connecting your mobile app, you need:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for secure server-side or Edge Functions only)
- `PROFILE_PHOTOS_BUCKET` name
- Table names and policies defined exactly as in the spec

---

## 6. What I need from you to proceed

To move from this plan into actual implementation, provide:
- your Supabase project URL
- your Supabase anon/public key
- whether the `profile-photos` bucket is private or public
- whether you want to use Supabase Edge Functions or a small Node/TypeScript backend

If you want, I can next generate the SQL and policy statements for Supabase setup and then a first-pass Expo project structure with file names and feature responsibilities.

---

## 7. Suggested next step

Start by completing the Supabase setup checklist above, then confirm:
- table creation is done
- RLS policies are in place
- bucket exists and upload works
- Auth is enabled

Once that is done, I can generate the exact SQL and app scaffolding for the Zap MVP.
