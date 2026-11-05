-- House waitlist schema.
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Then run
-- supabase/lots.sql the same way (where every plot sits, for the neighbour check).
-- Both are safe to run again: they skip or replace what already exists.
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

  -- The house number of whoever invited them (from an invite link), if any. Each invite makes the
  -- inviter's house finish sooner (section 4). Checked by section 3; never changes.
  invited_by integer,

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

alter table public.waitlist add column if not exists invited_by integer;
create index if not exists waitlist_invited_by_idx on public.waitlist (invited_by);

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
--    They can only send instagram_username and (optionally) the plot they picked and who invited
--    them; user_id, email and name come from their session, and section 3 checks the rest.
--    Nobody can update or delete rows from the website (you can, from the dashboard).
alter table public.waitlist enable row level security;

revoke all on table public.waitlist from anon, authenticated;
grant select on table public.waitlist to authenticated;
grant insert (instagram_username, plot, invited_by) on table public.waitlist to authenticated;

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
--    two people never get the same house. An invite from a house that doesn't exist is dropped
--    (the person still joins).
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
  if new.invited_by is not null
    and (new.invited_by = new.plot or not exists (select 1 from public.waitlist w where w.plot = new.invited_by)) then
    new.invited_by := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.waitlist_assign_plot() from public, anon, authenticated;

drop trigger if exists waitlist_assign_plot on public.waitlist;
create trigger waitlist_assign_plot
  before insert on public.waitlist
  for each row execute function public.waitlist_assign_plot();

-- 4. Build times. A house takes 30 days from the day its owner joins. Every friend who joins with
--    the owner's invite link takes 2 days off, down to 3 days at the least. (The numbers also live in
--    src/lib/house.ts, for the words on the page. The finish time itself always comes from here.)
create or replace function public.waitlist_build_days(p_invites integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(3, 30 - 2 * greatest(0, coalesce(p_invites, 0)));
$$;

-- 5. Neighbours. Every town has the same 1,000 plots; public.town_lots (filled by lots.sql) says
--    where each one sits. Two houses are neighbours when they're in the same town and at most
--    42 m apart: 4 plots along the street (a plot is 10.4 m wide), the row behind, and across the road.
create table if not exists public.town_lots (
  n integer primary key check (n between 1 and 1000),
  x real not null,
  z real not null
);

alter table public.town_lots enable row level security;
revoke all on table public.town_lots from anon, authenticated;

-- The signed-in caller's house number (null if they haven't joined). Used by the message rules.
create or replace function public.my_plot()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select w.plot from public.waitlist w where w.user_id = (select auth.uid());
$$;

revoke execute on function public.my_plot() from public, anon;
grant execute on function public.my_plot() to authenticated;

create or replace function public.plots_near(a integer, b integer)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(a <> b and (a - 1) / 1000 = (b - 1) / 1000 and exists (
    select 1
    from public.town_lots la, public.town_lots lb
    where la.n = (a - 1) % 1000 + 1
      and lb.n = (b - 1) % 1000 + 1
      and (la.x - lb.x) ^ 2 + (la.z - lb.z) ^ 2 <= 42 ^ 2
  ), false);
$$;

revoke execute on function public.plots_near(integer, integer) from public, anon, authenticated;

-- 6. Waves: anyone with a house can wave at another house once a day. The total shows on the
--    house's board and adds a little to its value. Only the functions in section 9 touch this table.
create table if not exists public.house_waves (
  from_plot integer not null references public.waitlist (plot) on delete cascade,
  to_plot integer not null references public.waitlist (plot) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  primary key (from_plot, to_plot, day),
  constraint house_waves_not_self check (from_plot <> to_plot)
);

create index if not exists house_waves_to_idx on public.house_waves (to_plot);

alter table public.house_waves enable row level security;
revoke all on table public.house_waves from anon, authenticated;

