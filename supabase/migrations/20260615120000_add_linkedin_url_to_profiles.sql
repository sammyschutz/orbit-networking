-- Add an optional LinkedIn profile URL to profiles. Surfaced as a
-- "Connect on LinkedIn" deep-link button on a connection's detail screen.
-- Stored already-normalized by the client (https://www.linkedin.com/in/<slug>);
-- nullable because it is optional.
alter table profiles add column if not exists linkedin_url text;
