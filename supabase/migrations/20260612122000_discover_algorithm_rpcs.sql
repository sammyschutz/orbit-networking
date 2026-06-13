-- "My algorithm" — RPCs (zap-discover-algorithm-spec.md §8, migration 3).

-- --------------------------------------------------
-- add_custom_interest: the only write path into interests (clients keep zero
-- direct write access — the 20260611100000 revoke stands). Normalizes, then
-- upserts case-insensitively so "climbing" in any case returns the existing
-- row instead of a duplicate. Display case is stored as first typed.
-- --------------------------------------------------
create or replace function public.add_custom_interest(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Trim and collapse internal whitespace.
  v_name := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');

  if char_length(v_name) < 2 or char_length(v_name) > 30 then
    raise exception 'interest_name_length';
  end if;
  -- Letters / digits / space / & + - / ' only (spec §4.2).
  if v_name !~ '^[[:alpha:][:digit:]&+/'' -]+$' then
    raise exception 'interest_name_charset';
  end if;

  insert into interests (name, curated)
  values (v_name, false)
  on conflict (lower(name))
  do update set name = interests.name  -- no-op so RETURNING yields the row
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.add_custom_interest(text) from public, anon;
grant execute on function public.add_custom_interest(text) to authenticated;

-- --------------------------------------------------
-- get_discover_candidates: candidate selection + ranking (spec §6). Replaces
-- the client's three-query fetch, and retires two latent problems with it:
-- the `not in (…)` URL that grew with every swipe, and Discover never
-- checking blocks.
--
-- SECURITY INVOKER: everything read here is already visible to the caller
-- under existing RLS (own swipes/connections/settings, public profiles,
-- user_interests, cities). has_active_block is the one DEFINER helper, and
-- authenticated holds execute on it.
-- --------------------------------------------------
create or replace function public.get_discover_candidates(p_limit int default 20)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  role_title text,
  industry text,
  experience_level text,
  bio text,
  photo_url text,
  timezone text,
  ask_me_about text,
  learning_about text,
  side_project text,
  is_complete boolean,
  created_at timestamptz,
  updated_at timestamptz,
  city_id uuid,
  city_label text,
  -- transparency payload — Discover renders *why* without extra round-trips
  shared_interests text[],
  distance_miles numeric,
  is_nearby boolean,
  is_same_city boolean
)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  -- Scoring weights (spec §6). Starting points, not gospel — tuning is a
  -- one-line migration. One shared interest outranks proximity alone.
  w_shared_interest constant numeric := 10;
  w_nearby          constant numeric := 8;
  w_same_city       constant numeric := 2;

  meters_per_mile constant numeric := 1609.344;

  v_me uuid := auth.uid();
  v_my_city_id uuid;
  v_my_lat double precision;
  v_my_lng double precision;
  v_nearby_only boolean;
  v_radius_miles int;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select p.city_id, c.lat, c.lng
    into v_my_city_id, v_my_lat, v_my_lng
  from profiles p
  left join cities c on c.id = p.city_id
  where p.user_id = v_me;

  select ds.nearby_only, ds.nearby_radius_miles
    into v_nearby_only, v_radius_miles
  from discovery_settings ds
  where ds.user_id = v_me;

  v_radius_miles := coalesce(v_radius_miles, 25);
  -- "Within 25 miles of nowhere" is meaningless: the hard filter only
  -- engages when the viewer has a city set.
  v_nearby_only := coalesce(v_nearby_only, false) and v_my_city_id is not null;

  return query
  select
    p.id,
    p.user_id,
    p.display_name,
    p.role_title,
    p.industry,
    p.experience_level,
    p.bio,
    p.photo_url,
    p.timezone,
    p.ask_me_about,
    p.learning_about,
    p.side_project,
    p.is_complete,
    p.created_at,
    p.updated_at,
    p.city_id,
    case when c.id is not null
      then c.name || coalesce(', ' || c.region, '')
    end,
    s.names,
    d.miles,
    coalesce(d.miles <= v_radius_miles, false),
    p.city_id is not null and p.city_id = v_my_city_id
  from profiles p
  left join cities c on c.id = p.city_id
  left join lateral (
    select case
      when v_my_lat is null or c.lat is null then null
      else round(
        (earth_distance(
          ll_to_earth(v_my_lat, v_my_lng),
          ll_to_earth(c.lat, c.lng)
        ) / meters_per_mile)::numeric, 1)
    end as miles
  ) d on true
  left join lateral (
    select array_agg(i.name order by i.name) as names
    from user_interests mine
    join user_interests theirs
      on theirs.interest_id = mine.interest_id
     and theirs.user_id = p.user_id
    join interests i on i.id = mine.interest_id
    where mine.user_id = v_me
  ) s on true
  where p.is_complete
    and p.user_id <> v_me
    -- liked-ever / passed-within-6-months (§13.3 semantics, moved verbatim)
    and not exists (
      select 1 from swipes sw
      where sw.from_user_id = v_me
        and sw.to_user_id = p.user_id
        and (sw.direction = 'like' or sw.created_at > now() - interval '6 months')
    )
    and not exists (
      select 1 from connections cn
      where (cn.user_a_id = v_me and cn.user_b_id = p.user_id)
         or (cn.user_a_id = p.user_id and cn.user_b_id = v_me)
    )
    and not has_active_block(v_me, p.user_id)
    and (not v_nearby_only or coalesce(d.miles <= v_radius_miles, false))
  order by
      w_shared_interest * coalesce(array_length(s.names, 1), 0)
    + w_nearby * (case when coalesce(d.miles <= v_radius_miles, false) then 1 else 0 end)
    + w_same_city * (case when p.city_id is not null and p.city_id = v_my_city_id then 1 else 0 end)
    desc,
    p.created_at desc
  limit p_limit;
end;
$$;

revoke execute on function public.get_discover_candidates(int) from public, anon;
grant execute on function public.get_discover_candidates(int) to authenticated;
