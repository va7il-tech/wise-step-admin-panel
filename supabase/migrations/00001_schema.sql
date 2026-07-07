-- WiseStep Admin — core schema
-- Roles: super_admin (full access), editor (content but not users), viewer (read-only).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: extends auth.users, holds the role used by every RLS policy
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'viewer' check (role in ('super_admin', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile whenever a user signs up / is invited.
-- Role can be seeded through invite metadata ({"role": "editor"}).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'viewer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role helper used by all policies. SECURITY DEFINER so it can read profiles
-- without recursing into profiles' own RLS policies.
create or replace function public.get_my_role()
returns text
language sql
security definer set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin_or_editor()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.get_my_role() in ('super_admin', 'editor');
$$;

-- ---------------------------------------------------------------------------
-- forms
-- ---------------------------------------------------------------------------
create table public.forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  schema jsonb not null default '{"fields": []}'::jsonb,
  style jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms (id) on delete cascade,
  data jsonb not null,
  submitted_at timestamptz not null default now()
);

create index form_submissions_form_id_idx on public.form_submissions (form_id, submitted_at desc);

-- ---------------------------------------------------------------------------
-- quizzes & live game sessions
-- ---------------------------------------------------------------------------
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  cover_image text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  question_text text not null,
  options jsonb not null default '[]'::jsonb,
  correct_indexes int[] not null default '{}',
  time_limit_seconds int not null default 20 check (time_limit_seconds between 5 and 120),
  points int not null default 1000 check (points between 0 and 10000),
  position int not null
);

create index quiz_questions_quiz_id_idx on public.quiz_questions (quiz_id, position);

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  room_code text not null unique,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'finished')),
  current_question_index int not null default -1,
  started_at timestamptz,
  created_at timestamptz not null default now()
);

create index game_sessions_room_code_idx on public.game_sessions (room_code);

create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 24),
  score int not null default 0,
  joined_at timestamptz not null default now()
);

create index game_players_session_id_idx on public.game_players (session_id);

create table public.game_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  player_id uuid not null references public.game_players (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  selected_indexes int[] not null default '{}',
  answered_at timestamptz not null default now(),
  is_correct boolean not null default false,
  points_awarded int not null default 0,
  unique (player_id, question_id)
);

-- ---------------------------------------------------------------------------
-- projects (mirrors the wise-step.org project-card model)
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  icon text,
  short_description text not null default '',
  full_description text,
  read_more text,
  cover_image text,
  gallery jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  status text not null default 'ongoing' check (status in ('ongoing', 'one_time', 'campaign')),
  is_fundraiser boolean not null default false,
  goal_amount numeric(12, 2),
  current_amount numeric(12, 2),
  donors_count int,
  external_donate_url text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger forms_touch_updated_at
  before update on public.forms
  for each row execute function public.touch_updated_at();

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();
