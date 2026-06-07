-- Supabase schema for Zap MVP
-- Run with `supabase db query --file supabase/schema.sql`

-- Enable UUID generation extension
create extension if not exists "pgcrypto";

-- --------------------------------------------------
-- TABLE: profiles
-- --------------------------------------------------
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  role_title text not null,
  industry text not null,
  experience_level text not null check (experience_level in ('student','early','mid','senior','founder')),
  bio text not null,
  photo_url text not null,
  timezone text null,
  ask_me_about text null,
  learning_about text null,
  side_project text null,
  is_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_profiles_user_id on profiles(user_id);
create index if not exists idx_profiles_industry on profiles(industry);
create index if not exists idx_profiles_experience_level on profiles(experience_level);

-- --------------------------------------------------
-- TABLE: swipes
-- --------------------------------------------------
create table if not exists swipes (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('like','pass')),
  created_at timestamptz not null default now(),
  constraint swipes_one_per_pair unique (from_user_id, to_user_id)
);
create index if not exists idx_swipes_from_user_id on swipes(from_user_id);
create index if not exists idx_swipes_to_user_id on swipes(to_user_id);

-- --------------------------------------------------
-- TABLE: connections
-- --------------------------------------------------
create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references auth.users(id) on delete cascade,
  user_b_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','connected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connections_different_users check (user_a_id <> user_b_id)
);
create index if not exists idx_connections_user_a_id on connections(user_a_id);
create index if not exists idx_connections_user_b_id on connections(user_b_id);
create unique index if not exists idx_connections_unique_pair on connections (
  least(user_a_id, user_b_id),
  greatest(user_a_id, user_b_id)
);

-- --------------------------------------------------
-- TABLE: notifications
-- --------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('incoming_interest','match')),
  source_user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_notifications_read_at on notifications(read_at);

-- --------------------------------------------------
-- OPTIONAL TABLE: interests
-- --------------------------------------------------
create table if not exists interests (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------
-- TRIGGERS: updated_at timestamp
-- --------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger update_connections_updated_at
  before update on connections
  for each row execute function set_updated_at();

-- --------------------------------------------------
-- RLS: profiles
-- --------------------------------------------------
alter table profiles enable row level security;

create policy profiles_select_public on profiles
  for select
  using (
    is_complete = true
    and auth.uid() is not null
    and auth.uid() <> user_id
  );

create policy profiles_select_own on profiles
  for select
  using (
    auth.uid() = user_id
  );

create policy profiles_insert_own on profiles
  for insert
  with check (
    auth.uid() = user_id
  );

create policy profiles_update_own on profiles
  for update
  using (
    auth.uid() = user_id
  )
  with check (
    auth.uid() = user_id
  );

-- --------------------------------------------------
-- RLS: swipes
-- --------------------------------------------------
alter table swipes enable row level security;

create policy swipes_insert_own on swipes
  for insert
  with check (
    auth.uid() = from_user_id
  );

create policy swipes_select_own on swipes
  for select
  using (
    auth.uid() = from_user_id
    or auth.uid() = to_user_id
  );

-- --------------------------------------------------
-- RLS: connections
-- --------------------------------------------------
alter table connections enable row level security;

create policy connections_select on connections
  for select
  using (
    auth.uid() = user_a_id
    or auth.uid() = user_b_id
  );

create policy connections_insert_no_client on connections
  for insert
  with check (false);

create policy connections_update_no_client on connections
  for update
  with check (false);

-- --------------------------------------------------
-- RLS: notifications
-- --------------------------------------------------
alter table notifications enable row level security;

create policy notifications_select on notifications
  for select
  using (
    auth.uid() = user_id
  );

create policy notifications_update_read on notifications
  for update
  using (
    auth.uid() = user_id
  )
  with check (
    auth.uid() = user_id
    and read_at is not null
  );

create policy notifications_insert_no_client on notifications
  for insert
  with check (false);
