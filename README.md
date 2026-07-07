# WiseStep Admin

Адміністративна панель центру розвитку дітей та молоді **Wise Step** (м. Свалява) — окремий застосунок для субдомену `admin.wise-step.org`. Публічний сайт [wise-step.org](https://wise-step.org) залишається незалежним; спільними є лише бренд-кольори та логотип, а не код.

## Modules

| Module | What it does |
|---|---|
| **Forms** | Drag-order form builder (10 field types), public mobile-first fill page at `/f/{slug}`, copy-link + branded QR sharing, responses table with CSV export |
| **Games** | Kahoot-style quizzes: builder → live session with room code/QR → players join at `/play/{code}` with just a nickname → realtime questions, countdown, leaderboard, podium. Separate projector view at `/screen/{sessionId}` |
| **Projects** | Project cards mirroring the public site model, incl. fundraising block (goal / raised / donors, UAH) with a gold donate accent and external jar link |
| **Users** | Invite by email, three roles (`super_admin` / `editor` / `viewer`), role changes and access revocation |

All UI copy is Ukrainian; code and comments are English.

## Tech stack

- React 18 + Vite + TypeScript (strict) + Tailwind CSS v4
- React Router, React Hook Form
- Supabase: Postgres + Auth + Storage + Realtime (broadcast + presence)
- `qr-code-styling` for QR codes with the org logo embedded (client-side)

## Setup

### 1. Install

```bash
npm install
cp .env.example .env
```

### 2. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then put its credentials into `.env`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

### 3. Run migrations

With the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <project-ref>
supabase db push          # applies supabase/migrations in order
```

The migrations create:

1. `00001_schema.sql` — tables (`profiles`, `forms`, `form_submissions`, `quizzes`, `quiz_questions`, `game_sessions`, `game_players`, `game_answers`, `projects`), the `handle_new_user` trigger that creates a profile on signup, and helper functions.
2. `00002_rls.sql` — **Row Level Security for every table plus storage buckets.** Roles are enforced in Postgres, not in the UI. Anonymous visitors can only: read published forms, submit to them, read open game sessions, and join a lobby.
3. `00003_seed.sql` — realistic seed content (a camp registration form, three projects, an icebreaker quiz).

### 4. Deploy the edge function (user management)

Inviting and revoking users needs the service-role key, so it runs server-side:

```bash
supabase functions deploy admin-users
```

The function verifies the caller is a `super_admin` before acting. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase.

### 5. Create the first super admin

Invite yourself from the Supabase dashboard (Authentication → Users → Invite), then promote the profile:

```sql
update public.profiles set role = 'super_admin' where email = 'you@wise-step.org';
```

Every later user can be invited from the admin UI (Користувачі → Запросити).

### 6. Run

```bash
npm run dev        # dev server
npm run typecheck  # strict TS check
npm run build      # production build (type-checks first)
```

## Roles

| | viewer | editor | super_admin |
|---|---|---|---|
| View content, responses, results | ✅ | ✅ | ✅ |
| Create/edit forms, quizzes, projects; host games | — | ✅ | ✅ |
| Invite users, change roles, revoke access | — | — | ✅ |

Enforced by RLS policies (`supabase/migrations/00002_rls.sql`) via the `get_my_role()` / `is_admin_or_editor()` helper functions — hiding buttons in the UI is cosmetic only.

## Live game architecture

One public Realtime channel per room: `game:{room_code}`.

- **The host is authoritative**: it owns the timer, receives player answers via broadcast, computes correctness + speed-based scores, writes `game_answers` / `game_players.score` (players have no write access to scores), and broadcasts `question` / `progress` / `reveal` / `gameover` events.
- Questions are broadcast to players **with the correct answers stripped** — players never query the quiz tables, and RLS doesn't allow them to.
- Players identify by a generated `game_players` row id kept in `sessionStorage`, so a page refresh rejoins the same identity; a `hello` broadcast asks the host to re-send current state.
- The big-screen view is a passive listener on the same channel.

Message types live in `src/lib/types.ts` (`HostBroadcast` / `PlayerBroadcast`).

## Hosting (recommended)

- **Frontend**: Vercel or Netlify, domain `admin.wise-step.org`. SPA fallback: rewrite all routes to `/index.html`.
- **Backend**: the Supabase project (DB, auth, storage, realtime, edge function).
- The existing `wise-step.org` landing page stays untouched and separately hosted.

## Future integration point

The `projects` table is intentionally shaped like the public site's project cards. To let the landing page read projects from here instead of hand-edited HTML, add a public read policy, e.g.:

```sql
create policy "projects: public read"
  on public.projects for select
  to anon
  using (true);
```

…and fetch via the Supabase REST endpoint (`GET /rest/v1/projects?select=*`) with the anon key from the landing page (or a tiny edge function if field filtering is needed). Not enabled in v1.
