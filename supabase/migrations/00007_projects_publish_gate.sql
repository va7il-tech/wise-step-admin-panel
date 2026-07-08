-- WiseStep Admin — draft-by-default publish gate for public.projects
--
-- Problem: the admin create/edit form never set `slug` (it has no slug input) or
-- any `presentation` fields, so a project entered through the UI was born with
-- slug = null and presentation = {}. One such row ("Флорбольний клуб «Поляна»")
-- reached wise-step.org in the featured slot with a dead "Детальніше" button and
-- a placeholder Monobank URL.
--
-- Fix (primary safeguard): a `published` flag that defaults to false, plus an
-- anon RLS filter so drafts are physically invisible to the public anon key —
-- regardless of what the site front-end does. The admin UI's completeness guard
-- is a second layer, not the gate itself.
--
-- No existing column overlaps this purpose: `status` is the kind enum
-- (ongoing/one_time/campaign), `lifecycle` is active/upcoming, `featured` is the
-- card highlight. A dedicated column is warranted.

-- ---------------------------------------------------------------------------
-- published flag — draft by construction
-- ---------------------------------------------------------------------------
alter table public.projects
  add column if not exists published boolean not null default false;

-- Keep the 11 live projects visible. Direct update — this deliberately bypasses
-- the UI completeness guard, which only governs future edits through the form.
update public.projects set published = true
where slug in (
  'florball', 'cup2026', 'crafts', 'candles', 'reb', 'camps',
  'camp', 'games', 'events', 'bible', 'education'
);

-- Backfill the broken row's slug. It intentionally STAYS published = false (the
-- column default) until real content is supplied — no content is invented here.
-- Matched by `slug is null` (the reliable key): the live row is titled
-- 'Флорбольний клуб "Поляна"' and is the only slug-less row. The NOT NULL
-- constraint below fails loudly if more than this one row is still slug-less.
update public.projects set slug = 'polyana'
where slug is null;

-- ---------------------------------------------------------------------------
-- Enforce slug at the DB level going forward (task 2). Safe only once every row
-- has a slug: 11 seeded + Поляна backfilled above. Fails loudly if a null slug
-- remains, which correctly signals unmigrated data rather than hiding it.
-- ---------------------------------------------------------------------------
alter table public.projects alter column slug set not null;

-- ---------------------------------------------------------------------------
-- Anon read access — published rows only (replaces the "all rows public" policy
-- from 00004_projects_public_sync.sql).
-- ---------------------------------------------------------------------------
drop policy if exists "projects: public read" on public.projects;

create policy "projects: public read published"
  on public.projects for select
  to anon
  using (published = true);

-- Table-level grants already cover the new column: 00006_api_role_grants.sql
-- grants SELECT on all columns of every public table to anon.
