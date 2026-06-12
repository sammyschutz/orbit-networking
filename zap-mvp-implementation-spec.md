# Zap MVP Implementation-Ready Specification

## 1. Scope and assumptions

### MVP scope
- User authentication via Supabase Auth
- User profile creation with photo, role, industry, bio, and prompts
- Swipe-based discovery with right/left actions
- Pending interest notification when one user likes another
- Mutual likes create a connection
- Connections list screen

### Assumptions
- Mobile app built with React Native + Expo
- Backend uses Supabase for Auth, Postgres, Storage, RLS, and Edge Functions
- Notifications are in-app on open and may later become push notifications
- No chat in MVP
- No advanced matching algorithm beyond simple filtering by unseen users and optional diversification

---

## 2. Data model

### 2.1 Table: profiles

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `user_id` UUID UNIQUE NOT NULL REFERENCES `auth.users(id)`
- `display_name` TEXT NOT NULL
- `role_title` TEXT NOT NULL
- `industry` TEXT NOT NULL
- `experience_level` TEXT NOT NULL -- values: `student`, `early`, `mid`, `senior`, `founder`
- `bio` TEXT NOT NULL
- `photo_url` TEXT NOT NULL
- `timezone` TEXT NULL
- `ask_me_about` TEXT NULL
- `learning_about` TEXT NULL
- `side_project` TEXT NULL
- `is_complete` BOOLEAN NOT NULL DEFAULT false
- `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
- `updated_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

Indexes:
- `idx_profiles_user_id` on `user_id`
- `idx_profiles_industry` on `industry`
- `idx_profiles_experience_level` on `experience_level`

### 2.2 Table: swipes

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `from_user_id` UUID NOT NULL REFERENCES `auth.users(id)`
- `to_user_id` UUID NOT NULL REFERENCES `auth.users(id)`
- `direction` TEXT NOT NULL CHECK (`direction` IN ('like', 'pass'))
- `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

Constraints:
- Unique constraint on (`from_user_id`, `to_user_id`)

Indexes:
- `idx_swipes_from_user_id` on `from_user_id`
- `idx_swipes_to_user_id` on `to_user_id`

### 2.3 Table: connections

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `user_a_id` UUID NOT NULL REFERENCES `auth.users(id)`
- `user_b_id` UUID NOT NULL REFERENCES `auth.users(id)`
- `status` TEXT NOT NULL CHECK (`status` IN ('pending', 'connected'))
- `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
- `updated_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

Constraints:
- Unique constraint on least/greatest pair to avoid duplicates

Indexes:
- `idx_connections_user_a_id` on `user_a_id`
- `idx_connections_user_b_id` on `user_b_id`

### 2.4 Table: notifications

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `user_id` UUID NOT NULL REFERENCES `auth.users(id)`
- `type` TEXT NOT NULL CHECK (`type` IN ('incoming_interest', 'match'))
- `source_user_id` UUID NOT NULL REFERENCES `auth.users(id)`
- `payload` JSONB NULL
- `read_at` TIMESTAMP WITH TIME ZONE NULL
- `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

Indexes:
- `idx_notifications_user_id` on `user_id`
- `idx_notifications_read_at` on `read_at`

### 2.5 Optional table: interests

- `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
- `name` TEXT NOT NULL UNIQUE
- `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

Use this only if implementing tag-based discovery or prompts.

---

## 3. Supabase row-level security and policies

### 3.1 General setup
- Enable RLS on `profiles`, `swipes`, `connections`, and `notifications`
- Use `auth.uid()` for current user context

### 3.2 `profiles` policies
- `SELECT`: allow if `is_complete = true` and row user is not the current user
- `INSERT`: allow if `auth.uid()` matches `user_id`
- `UPDATE`: allow if `auth.uid()` matches `user_id`
- `SELECT own profile`: allow if `auth.uid()` matches `user_id`

### 3.3 `swipes` policies
- `INSERT`: allow if `auth.uid()` = `from_user_id`
- `SELECT`: allow if `auth.uid()` is `from_user_id` or `to_user_id`
- Do not allow update or delete in MVP except admin

### 3.4 `connections` policies
- `INSERT`: allow only via Edge Function or server-side helper, not directly by clients unless safe rules are applied
- `SELECT`: allow if `auth.uid()` in (`user_a_id`, `user_b_id`)
- `UPDATE`: allow only via server-side helper for status changes

### 3.5 `notifications` policies
- `INSERT`: allow only server-side / Edge Function
- `SELECT`: allow if `auth.uid()` = `user_id`
- `UPDATE`: allow if `auth.uid()` = `user_id` and updating `read_at`

---

## 4. API contract

### 4.1 Authentication

Endpoint: Supabase Auth
- Sign up with email/password
- Login with email/password
- Refresh session handled by Supabase client

### 4.2 Profile

