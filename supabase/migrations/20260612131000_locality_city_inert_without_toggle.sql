-- Setting a city should be inert until the user turns on "nearby only".
-- Previously the RPC applied a proximity boost even when nearby_only was off,
-- so just entering a city silently reordered Discover ("near X first").
-- Now locality affects nothing unless the toggle is on; the toggle's ON
-- behavior (hard radius filter) is unchanged.
create or replace function public.get_discover_candidates(p_limit int default 20)
returns table (
  id uuid, user_id uuid, display_name text, role_title text, industry text,
  experience_level text, bio text, photo_url text, timezone text,
  ask_me_about text, learning_about text, side_project text, is_complete boolean,
  created_at timestamptz, updated_at timestamptz, city_id uuid, city_label text,
  shared_interests text[], distance_miles numeric, is_nearby boolean, is_same_city boolean
)
language plpgsql stable security invoker
set search_path = public, extensions
as $$
declare
  w_shared_interest constant numeric := 10;
  w_nearby          constant numeric := 8;
  w_same_city       constant numeric := 2;
  meters_per_mile   constant numeric := 1609.344;
  v_me uuid := auth.uid();
  v_my_city_id uuid;
  v_my_lat double precision;
  v_my_lng double precision;
  v_nearby_only boolean;
  v_radius_miles int;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;

  select p.city_id, c.lat, c.lng into v_my_city_id, v_my_lat, v_my_lng
  from profiles p left join cities c on c.id = p.city_id
  where p.user_id = v_me;

  select ds.nearby_only, ds.nearby_radius_miles into v_nearby_only, v_radius_miles
  from discovery_settings ds where ds.user_id = v_me;

  v_radius_miles := coalesce(v_radius_miles, 25);
  -- Locality is opt-in: it only matters when the user turned the toggle on AND
  -- has a city to measure from. Off (or no toggle) = city has no effect.
  v_nearby_only := coalesce(v_nearby_only, false) and v_my_city_id is not null;

  return query
  select
    p.id, p.user_id, p.display_name, p.role_title, p.industry, p.experience_level,
    p.bio, p.photo_url, p.timezone, p.ask_me_about, p.learning_about, p.side_project,
    p.is_complete, p.created_at, p.updated_at, p.city_id,
    case when c.id is not null then c.name || coalesce(', ' || c.region, '') end,
    s.names,
    -- Locality transparency only when the toggle is on, so no "~N mi" chip
    -- appears just because a city is set.
    case when v_nearby_only then d.miles end,
    case when v_nearby_only then coalesce(d.miles <= v_radius_miles, false) else false end,
    case when v_nearby_only and p.city_id is not null and p.city_id = v_my_city_id
      then true else false end
  from profiles p
  left join cities c on c.id = p.city_id
  left join lateral (
    select case when v_my_lat is null or c.lat is null then null
      else round((earth_distance(ll_to_earth(v_my_lat, v_my_lng), ll_to_earth(c.lat, c.lng)) / meters_per_mile)::numeric, 1)
    end as miles
  ) d on true
  left join lateral (
    select array_agg(i.name order by i.name) as names
    from user_interests mine
    join user_interests theirs on theirs.interest_id = mine.interest_id and theirs.user_id = p.user_id
    join interests i on i.id = mine.interest_id
    where mine.user_id = v_me
  ) s on true
  where p.is_complete
    and p.user_id <> v_me
    and not exists (
      select 1 from swipes sw where sw.from_user_id = v_me and sw.to_user_id = p.user_id
        and (sw.direction = 'like' or sw.created_at > now() - interval '6 months')
    )
    and not exists (
      select 1 from connections cn
      where (cn.user_a_id = v_me and cn.user_b_id = p.user_id)
         or (cn.user_a_id = p.user_id and cn.user_b_id = v_me)
    )
    and not has_active_block(v_me, p.user_id)
    -- Hard radius filter only when the toggle is on (unchanged behavior).
    and (not v_nearby_only or coalesce(d.miles <= v_radius_miles, false))
  order by
      w_shared_interest * coalesce(array_length(s.names, 1), 0)
    + (case when v_nearby_only and coalesce(d.miles <= v_radius_miles, false)
            then w_nearby else 0 end)
    + (case when v_nearby_only and p.city_id is not null and p.city_id = v_my_city_id
            then w_same_city else 0 end)
    desc, p.created_at desc
  limit p_limit;
end;
$$;

revoke execute on function public.get_discover_candidates(int) from public, anon;
grant execute on function public.get_discover_candidates(int) to authenticated;