-- 7. Messages between neighbours (section 5), one to one. Only the two people in a conversation can
--    read it. Messages are sent through send_message() (section 9), which checks the rules; nobody
--    can write to the table directly. Deleting a house deletes its messages.
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  from_plot integer not null references public.waitlist (plot) on delete cascade,
  to_plot integer not null references public.waitlist (plot) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint messages_not_self check (from_plot <> to_plot),
  constraint messages_body_length check (char_length(body) between 1 and 280)
);

create index if not exists messages_to_idx on public.messages (to_plot, id);
create index if not exists messages_from_idx on public.messages (from_plot, id);

alter table public.messages enable row level security;
revoke all on table public.messages from anon, authenticated;
-- Read access is what lets the browser get new messages live (Supabase Realtime, section 10).
grant select on table public.messages to authenticated;

drop policy if exists "messages: read own conversations" on public.messages;
create policy "messages: read own conversations"
  on public.messages for select
  to authenticated
  using (from_plot = (select public.my_plot()) or to_plot = (select public.my_plot()));

-- Who doesn't want messages from whom. A blocked neighbour can't message you; unblock any time.
create table if not exists public.house_blocks (
  plot integer not null references public.waitlist (plot) on delete cascade,
  blocked integer not null references public.waitlist (plot) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plot, blocked)
);

alter table public.house_blocks enable row level security;
revoke all on table public.house_blocks from anon, authenticated;

-- 8. What the map needs, in one call. Everyone, signed in or not, can call it.
--    It returns ONLY Instagram usernames, house numbers and build times; Google names and emails
--    stay private.
--    - houses: how many people are on the waitlist
--    - last:   the highest house number given out
--    - next / open: see section 3
--    - towns:  [town, houses] for every town that has houses
--    - town + plots: one town's houses as [house number, username, started, done, waves]
--      (started / done are Unix times in seconds; at most 1,000 rows). p_town picks the town;
--      without it you get the caller's own town, or else the town where the next house goes.
--    - me: the caller's own house, with its build times, invites and unread messages
--      (null when signed out or not on the list yet)
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
    select
      w.plot,
      w.instagram_username as username,
      w.created_at as "createdAt",
      floor(extract(epoch from w.created_at))::bigint as start,
      floor(extract(epoch from w.created_at + make_interval(days => public.waitlist_build_days(i.n))))::bigint as done,
      i.n as invites,
      (select count(*)::int from public.house_waves v where v.to_plot = w.plot) as waves,
      (select count(*)::int from public.messages m where m.to_plot = w.plot and m.read_at is null) as unread
    from public.waitlist w
    cross join lateral (select count(*)::int as n from public.waitlist x where x.invited_by = w.plot) i
    where w.user_id = (select auth.uid())
  ),
  pick as (
    select greatest(1, least(1000000, coalesce(
      p_town,
      (select (m.plot - 1) / 1000 + 1 from me m),
      (select (f.next - 1) / 1000 + 1 from frontier f)
    ))) as town
  ),
  town_houses as (
    select
      w.plot,
      w.instagram_username as username,
      floor(extract(epoch from w.created_at))::bigint as start,
      floor(extract(epoch from w.created_at + make_interval(days => public.waitlist_build_days(
        (select count(*)::int from public.waitlist x where x.invited_by = w.plot)
      ))))::bigint as done,
      (select count(*)::int from public.house_waves v where v.to_plot = w.plot) as waves
    from public.waitlist w, pick p
    where w.plot between (p.town - 1) * 1000 + 1 and p.town * 1000
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
      select json_agg(json_build_array(h.plot, h.username, h.start, h.done, h.waves) order by h.plot)
      from town_houses h
    ), '[]'::json),
    'me', (select row_to_json(m) from me m)
  )
  from stats s, frontier f, pick p;
$$;

revoke execute on function public.waitlist_world(integer) from public;
grant execute on function public.waitlist_world(integer) to anon, authenticated;

-- 9. Things people do on the map. All of them need a house (except search), and each one checks
--    its own rules. Errors carry a hint (e.g. 'chat_too_far') that the website turns into words.