Create/update profile
- Method: `POST` / `PATCH`
- Request body:
  - `display_name`
  - `role_title`
  - `industry`
  - `experience_level`
  - `bio`
  - `photo_url`
  - `timezone` (optional)
  - `ask_me_about` (optional)
  - `learning_about` (optional)
  - `side_project` (optional)
- Response: profile object

Fetch own profile
- Method: `GET`
- Response: own profile object

Fetch public profile by id
- Method: `GET /profiles/:id`
- Response: profile object if `is_complete = true`

### 4.3 Photo upload

- Upload to Supabase Storage `profile-photos` bucket
- Generate signed URL or use public bucket policy for photos
- Save resulting `photo_url` to profile record

### 4.4 Discovery feed

Fetch next candidate profiles
- Method: `GET /discovery?limit=20`
- Response: ordered list of candidate profile objects

Candidate selection rules
- Exclude: current user, users with existing `swipes` from current user, users already connected
- Include only `profiles.is_complete = true`
- Optional diversity: add a soft sort to prefer different industries or new users

### 4.5 Swipe action

Submit swipe
- Method: `POST /swipes`
- Request body:
  - `to_user_id`
  - `direction` (`like` or `pass`)
- Response:
  - `swipe` object
  - if `direction = 'like'` and reciprocal like exists, return `match: true`

Processing rules
- Always create a `swipes` record for user-target pair
- If reciprocal `like` exists, create a `connections` record and a `match` notification for both users
- If not reciprocal, create a pending interest notification for `to_user_id`

### 4.6 Notifications

Fetch notifications
- Method: `GET /notifications?unread=true`
- Response: list of notifications for user

Mark notification read
- Method: `PATCH /notifications/:id`
- Request body:
  - `read_at` timestamp
- Response: notification object

### 4.7 Connections

Fetch connections list
- Method: `GET /connections`
- Response: list of connected profiles

Fetch connection details
- Method: `GET /connections/:id`
- Response: connection object and paired profile data

---

## 5. Application screens and flows

### 5.1 Onboarding

1. Welcome / auth screen
2. Profile creation screen
3. Photo upload screen
4. Prompt fields screen
5. Completion screen and enter discovery

### 5.2 Discovery / swipe flow

- Swipe deck displays one profile at a time
- Card contains photo, name, role, industry, bio, and prompt lines
- Actions:
  - swipe right / tap like
  - swipe left / tap pass
- After each swipe, load next profile card
- If user finishes current batch, show "No more profiles" message

### 5.3 Pending interest notification flow

- When user opens the app, fetch unread `incoming_interest` notifications
- Show a brief banner or inbox item: "Someone wants to connect"
- Allow user to view the source profile or continue swiping
- If the other user also likes back, upgrade notification to `match`

### 5.4 Match and connections flow

- When mutual interest occurs:
  - create connection record with `status = connected`
  - create `match` notifications for both users
- Show matches in connection list
- Optional badge or count indicator on connections screen
- Provide a way to view matched profile details from connections list

### 5.5 Connection list screen

- Show tiles for each connected profile
- Display name, role, industry, and last match date
- Tap to open profile details
- Show “new match” indicator for recent connections

---

## 6. Acceptance criteria

### 6.1 Auth and profile
- Users can sign up and log in
- New users must create a complete profile before discovery
- Profile fields are validated and persisted

### 6.2 Discovery and swipes
- Users can swipe right and left on profiles
- Users never see the same candidate twice
- Left swipes are recorded and excluded from future discovery
- Right swipes create pending interest if not reciprocated

### 6.3 Pending interest and match
- When user A likes user B, user B receives an `incoming_interest` notification on app open
- When user B likes user A back, both users receive a `match` notification and a connection is created
- Connections appear in the connections list

### 6.4 Security
- Users can only access their own private data
- Users can only see public profile records for discovery
- Users can only read their own notifications

---

## 7. Implementation notes

### 7.1 Recommended frontend architecture
- Use Expo with React Navigation
- Use Supabase JS client for auth, database, storage, and realtime
- Centralize current user state and profile state
- Use a swipe deck library or custom animated card stack
- Prefetch the next set of profiles for smooth swiping

### 7.2 Notification strategy
- In-app only for MVP; fetch on app start and refresh manually
- Use Supabase realtime or polling later for live notification updates
- Store `incoming_interest` notifications until they are read or match is created

### 7.3 Edge function / server responsibilities
- Create connections safely when mutual likes occur
- Insert notifications for pending interest and match events
- Optionally expose secure endpoints for discovery logic and custom business rules

---

## 8. Suggested implementation backlog

1. Setup Supabase project and Auth
2. Implement `profiles` table and profile onboarding flow
3. Implement `swipes` table and swipe action recording
4. Implement pending interest logic and notifications table
5. Implement `connections` creation on mutual likes
6. Build discovery feed and swipe deck UI
7. Build notifications screen / banner on app open
8. Build connections list screen
9. Apply RLS policies and validate access rules
10. Test end-to-end user flow
