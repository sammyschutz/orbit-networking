# Zap MVP Technical Specification

## 1. Product summary

Zap is a casual, swipe-based networking app for people who want to explore careers, meet professionals outside their field, and learn without LinkedIn pressure. The MVP should feel light, familiar, and focused on quick connection discovery rather than job hunting.

---

## 2. MVP goals

- Enable fast profile discovery with swipe gestures
- Let people share a simple career snapshot + interests
- Make connections feel low-pressure and exploratory
- Use Supabase for auth, user data, image storage, and realtime support
- Deliver a mobile-first experience on iOS/Android

---

## 3. Target users

- Early-career professionals curious about other fields
- Career changers and students exploring options
- People who want informal career conversations
- Anyone who feels siloed by their current role or network

---

## 4. Core MVP features

### 4.1 Authentication

- Email/password signup and login
- Optional social OAuth later (Google/Apple)
- Basic onboarding flow after signup

### 4.2 Profile

- Photo
- Display name / preferred name
- Current role / title
- Industry / career field
- Short bio (“What I’m curious about”)
- Career experience level (student, early, mid, senior, founder, etc.)
- Optional location / timezone
- One or two quick prompts:
  - “Ask me about”
  - “I’m learning about”
  - “My side project”

### 4.3 Discovery / swipe deck

- Swipe right = interested
- Swipe left = pass
- Profile card view with photo + key info
- Minimal friction on the first visit
- Show people who are likely to be interesting, not just same field

### 4.4 Connection matching

- Mutual interest creates a “connection”
- If both users swipe right, they become connected
- When one user swipes right, the other user receives a pending interest notification the next time they open the app
- Pending interest is surfaced before a match is confirmed, so users know someone wants to connect
- Connection state is the first step toward messaging later

### 4.5 Simple connection feed

- A screen listing mutual connections
- Ability to revisit matched profiles
- Option to send a brief “hello” message later

---

## 5. Product flow

### User journey

1. Open app
2. Sign up / login
3. Complete profile onboarding
4. Enter discovery feed
5. Swipe on profiles
6. When mutual interest occurs, add to connections
7. View connection list

### Swipe rules

- Only show users who:
  - are not already swiped on
  - are not already connected
  - are age/location filtered if applicable
- Prefer diversity of industries for casual exploration
- Keep it lightweight: no heavy matching algorithm for MVP

---

## 6. Supabase backend design

### 6.1 Services used

- Auth
- Postgres database
- Storage for profile photos
- Row Level Security (RLS)
- Realtime / subscriptions (future chat / live updates)
- Edge functions (optional for notifications or custom logic)

### 6.2 Data model

Recommended tables:

- `users`
  - Supabase-managed auth user record
  - profile completion metadata
  - visibility flags

- `profiles`
  - `user_id`
  - `display_name`
  - `role_title`
  - `industry`
  - `experience_level`
  - `bio`
  - `photo_url`
  - `timezone`
  - `connected_since`
  - interest prompts

- `swipes`
  - `id`
  - `from_user_id`
  - `to_user_id`
  - `direction` (`like` or `pass`)
  - `created_at`

- `connections`
  - `id`
  - `user_a_id`
  - `user_b_id`
  - `created_at`
  - `status` (`connected`, future: `pending`, etc.)

- `notifications` (optional)
  - `id`
  - `user_id`
  - `type` (`incoming_interest`, `match`, etc.)
  - `source_user_id`
  - `payload`
  - `created_at`
  - `read_at`

- `interests` / `skills` (optional lookup)
  - reusable tags for prompts / discovery filtering

### 6.3 Business rules

- On swipe right:
  - create `swipes` record
  - if reciprocal swipe exists, create `connections`
- On swipe left:
  - create `swipes` record to avoid repeat
- Only surface profiles where `photo_url` exists and onboarding is complete
- Enforce one swipe per target per user

### 6.4 Security

- Enable RLS on all tables
- Allow row access:
  - users see their own `profiles`
  - users insert `swipes`
  - users read candidate profiles via a safe view
  - users read `connections` only when involved
- Protect storage so profile photos are accessible only through signed URLs or public profile rules
- Avoid exposing raw user email/identifiers in discovery queries

---

## 7. Mobile architecture

### 7.1 Platform choice

- Cross-platform mobile for speed of delivery
- Primary recommendation: **React Native + Expo**
  - Fastest MVP path
  - Rich swipe and mobile UI ecosystem
  - Easy Supabase integration with `@supabase/supabase-js`
  - Shared code across iOS and Android
- Secondary option: **Flutter**
  - Strong UI consistency
  - Good performance and native feel

### 7.2 Backend language and service

- Primary backend: **Supabase** for auth, database, storage, and realtime
- Custom backend/code: **TypeScript**
  - Best fit for Supabase Edge Functions
  - Reuse language across mobile and backend helpers
  - Easy notification and custom logic implementation
- Alternative backend option: **Node.js / TypeScript** for a standalone backend if needed

### 7.3 App structure

- Authentication module
- Profile onboarding module
- Discovery/swipe module
- Connections module
- Shared networking / Supabase client

### 7.3 UI behavior

- Card-based swipe stack
- Profile card reveals:
  - image
  - headline
  - industry
  - one-line prompt
- Bottom action buttons:
  - pass
  - like
- Simple toast/snackbar for “Liked” and “Passed”
- Connected state indicator on connection screen

---

## 8. API / backend interaction

### 8.1 Essential operations

- Sign up / login via Supabase Auth
- Create or update user profile
- Upload profile photo
- Fetch next batch of candidate profiles
- Submit swipe action
- Query inbound pending interests and show notifications when the user opens the app
- Query matches/connections
- Query own profile / onboarding status

### 8.2 Discovery query behavior

- Provide next N profiles not yet swiped
- Optionally prioritize:
  - different industries
  - similar experience levels
  - new users first

---

## 9. Non-functional requirements

- Fast initial load
- Smooth swipe animation and instant feedback
- Minimal onboarding steps
- Responsive design to mobile screens
- Data consistency in swipe/match state
- Privacy-first defaults
- Stable offline tolerance for small UI states (optional)

---

## 10. MVP acceptance criteria

### Working

- Users can create an account and sign in
- Users can build a profile with image and career info
- Users can swipe on other profiles
- Mutual swipes become connections
- Users can view a connection list
- Supabase stores profile, swipe, and connection data securely

### Measurable

- Onboarding completion rate
- Swipe interactions per session
- Match creation events
- Profile discovery volume

---

## 11. Future enhancements (post-MVP)

- In-app chat / quick message
- Smart discovery filters by industry, topic, location
- Optional “learn request” prompt
- Social login
- Profile prompts / badges for “open to mentor”
- Analytics dashboard
- Push notifications for matches
- Topic-based rooms or networking events

---

## 12. Next steps for spec-driven development

1. Finalize user stories for auth, profile creation, discovery, and matches
2. Define UI screens and flows for onboarding / swipe experience
3. Draft database schema and Supabase policy spec
4. Create a prioritized MVP backlog
5. Estimate work per feature and split into development slices
