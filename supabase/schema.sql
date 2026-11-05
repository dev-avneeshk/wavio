-- House waitlist schema.
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again: it skips or replaces what already exists.
--
-- The world is made of towns. Every town has 1,000 plots, and house numbers run on across towns
-- in join order: houses 1-1,000 are Town 1, 1,001-2,000 are Town 2, and so on, with no end.
-- (The 1,000 also lives in src/lib/world.ts as TOWN_SIZE. Change both together, never after launch.)

-- 1. The table: one row per Google account, one row per Instagram username.
create table if not exists public.waitlist (
  id bigint generated always as identity primary key,

  -- Filled in by the database from the signed-in user's session, never from the browser.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email text default (auth.jwt() ->> 'email'),
  full_name text default (auth.jwt() -> 'user_metadata' ->> 'full_name'),

  -- The only value the user types. Stored lowercase, without the @.
  instagram_username text not null,

  -- House number, given out by the database in join order (section 3). It never changes, even if
  -- someone is deleted, so nobody's house ever moves.
  plot integer not null,

  created_at timestamptz not null default now(),

  constraint waitlist_one_per_account unique (user_id),
  constraint waitlist_instagram_unique unique (instagram_username),
  constraint waitlist_plot_unique unique (plot),
  constraint waitlist_plot_positive check (plot >= 1),

  -- Instagram rules: 1-30 characters, lowercase letters, numbers, periods and underscores,
  -- no period at the start or end, no two periods in a row.
  constraint waitlist_instagram_format check (
    instagram_username ~ '^[a-z0-9._]{1,30}$'
    and instagram_username !~ '^\.'
    and instagram_username !~ '\.$'
    and instagram_username !~ '\.\.'
  )
);

-- Upgrade a table made by an older version of this file: add house numbers in join order.
alter table public.waitlist add column if not exists plot integer;

update public.waitlist w
set plot = s.n
from (
  select id, (select coalesce(max(plot), 0) from public.waitlist) + row_number() over (order by id) as n
  from public.waitlist
  where plot is null
) s
where w.id = s.id;

alter table public.waitlist alter column plot set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'waitlist_plot_unique' and conrelid = 'public.waitlist'::regclass) then
    alter table public.waitlist add constraint waitlist_plot_unique unique (plot);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'waitlist_plot_positive' and conrelid = 'public.waitlist'::regclass) then
    alter table public.waitlist add constraint waitlist_plot_positive check (plot >= 1);
  end if;
end;
$$;

-- 2. Lock the table down. Signed-in users may read their own row and add exactly one row.
--    They can only send instagram_username; user_id, email, name and plot come from the database.
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

-- 3. House numbers. Each new row gets the next number after the highest one so far.
--    Signups take turns (an advisory lock), so two people never get the same house.
create or replace function public.waitlist_assign_plot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.waitlist.plot'));
  select coalesce(max(w.plot), 0) + 1 into new.plot from public.waitlist w;
  return new;
end;
$$;

revoke execute on function public.waitlist_assign_plot() from public, anon, authenticated;

drop trigger if exists waitlist_assign_plot on public.waitlist;
create trigger waitlist_assign_plot
  before insert on public.waitlist
  for each row execute function public.waitlist_assign_plot();

-- 4. What the map needs, in one call. Everyone, signed in or not, can call it.
--    It returns ONLY Instagram usernames and house numbers; Google names and emails stay private.
--    - houses: how many people are on the waitlist
--    - last:   the highest house number given out (the next person gets last + 1)
--    - towns:  [town, houses] for every town that has houses
--    - town + plots: one town's houses as [house number, username] (at most 1,000 rows).
--      p_town picks the town; without it you get the caller's own town, or else the town
--      where the next house goes.
--    - me: the caller's own house (null when signed out or not on the list yet)
create or replace function public.waitlist_world(p_town integer default null)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with stats as (
    select count(*)::int as houses, coalesce(max(plot), 0) as last
    from public.waitlist
  ),
  me as (
    select w.plot, w.instagram_username as username, w.created_at as "createdAt"
    from public.waitlist w
    where w.user_id = (select auth.uid())
  ),
  pick as (
    select greatest(1, least(1000000, coalesce(
      p_town,
      (select (m.plot - 1) / 1000 + 1 from me m),
      (select s.last / 1000 + 1 from stats s)
    ))) as town
  )
  select json_build_object(
    'houses', s.houses,
    'last', s.last,
    'towns', coalesce((
      select json_agg(json_build_array(t.town, t.n) order by t.town)
      from (
        select (w.plot - 1) / 1000 + 1 as town, count(*)::int as n
        from public.waitlist w
        group by 1
      ) t
    ), '[]'::json),
    'town', p.town,
    'plots', coalesce((
      select json_agg(json_build_array(w.plot, w.instagram_username) order by w.plot)
      from public.waitlist w
      where w.plot between (p.town - 1) * 1000 + 1 and p.town * 1000
    ), '[]'::json),
    'me', (select row_to_json(m) from me m)
  )
  from stats s, pick p;
$$;

revoke execute on function public.waitlist_world(integer) from public;
grant execute on function public.waitlist_world(integer) to anon, authenticated;

-- Removed in v2 of this file (plot numbers now come from the plot column).
drop function if exists public.waitlist_position();
