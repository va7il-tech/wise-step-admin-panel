-- WiseStep Admin — Row Level Security
--
-- Role model (enforced here, not in the UI):
--   super_admin  full access, including user management
--   editor       manage forms / games / projects; no user management
--   viewer       read-only inside the admin
--   anon         public visitors: may read published forms, submit them,
--                look up open game sessions and join them. Nothing else.

alter table public.profiles enable row level security;
alter table public.forms enable row level security;
alter table public.form_submissions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_players enable row level security;
alter table public.game_answers enable row level security;
alter table public.projects enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles: staff can read all"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles: super_admin can update any"
  on public.profiles for update
  to authenticated
  using (public.get_my_role() = 'super_admin')
  with check (public.get_my_role() = 'super_admin');

create policy "profiles: users can update own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Only a super_admin may change roles; everyone else can only edit their name.
create or replace function public.guard_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and public.get_my_role() is distinct from 'super_admin' then
    raise exception 'Only a super_admin can change roles';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role_change
  before update on public.profiles
  for each row execute function public.guard_role_change();

create policy "profiles: super_admin can delete"
  on public.profiles for delete
  to authenticated
  using (public.get_my_role() = 'super_admin' and id <> auth.uid());

-- ---------------------------------------------------------------------------
-- forms
-- ---------------------------------------------------------------------------
create policy "forms: staff can read all"
  on public.forms for select
  to authenticated
  using (true);

create policy "forms: public can read published"
  on public.forms for select
  to anon
  using (is_published = true);

create policy "forms: editors can insert"
  on public.forms for insert
  to authenticated
  with check (public.is_admin_or_editor());

create policy "forms: editors can update"
  on public.forms for update
  to authenticated
  using (public.is_admin_or_editor())
  with check (public.is_admin_or_editor());

create policy "forms: editors can delete"
  on public.forms for delete
  to authenticated
  using (public.is_admin_or_editor());

-- ---------------------------------------------------------------------------
-- form_submissions
-- ---------------------------------------------------------------------------
create policy "submissions: anyone can submit to a published form"
  on public.form_submissions for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.forms f
      where f.id = form_id and f.is_published = true
    )
  );

create policy "submissions: staff can read"
  on public.form_submissions for select
  to authenticated
  using (true);

create policy "submissions: editors can delete"
  on public.form_submissions for delete
  to authenticated
  using (public.is_admin_or_editor());

-- ---------------------------------------------------------------------------
-- quizzes / quiz_questions
-- Players never read these tables — questions reach them via Realtime
-- broadcast from the host, with correct answers stripped out.
-- ---------------------------------------------------------------------------
create policy "quizzes: staff can read"
  on public.quizzes for select
  to authenticated
  using (true);

create policy "quizzes: editors can write"
  on public.quizzes for insert
  to authenticated
  with check (public.is_admin_or_editor());

create policy "quizzes: editors can update"
  on public.quizzes for update
  to authenticated
  using (public.is_admin_or_editor())
  with check (public.is_admin_or_editor());

create policy "quizzes: editors can delete"
  on public.quizzes for delete
  to authenticated
  using (public.is_admin_or_editor());

create policy "questions: staff can read"
  on public.quiz_questions for select
  to authenticated
  using (true);

create policy "questions: editors can write"
  on public.quiz_questions for insert
  to authenticated
  with check (public.is_admin_or_editor());

create policy "questions: editors can update"
  on public.quiz_questions for update
  to authenticated
  using (public.is_admin_or_editor())
  with check (public.is_admin_or_editor());

create policy "questions: editors can delete"
  on public.quiz_questions for delete
  to authenticated
  using (public.is_admin_or_editor());

-- ---------------------------------------------------------------------------
-- game_sessions
-- ---------------------------------------------------------------------------
create policy "sessions: staff can read"
  on public.game_sessions for select
  to authenticated
  using (true);

-- Anonymous players look sessions up by room code to join / play.
create policy "sessions: public can read open sessions"
  on public.game_sessions for select
  to anon
  using (status in ('lobby', 'active'));

create policy "sessions: editors can write"
  on public.game_sessions for insert
  to authenticated
  with check (public.is_admin_or_editor());

create policy "sessions: editors can update"
  on public.game_sessions for update
  to authenticated
  using (public.is_admin_or_editor())
  with check (public.is_admin_or_editor());

create policy "sessions: editors can delete"
  on public.game_sessions for delete
  to authenticated
  using (public.is_admin_or_editor());

-- ---------------------------------------------------------------------------
-- game_players
-- Anonymous players register themselves while the lobby is open.
-- Scores are written only by the (authenticated) host.
-- ---------------------------------------------------------------------------
create policy "players: anyone can read players of open sessions"
  on public.game_players for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.game_sessions s
      where s.id = session_id and s.status in ('lobby', 'active')
    )
    or auth.role() = 'authenticated'
  );

create policy "players: public can join a lobby"
  on public.game_players for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.game_sessions s
      where s.id = session_id and s.status = 'lobby'
    )
  );

create policy "players: editors can update scores"
  on public.game_players for update
  to authenticated
  using (public.is_admin_or_editor())
  with check (public.is_admin_or_editor());

create policy "players: editors can delete"
  on public.game_players for delete
  to authenticated
  using (public.is_admin_or_editor());

-- ---------------------------------------------------------------------------
-- game_answers — written by the host only (it is the scoring authority)
-- ---------------------------------------------------------------------------
create policy "answers: staff can read"
  on public.game_answers for select
  to authenticated
  using (true);

create policy "answers: editors can write"
  on public.game_answers for insert
  to authenticated
  with check (public.is_admin_or_editor());

create policy "answers: editors can delete"
  on public.game_answers for delete
  to authenticated
  using (public.is_admin_or_editor());

-- ---------------------------------------------------------------------------
-- projects
-- (A future public read policy for the landing page is a deliberate
--  integration point — see README. Not enabled in v1.)
-- ---------------------------------------------------------------------------
create policy "projects: staff can read"
  on public.projects for select
  to authenticated
  using (true);

create policy "projects: editors can insert"
  on public.projects for insert
  to authenticated
  with check (public.is_admin_or_editor());

create policy "projects: editors can update"
  on public.projects for update
  to authenticated
  using (public.is_admin_or_editor())
  with check (public.is_admin_or_editor());

create policy "projects: editors can delete"
  on public.projects for delete
  to authenticated
  using (public.is_admin_or_editor());

-- ---------------------------------------------------------------------------
-- Storage buckets
--   media         public-read images (form covers, project covers/galleries, quiz covers)
--   form-uploads  private; anonymous form fillers may upload, staff may read
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('form-uploads', 'form-uploads', false)
on conflict (id) do nothing;

create policy "media: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'media');

create policy "media: editors can upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media' and public.is_admin_or_editor());

create policy "media: editors can update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media' and public.is_admin_or_editor());

create policy "media: editors can delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and public.is_admin_or_editor());

create policy "form-uploads: anyone can upload"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'form-uploads');

create policy "form-uploads: staff can read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'form-uploads');
