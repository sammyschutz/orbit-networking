-- "My algorithm" — seeds (zap-discover-algorithm-spec.md §8, migration 2).
--
-- 1) The curated interest vocabulary (spec §4.1): professional-leaning with
--    enough life in it to spark conversation. User-typed tags arrive later
--    via add_custom_interest with curated = false.
insert into public.interests (name, curated)
values
  ('AI & Machine Learning', true),
  ('Web Development', true),
  ('Mobile Development', true),
  ('Data Science', true),
  ('Cybersecurity', true),
  ('Cloud & DevOps', true),
  ('Open Source', true),
  ('AR/VR', true),
  ('Robotics', true),
  ('Product Management', true),
  ('UX/UI Design', true),
  ('Graphic Design', true),
  ('Marketing', true),
  ('Growth', true),
  ('Sales', true),
  ('Founding a Startup', true),
  ('Venture Capital', true),
  ('Investing', true),
  ('Fintech', true),
  ('Healthtech', true),
  ('Climate & Sustainability', true),
  ('Edtech', true),
  ('E-commerce', true),
  ('Gaming', true),
  ('Music', true),
  ('Film & TV', true),
  ('Photography', true),
  ('Writing', true),
  ('Podcasting', true),
  ('Public Speaking', true),
  ('Mentorship', true),
  ('Career Pivots', true),
  ('Job Hunting', true),
  ('Remote Work', true),
  ('Freelancing', true),
  ('Side Projects', true),
  ('Books', true),
  ('Fitness', true),
  ('Running', true),
  ('Climbing', true),
  ('Yoga', true),
  ('Hiking', true),
  ('Travel', true),
  ('Cooking', true),
  ('Coffee', true)
on conflict (lower(name)) do update set curated = true;

-- 2) Cities (spec §5.1): seeded from the GeoNames cities5000 dataset
--    (CC BY 4.0 — attribution: "City data by GeoNames (geonames.org)",
--    surface it in Settings → About). ~69k rows is too large for a migration
--    file, so the data was bulk-loaded out-of-band at migration time:
--
--    a) Download https://download.geonames.org/export/dump/cities5000.zip
--    b) Transform to TSV columns (name, ascii_name, region, country, lat,
--       lng, population), keeping admin1 as region only when it is an
--       alphabetic code ("TX", "ENG"); population nulled when 0.
--    c) Stage the TSV where Postgres can fetch it over https, then load with:
--
--       insert into public.cities
--         (name, ascii_name, region, country, lat, lng, population)
--       select f[1], f[2], nullif(f[3], ''), f[4],
--              f[5]::double precision, f[6]::double precision,
--              nullif(f[7], '')::int
--       from (
--         select string_to_array(l, E'\t') as f
--         from unnest(string_to_array(
--           (select content from extensions.http_get('<staged-tsv-url>')),
--           E'\n')) as l
--         where l <> ''
--       ) t;
--
--    The remote database has this load applied (69,066 rows).
