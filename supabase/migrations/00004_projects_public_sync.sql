-- WiseStep Admin — bring public.projects in sync with the live wise-step.org cards
--
-- Adds the fields the landing page needs but the v1 schema lacked, and opens
-- anonymous read access so the site can fetch projects from here instead of
-- hand-edited HTML (see README "Future integration point").
--
-- Fidelity model (chosen): "core + JSONB blob".
--   * Queryable / display-critical fields become first-class columns.
--   * Popup-only presentation (detail rows, donate presets & copy, success
--     message, theme classes) lives in a single `presentation` jsonb column.
--
-- The live seed rows themselves ship in the following migration, once the
-- un-truncated project data is available.

-- ---------------------------------------------------------------------------
-- New columns
-- ---------------------------------------------------------------------------
alter table public.projects
  -- Stable per-project key the landing page routes/anchors on ("florball",
  -- "cup2026"…). Nullable+unique so pre-existing rows without a slug are fine.
  add column if not exists slug text unique,
  -- Display order on the public site (source `order`, 1..11).
  add column if not exists sort_order int not null default 0,
  -- Highlighted card (source `featured`).
  add column if not exists featured boolean not null default false,
  -- The "Спорт · Постійний проєкт" label line (source card_label / popup_badge).
  add column if not exists badge text,
  -- Live lifecycle, distinct from the existing `status` kind enum.
  -- (source `status`: active = running, upcoming = future fundraiser/event.)
  add column if not exists lifecycle text
    check (lifecycle in ('active', 'upcoming')),
  -- Alt text for the cover / main image (source main_image_alt).
  add column if not exists main_image_alt text,
  -- Fundraiser display fields (source donation.*). progress_visible captures
  -- that several projects have amounts in source that are commented out /
  -- NOT shown on the live site — the bar must stay hidden for those.
  add column if not exists currency text not null default 'грн',
  add column if not exists progress_visible boolean not null default false,
  add column if not exists progress_percent int,
  add column if not exists amount_left numeric(12, 2),
  add column if not exists deadline_days int,
  -- Everything popup-only / presentational, kept for full fidelity without
  -- widening the table further:
  --   { "popup_details": [["📅 Місце","…"], …],
  --     "preset_amounts": ["200 грн", …], "preset_active_idx": 1,
  --     "donate_title": "…", "donate_btn": "…", "donate_note": "…",
  --     "success": {"emoji":"🎉","title":"…","text":"…"},
  --     "color_class": "g-teal", "gradient_emoji": "🏒",
  --     "cta_details_action": "openPopup('florball')", "note": "…" }
  add column if not exists presentation jsonb not null default '{}'::jsonb;

-- Landing page fetches ordered by sort_order.
create index if not exists projects_sort_order_idx on public.projects (sort_order);

-- ---------------------------------------------------------------------------
-- Public read access
-- Mirrors the style of the existing anon read policies in 00002_rls.sql
-- (e.g. "forms: public can read published", "sessions: public can read open").
-- All rows are public here: GET /rest/v1/projects?select=* must succeed for anon.
-- ---------------------------------------------------------------------------
create policy "projects: public read"
  on public.projects for select
  to anon
  using (true);

-- NOTE: a policy alone is not enough — PostgREST checks table-level privileges
-- before RLS, and the base schema never granted them to the Supabase roles.
-- That (schema-wide) gap is fixed in 00006_api_role_grants.sql.