-- Wave at a house (once a day per house). Returns its total waves and whether this wave counted.
create or replace function public.wave_house(p_plot integer)
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me integer := public.my_plot();
  added integer;
begin
  if me is null then
    raise exception 'join the waitlist first' using hint = 'house_not_on_list';
  end if;
  if p_plot is null or p_plot = me then
    raise exception 'that is your own house' using hint = 'house_own';
  end if;
  if not exists (select 1 from public.waitlist w where w.plot = p_plot) then
    raise exception 'there is no house on plot %', p_plot using hint = 'house_missing';
  end if;
  insert into public.house_waves (from_plot, to_plot) values (me, p_plot) on conflict do nothing;
  get diagnostics added = row_count;
  return json_build_object(
    'waves', (select count(*)::int from public.house_waves v where v.to_plot = p_plot),
    'counted', added > 0
  );
end;
$$;

-- Send a neighbour a message (1-280 characters; at most 5 every 15 seconds and 300 a day).
create or replace function public.send_message(p_to integer, p_body text)
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me integer := public.my_plot();
  msg text := btrim(coalesce(p_body, ''));
  m public.messages;
begin
  if me is null then
    raise exception 'join the waitlist first' using hint = 'chat_not_on_list';
  end if;
  if p_to is null or p_to = me or not exists (select 1 from public.waitlist w where w.plot = p_to) then
    raise exception 'there is no house on plot %', p_to using hint = 'chat_no_house';
  end if;
  if not public.plots_near(me, p_to) then
    raise exception 'house % is not your neighbour', p_to using hint = 'chat_too_far';
  end if;
  if exists (select 1 from public.house_blocks b where b.plot = me and b.blocked = p_to) then
    raise exception 'you blocked house %', p_to using hint = 'chat_you_blocked';
  end if;
  if exists (select 1 from public.house_blocks b where b.plot = p_to and b.blocked = me) then
    raise exception 'house % is not taking messages from you', p_to using hint = 'chat_blocked';
  end if;
  if char_length(msg) = 0 then
    raise exception 'empty message' using hint = 'chat_empty';
  end if;
  if char_length(msg) > 280 then
    raise exception 'message too long' using hint = 'chat_too_long';
  end if;
  if (select count(*) from public.messages x where x.from_plot = me and x.created_at > now() - interval '15 seconds') >= 5 then
    raise exception 'too many messages' using hint = 'chat_slow_down';
  end if;
  if (select count(*) from public.messages x where x.from_plot = me and x.created_at > now() - interval '1 day') >= 300 then
    raise exception 'daily message limit reached' using hint = 'chat_daily_limit';
  end if;
  insert into public.messages (from_plot, to_plot, body) values (me, p_to, msg) returning * into m;
  return json_build_object('id', m.id, 'from', m.from_plot, 'to', m.to_plot, 'body', m.body, 'at', m.created_at);
end;
$$;

-- Your conversations, newest first: [{with, username, last, at, fromMe, unread, blocked}].
create or replace function public.chat_inbox()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select public.my_plot() as p
  ),
  conv as (
    select case when m.from_plot = me.p then m.to_plot else m.from_plot end as other, m.id, m.from_plot, m.body, m.created_at
    from public.messages m, me
    where m.from_plot = me.p or m.to_plot = me.p
  ),
  latest as (
    select distinct on (c.other) c.other, c.id, c.from_plot, c.body, c.created_at
    from conv c
    order by c.other, c.id desc
  )
  select coalesce(json_agg(json_build_object(
    'with', l.other,
    'username', w.instagram_username,
    'last', l.body,
    'at', l.created_at,
    'fromMe', l.from_plot = me.p,
    'unread', (select count(*)::int from public.messages u where u.to_plot = me.p and u.from_plot = l.other and u.read_at is null),
    'blocked', exists (select 1 from public.house_blocks b where b.plot = me.p and b.blocked = l.other)
  ) order by l.id desc), '[]'::json)
  from latest l
  join public.waitlist w on w.plot = l.other
  cross join me;
