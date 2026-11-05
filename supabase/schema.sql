-- House waitlist schema.
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again: it skips or replaces what already exists.

-- 1. The table: one row per Google account, one row per Instagram username.
create table if not exists public.waitlist (
  id bigint generated always as identity primary key,

  -- Filled in by the database from the signed-in user's session, never from the browser.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email text default (auth.jwt() ->> 'email'),
  full_name text default (auth.jwt() -> 'user_metadata' ->> 'full_name'),

  -- The only value the user types. Stored lowercase, without the @.
  instagram_username text not null,

  created_at timestamptz not null default now(),

  constraint waitlist_one_per_account unique (user_id),
  constraint waitlist_instagram_unique unique (instagram_username),

  -- Instagram rules: 1-30 characters, lowercase letters, numbers, periods and underscores,
  -- no period at the start or end, no two periods in a row.
  constraint waitlist_instagram_format check (
    instagram_username ~ '^[a-z0-9._]{1,30}$'
    and instagram_username !~ '^\.'
    and instagram_username !~ '\.$'
    and instagram_username !~ '\.\.'
  )
);

-- 2. Lock the table down. Signed-in users may read their own row and add exactly one row.
--    They can only send instagram_username; user_id, email and name come from their session.
--    Nobody can update or delete rows from the website (you can, from the dashboard).
alter table public.waitlist enable row level security;

revoke all on table public.waitlist from anon, authenticated;
grant select on table public.waitlist to authenticated;
grant insert (instagram_username) on table public.waitlist to authenticated;

drop policy if exists "waitlist: read own entry" on public.waitlist;
create policy "waitlist: read own entry"
  on public.waitlist for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "waitlist: add own entry" on public.waitlist;
create policy "waitlist: add own entry"
  on public.waitlist for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- 3. The houses on the map: every Instagram username in join order (first = plot #1).
--    Everyone, signed in or not, can call it. It returns ONLY usernames; Google names
--    and emails stay private. One JSON array, so it isn't cut off at the 1,000-row API limit.
create or replace function public.waitlist_houses()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_agg(w.instagram_username order by w.id), '[]'::json)
  from public.waitlist w;
$$;

revoke execute on function public.waitlist_houses() from public;
grant execute on function public.waitlist_houses() to anon, authenticated;

-- Removed in v2 of this file (plot numbers now come from waitlist_houses).
drop function if exists public.waitlist_position();
