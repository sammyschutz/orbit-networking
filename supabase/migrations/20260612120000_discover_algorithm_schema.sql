-- "My algorithm" discover customization — schema (zap-discover-algorithm-spec.md §8, migration 1).
-- Cities lookup + self-reported locality, interests vocabulary + per-user
-- selections, and per-user discovery settings. The ranking RPC lands in
-- 20260612122000_discover_algorithm_rpcs.sql.

-- Centroid-to-centroid distance math for the locality radius (spec §5.1).
create extension if not exists cube with schema extensions;
create extension if not exists earthdistance with schema extensions;

-- --------------------------------------------------
-- TABLE: cities — coordinates behind the self-reported city picker.
-- Seeded from the GeoNames cities5000 dataset (CC BY 4.0,
-- https://download.geonames.org/export/dump/cities5000.zip): every place with
-- population > 5,000 plus administrative seats, ~69k rows. The user's
-- coordinates are always a city centroid, never a device location.
-- --------------------------------------------------
create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,            -- "São Paulo" (display)
  ascii_name text not null,      -- "Sao Paulo" (typeahead matching for unaccented input)
  region text null,              -- alphabetic admin-1 codes only ("TX", "ENG")
  country text not null,         -- ISO-2 ("US")
  lat double precision not null,
  lng double precision not null,
  population int null            -- typeahead ranking
);

alter table public.cities enable row level security;

create policy cities_select_authenticated
  on public.cities for select
  to authenticated
  using (true);

-- Lookup data is read-only for clients; rows arrive via seed migrations.
revoke insert, update, delete on public.cities from anon, authenticated;

-- --------------------------------------------------
-- profiles.city_id — the self-reported city (public, like the rest of the
-- profile; the privacy story is "we only know the city you told us").
-- --------------------------------------------------
alter table public.profiles
  add column if not exists city_id uuid null references public.cities(id) on delete set null;

-- --------------------------------------------------
-- interests: mark the curated vocabulary apart from user-typed tags, and
-- dedupe case-insensitively so "climbing" and "Climbing" are one row.
-- Client write access stays revoked (20260611100000); custom tags go through
-- the add_custom_interest RPC.
-- --------------------------------------------------
alter table public.interests
  add column if not exists curated boolean not null default false;

create unique index if not exists interests_name_lower_key
  on public.interests (lower(name));

-- --------------------------------------------------
-- TABLE: user_interests — public selections (spec §11-D): they render on
-- profiles and power the shared-interest chips on Discover.
-- --------------------------------------------------
create table if not exists public.user_interests (
  user_id     uuid not null references auth.users(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, interest_id)
);

create index if not exists idx_user_interests_interest_id
  on public.user_interests (interest_id);

alter table public.user_interests enable row level security;

create policy user_interests_select_authenticated
  on public.user_interests for select
  to authenticated
  using (true);

create policy user_interests_insert_own
  on public.user_interests for insert
  to authenticated
  with check (user_id = auth.uid());

create policy user_interests_delete_own
  on public.user_interests for delete
  to authenticated
  using (user_id = auth.uid());

revoke update on public.user_interests from anon, authenticated;

-- 10-per-user cap (spec §4.3), enforced server-side. The advisory lock
-- serializes concurrent inserts for the same user so they can't race past
-- the count check.
create or replace function public.enforce_user_interest_cap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('user_interests_cap:' || new.user_id::text, 0)
  );
  if (select count(*) from user_interests where user_id = new.user_id) >= 10 then
    raise exception 'interest_cap_reached';
  end if;
  return new;
end;
$$;

create trigger user_interests_cap
  before insert on public.user_interests
  for each row execute function public.enforce_user_interest_cap();

-- --------------------------------------------------
-- TABLE: discovery_settings — owner-only: profiles is publicly selectable
-- and a user's filter tuning is nobody else's business (spec §5.2).
-- --------------------------------------------------
create table if not exists public.discovery_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nearby_only boolean not null default false,
  nearby_radius_miles int not null default 25
    check (nearby_radius_miles in (10, 25, 50, 100)),
  updated_at timestamptz not null default now()
);

alter table public.discovery_settings enable row level security;

create policy discovery_settings_select_own
  on public.discovery_settings for select
  to authenticated
  using (user_id = auth.uid());

create policy discovery_settings_insert_own
  on public.discovery_settings for insert
  to authenticated
  with check (user_id = auth.uid());

create policy discovery_settings_update_own
  on public.discovery_settings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke delete on public.discovery_settings from anon, authenticated;

create trigger discovery_settings_set_updated_at
  before update on public.discovery_settings
  for each row execute function public.set_updated_at();