$$;

-- One conversation: the latest 60 messages (or 60 before message p_before) as
-- [id, fromMe, body, at], oldest first. Opening it marks the neighbour's messages as read.
create or replace function public.chat_thread(p_with integer, p_before bigint default null)
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me integer := public.my_plot();
  msgs json;
begin
  if me is null then
    raise exception 'join the waitlist first' using hint = 'chat_not_on_list';
  end if;
  if p_before is null then
    update public.messages m set read_at = now()
    where m.to_plot = me and m.from_plot = p_with and m.read_at is null;
  end if;
  select coalesce(json_agg(json_build_array(t.id, t.from_plot = me, t.body, t.created_at) order by t.id), '[]'::json)
  into msgs
  from (
    select m.id, m.from_plot, m.body, m.created_at
    from public.messages m
    where ((m.from_plot = me and m.to_plot = p_with) or (m.from_plot = p_with and m.to_plot = me))
      and (p_before is null or m.id < p_before)
    order by m.id desc
    limit 60
  ) t;
  return json_build_object(
    'with', p_with,
    'messages', msgs,
    'near', public.plots_near(me, p_with),
    'blocked', exists (select 1 from public.house_blocks b where b.plot = me and b.blocked = p_with)
  );
end;
$$;

-- Block (p_on = true) or unblock a neighbour. Returns whether they're blocked now.
create or replace function public.set_block(p_plot integer, p_on boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me integer := public.my_plot();
begin
  if me is null then
    raise exception 'join the waitlist first' using hint = 'chat_not_on_list';
  end if;
  if p_plot is null or p_plot = me or not exists (select 1 from public.waitlist w where w.plot = p_plot) then
    raise exception 'there is no house on plot %', p_plot using hint = 'chat_no_house';
  end if;
  if p_on then
    insert into public.house_blocks (plot, blocked) values (me, p_plot) on conflict do nothing;
  else
    delete from public.house_blocks b where b.plot = me and b.blocked = p_plot;
  end if;
  return p_on;
end;
$$;

-- Find houses by Instagram username (the start of it is enough): up to 6 [house number, username],
-- exact match first. Anyone can search; usernames are already shown on the map.
create or replace function public.find_house(p_query text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select lower(ltrim(btrim(coalesce(p_query, '')), '@')) as s
  )
  select coalesce(json_agg(json_build_array(r.plot, r.username) order by r.exact desc, r.username), '[]'::json)
  from (
    select w.plot, w.instagram_username as username, w.instagram_username = q.s as exact
    from public.waitlist w, q
    where char_length(q.s) between 1 and 30
      and left(w.instagram_username, char_length(q.s)) = q.s
    order by exact desc, w.instagram_username
    limit 6
  ) r;
$$;

revoke execute on function public.wave_house(integer) from public, anon;
revoke execute on function public.send_message(integer, text) from public, anon;
revoke execute on function public.chat_inbox() from public, anon;
revoke execute on function public.chat_thread(integer, bigint) from public, anon;
revoke execute on function public.set_block(integer, boolean) from public, anon;
revoke execute on function public.find_house(text) from public;
revoke execute on function public.waitlist_build_days(integer) from public, anon, authenticated;
grant execute on function public.wave_house(integer) to authenticated;
grant execute on function public.send_message(integer, text) to authenticated;
grant execute on function public.chat_inbox() to authenticated;
grant execute on function public.chat_thread(integer, bigint) to authenticated;
grant execute on function public.set_block(integer, boolean) to authenticated;
grant execute on function public.find_house(text) to anon, authenticated;

-- 10. Live messages: Supabase Realtime sends new rows of public.messages to the two people in the
--     conversation (it checks the read rule in section 7 for each of them).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- Removed in older versions of this file (the map now reads waitlist_world).
drop function if exists public.waitlist_position();
drop function if exists public.waitlist_houses();
