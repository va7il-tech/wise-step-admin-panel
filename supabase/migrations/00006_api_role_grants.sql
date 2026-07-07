-- WiseStep Admin — table privileges for the Supabase API roles
--
-- The RLS policies in 00002_rls.sql (and the projects public-read policy in
-- 00004) decide WHICH rows each role may see, but PostgREST first checks
-- table-level privileges. The base schema never granted any to the Supabase
-- roles (anon / authenticated / service_role), so every REST call failed with
-- 42501 "permission denied" — anon public reads AND the admin panel's
-- authenticated reads/writes alike. This migration grants the standard
-- privileges once, for all current and future tables in `public`.
--
-- Safe because RLS is enabled on every public table: a role holding a table
-- grant still sees only the rows its policies allow, and a table with no
-- matching policy returns zero rows. (Verified: all public tables have
-- relrowsecurity = true, so no broad grant can leak an unprotected table.)

grant usage on schema public to anon, authenticated, service_role;

-- anon (public landing page) is read-only. Row visibility is gated by the anon
-- policies in 00002_rls.sql / 00004 (published forms, open sessions, all
-- projects, …); tables without an anon policy return nothing.
grant select on all tables in schema public to anon;

-- authenticated (signed-in staff) gets full CRUD, gated by the staff-read and
-- editor (is_admin_or_editor()) policies.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- service_role bypasses RLS and backs the edge functions (e.g. admin-users).
grant all on all tables in schema public to service_role;

-- Apply the same privileges automatically to tables added by future migrations.
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
