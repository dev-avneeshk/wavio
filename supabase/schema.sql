-- House waitlist schema.
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again: it skips or replaces what already exists.
--
-- The world is made of towns. Every town has 1,000 plots, and house numbers run on across towns:
-- houses 1-1,000 are Town 1, 1,001-2,000 are Town 2, and so on, with no end. People can pick any
-- empty plot in an open town, or take the next free one.
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

  -- House number: the plot the person picked, or the next free one (section 3). It never changes,
  -- even if someone else is deleted, so nobody's house ever moves.
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
--    They can only send instagram_username and (optionally) the plot they picked; user_id, email
--    and name come from their session, and section 3 checks the plot.
--    Nobody can update or delete rows from the website (you can, from the dashboard).
alter table public.waitlist enable row level security;

revoke all on table public.waitlist from anon, authenticated;
grant select on table public.waitlist to authenticated;
grant insert (instagram_username, plot) on table public.waitlist to authenticated;

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

-- 3. House numbers.
--    - next: the lowest free house number. Anyone who doesn't pick a plot gets this one.
--    - open: the highest town people can pick in. A town opens only once every town before it is
--      full, so towns still fill in order: Town 2 opens when Town 1's 1,000 plots are taken.
create or replace function public.waitlist_frontier(out next integer, out open integer)
language sql
stable
security definer
set search_path = ''
as $$
  with f as (
    select
      case
        when not exists (select 1 from public.waitlist where plot = 1) then 1
        else (
          select min(w.plot) + 1
          from public.waitlist w
          where not exists (select 1 from public.waitlist x where x.plot = w.plot + 1)
        )
      end as next,
      (select coalesce(max(plot), 0) from public.waitlist) as last
  )
  select f.next, greatest((f.next - 1) / 1000 + 1, (greatest(f.last, 1) - 1) / 1000 + 1)
  from f;
$$;

revoke execute on function public.waitlist_frontier() from public, anon, authenticated;

--    Each new row either keeps the plot the person picked (if it's in an open town; a plot that's
--    already taken fails the unique rule) or gets `next`. Signups take turns (an advisory lock), so
--    two people never get the same house.
create or replace function public.waitlist_assign_plot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  f record;
begin
  perform pg_advisory_xact_lock(hashtext('public.waitlist.plot'));
  select * into f from public.waitlist_frontier();
  if new.plot is null then
    new.plot := f.next;
  elsif new.plot < 1 or new.plot > f.open * 1000 then
    raise exception 'plot % is not open yet', new.plot using hint = 'waitlist_plot_not_open';
  end if;
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
--    - last:   the highest house number given out
--    - next / open: see section 3
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
  frontier as (
    select * from public.waitlist_frontier()
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
      (select (f.next - 1) / 1000 + 1 from frontier f)
    ))) as town
  )
  select json_build_object(
    'houses', s.houses,
    'last', s.last,
    'next', f.next,
    'open', f.open,
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
  from stats s, frontier f, pick p;
$$;

revoke execute on function public.waitlist_world(integer) from public;
grant execute on function public.waitlist_world(integer) to anon, authenticated;

-- Removed in older versions of this file (the map now reads waitlist_world).
drop function if exists public.waitlist_position();
drop function if exists public.waitlist_houses();
