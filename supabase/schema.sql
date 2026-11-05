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

-- 7b. Characters: every house comes with the person who lives in it (section 11 has what they do).
--     A person's look is one of 2,548,039,680 combinations of body, skin, hair, face, clothes and
--     shoes (src/components/people/look.ts turns the number into the person). char_look() maps house
--     numbers onto those combinations one to one, and `look` is unique, so no two people look the
--     same. Age and personality (trait) also come from the house number.
--     Jobs come later: until then job is null and income is 0. Everyone starts with 500 coins
--     (in-game, not money) in their pocket, which is what gets stolen.
create or replace function public.char_look(p_plot integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  -- 1234567891 shares no factor with 2548039680 (= 2^21 x 3^5 x 5), so no two house numbers
  -- below 2,548,039,681 get the same look.
  select (1234567891::bigint * p_plot + 987654321) % 2548039680;
$$;

create or replace function public.char_trait(p_plot integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['hardworking', 'hothead', 'sneaky', 'friendly', 'lazy', 'curious'])[
    ((p_plot::bigint * 2654435761) % 4294967296) % 6 + 1
  ];
$$;

-- Grey or white hair (look digit 4, see look.ts) means an older person.
create or replace function public.char_age(p_plot integer)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select (case
    when (public.char_look(p_plot) / 160) % 8 >= 6 then 56 + ((p_plot::bigint * 2246822519) % 4294967296) % 22
    else 19 + ((p_plot::bigint * 2246822519) % 4294967296) % 30
  end)::smallint;
$$;

create table if not exists public.characters (
  plot integer primary key references public.waitlist (plot) on delete cascade,
  town integer generated always as ((plot - 1) / 1000 + 1) stored,
  look bigint not null,
  age smallint not null,
  trait text not null,
  job text, -- null: waiting for a job
  income integer not null default 0, -- coins a day
  wallet integer not null default 500,
  health smallint not null default 100, -- as of health_at; it heals 10 an hour (char_hp)
  health_at timestamptz not null default now(),
  last_seen timestamptz, -- the owner was last in the game (they're "online" for 75 s after)
  next_at timestamptz not null default now() + interval '6 minutes', -- when they next do something on their own
  created_at timestamptz not null default now(),
  constraint characters_look_unique unique (look),
  constraint characters_wallet_ok check (wallet >= 0),
  constraint characters_health_ok check (health between 0 and 100),
  constraint characters_trait_ok check (trait in ('hardworking', 'hothead', 'sneaky', 'friendly', 'lazy', 'curious'))
);

create index if not exists characters_town_next_idx on public.characters (town, next_at);

alter table public.characters enable row level security;
revoke all on table public.characters from anon, authenticated;

-- Everyone on the list gets their person (people who joined before characters existed, too).
insert into public.characters (plot, look, age, trait, next_at)
select w.plot, public.char_look(w.plot), public.char_age(w.plot), public.char_trait(w.plot),
  now() + interval '5 minutes' + random() * interval '25 minutes'
from public.waitlist w
on conflict (plot) do nothing;

create or replace function public.waitlist_add_character()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.characters (plot, look, age, trait)
  values (new.plot, public.char_look(new.plot), public.char_age(new.plot), public.char_trait(new.plot))
  on conflict (plot) do nothing;
  return null;
end;
$$;

revoke execute on function public.waitlist_add_character() from public, anon, authenticated;

drop trigger if exists waitlist_add_character on public.waitlist;
create trigger waitlist_add_character
  after insert on public.waitlist
  for each row execute function public.waitlist_add_character();

-- Health now: what it was at health_at, plus 10 an hour, up to 100.
create or replace function public.char_hp(p_health smallint, p_at timestamptz)
returns integer
language sql
stable
set search_path = ''
as $$
  select least(100, p_health + greatest(0, floor(extract(epoch from now() - p_at) / 360))::integer);
$$;

-- The owner is in the game: they pinged in the last 75 seconds.
create or replace function public.char_online(p_seen timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_seen > now() - interval '75 seconds', false);
$$;

-- 8. What the map needs, in one call. Everyone, signed in or not, can call it.
--    It returns ONLY Instagram usernames, house numbers and build times; Google names and emails
--    stay private.
--    - houses: how many people are on the waitlist
--    - last:   the highest house number given out
--    - next / open: see section 3
--    - towns:  [town, houses] for every town that has houses
--    - town + plots: one town's houses as [house number, username, started, done, waves, look,
--      age, trait, job, income, online] (started / done are Unix times in seconds; look, age,
--      trait, job and income describe the person living there, see section 7b; online: their
--      owner is in the game right now; at most 1,000 rows). p_town picks the town; without it you
--      get the caller's own town, or else the town where the next house goes.
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
      (select count(*)::int from public.house_waves v where v.to_plot = w.plot) as waves,
      coalesce(c.look, public.char_look(w.plot)) as look,
      coalesce(c.age, public.char_age(w.plot)) as age,
      coalesce(c.trait, public.char_trait(w.plot)) as trait,
      c.job,
      coalesce(c.income, 0) as income,
      public.char_online(c.last_seen) as online
    from public.waitlist w
    cross join pick p
    left join public.characters c on c.plot = w.plot
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
      select json_agg(json_build_array(
        h.plot, h.username, h.start, h.done, h.waves, h.look, h.age, h.trait, h.job, h.income, h.online
      ) order by h.plot)
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

-- 11. Life in town. While their owner is away, people live on their own: chores, waiting at the
--     Job Centre, a jog, a nap, chatting with a neighbour, and now and then a fight or a theft.
--     Everything that happens is a row in public.character_events, which is both what the map acts
--     out (section 12, town_events) and what the owner reads when they come back (game_enter).
--     Owners in the game control their person themselves; nothing happens to them on its own.
--     There's no scheduler: a town is brought up to date (advance_town) whenever someone is
--     looking at it or playing in it. Things are decided 5-10 minutes before they happen, so every
--     screen can show them on time. A town nobody looked at catches up on the last 12 hours.
create table if not exists public.character_events (
  id bigint generated always as identity primary key,
  town integer not null,
  at timestamptz not null, -- when it starts at its spot (the walk there comes before)
  dur smallint not null, -- seconds it lasts
  kind text not null,
  detail text not null default '', -- task: which one; steal: ok / caught / empty
  actor integer not null references public.waitlist (plot) on delete cascade,
  target integer references public.waitlist (plot) on delete cascade,
  winner integer, -- fights
  coins integer not null default 0, -- steals: target -> actor; fights: loser -> winner
  hp_actor smallint not null default 0, -- health lost in a fight
  hp_target smallint not null default 0,
  live boolean not null default false, -- done by a player in the game
  created_at timestamptz not null default now(),
  constraint character_events_kind check (kind in ('task', 'chat', 'fight', 'steal'))
);

create index if not exists character_events_town_at_idx on public.character_events (town, at);
create index if not exists character_events_actor_at_idx on public.character_events (actor, at);
create index if not exists character_events_target_at_idx on public.character_events (target, at);

alter table public.character_events enable row level security;
revoke all on table public.character_events from anon, authenticated;

-- A chore, by personality. Hurt people rest.
create or replace function public.char_pick_task(p_trait text, p_hp integer)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  r double precision := random();
begin
  if p_hp < 35 then
    return 'rest';
  end if;
  if p_trait = 'lazy' then
    return case when r < 0.3 then 'rest' when r < 0.5 then 'park' when r < 0.7 then 'jobqueue'
      when r < 0.8 then 'mailbox' when r < 0.9 then 'build' else 'sweep' end;
  elsif p_trait = 'hardworking' then
    return case when r < 0.3 then 'jobqueue' when r < 0.48 then 'sweep' when r < 0.64 then 'water'
      when r < 0.78 then 'jog' when r < 0.88 then 'build' when r < 0.95 then 'mailbox' else 'park' end;
  end if;
  return case when r < 0.26 then 'jobqueue' when r < 0.38 then 'sweep' when r < 0.5 then 'water'
    when r < 0.6 then 'jog' when r < 0.72 then 'park' when r < 0.82 then 'build' when r < 0.9 then 'mailbox'
    else 'rest' end;
end;
$$;

-- Someone (p_plot) does one thing on their own at p_at. Returns when they can next act.
-- A person is in at most one thing at a time: nothing else involving them 25 minutes either side.
create or replace function public.char_auto_event(p_plot integer, p_at timestamptz)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.characters;
  t public.characters;
  busy public.character_events;
  r double precision := random();
  w_chat double precision;
  w_fight double precision;
  w_steal double precision;
  v_kind text := 'task';
  v_detail text := '';
  v_dur integer;
  hp integer;
  thp integer;
  v_coins integer := 0;
  v_winner integer;
  dmg_a integer := 0;
  dmg_t integer := 0;
  loser integer;
  gap_min double precision;
begin
  select * into c from public.characters x where x.plot = p_plot;
  if not found then
    return p_at + interval '1 hour';
  end if;

  -- Already in something around then (a neighbour came over): try again after it.
  select * into busy from public.character_events e
  where (e.actor = p_plot or e.target = p_plot)
    and e.at > p_at - interval '25 minutes' and e.at < p_at + interval '25 minutes'
  order by e.at desc
  limit 1;
  if found then
    return busy.at + interval '25 minutes' + random() * interval '5 minutes';
  end if;

  hp := public.char_hp(c.health, c.health_at);
  w_chat := case c.trait when 'friendly' then 0.32 when 'curious' then 0.24 when 'lazy' then 0.12 else 0.16 end;
  w_fight := case c.trait when 'hothead' then 0.2 when 'friendly' then 0.02 when 'hardworking' then 0.03 else 0.06 end;
  w_steal := case c.trait when 'sneaky' then 0.26 when 'friendly' then 0.03 when 'hardworking' then 0.04
    when 'curious' then 0.09 else 0.07 end;
  if hp < 30 then
    w_fight := 0;
    w_steal := w_steal / 2;
  end if;

  if r < w_chat + w_fight + w_steal then
    v_kind := case when r < w_chat then 'chat' when r < w_chat + w_fight then 'fight' else 'steal' end;
    -- A neighbour who's around: not in the game themselves and not busy then.
    select * into t from public.characters x
    where x.town = c.town and x.plot <> c.plot
      and not public.char_online(x.last_seen)
      and public.plots_near(c.plot, x.plot)
      and not exists (
        select 1 from public.character_events e
        where (e.actor = x.plot or e.target = x.plot)
          and e.at > p_at - interval '25 minutes' and e.at < p_at + interval '25 minutes'
      )
    order by random()
    limit 1;
    if not found then
      v_kind := 'task';
    end if;
  end if;

  if v_kind = 'task' then
    v_detail := public.char_pick_task(c.trait, hp);
    v_dur := case v_detail when 'sweep' then 150 when 'water' then 120 when 'mailbox' then 45 when 'jog' then 240
      when 'park' then 300 when 'build' then 120 when 'rest' then 480 else 360 end;
    if v_detail = 'rest' then
      update public.characters x set health = least(100, hp + 25), health_at = now() where x.plot = c.plot;
    end if;
  elsif v_kind = 'chat' then
    v_dur := 90;
  elsif v_kind = 'fight' then
    v_dur := 30;
    thp := public.char_hp(t.health, t.health_at);
    v_winner := case when random() < 0.5 + (hp - thp) / 250.0 + (case c.trait when 'hothead' then 0.06 else 0 end)
      then c.plot else t.plot end;
    loser := case when v_winner = c.plot then t.plot else c.plot end;
    dmg_a := case when v_winner = c.plot then 2 + floor(random() * 7)::int else 10 + floor(random() * 13)::int end;
    dmg_t := case when v_winner = t.plot then 2 + floor(random() * 7)::int else 10 + floor(random() * 13)::int end;
    v_coins := least(case when loser = c.plot then c.wallet else t.wallet end, floor(random() * 11)::int);
    -- One statement for both, so the two rows are always locked in the same order.
    update public.characters x set
      health = greatest(0, public.char_hp(x.health, x.health_at) - case when x.plot = c.plot then dmg_a else dmg_t end),
      health_at = now(),
      wallet = x.wallet + case when x.plot = v_winner then v_coins else -v_coins end
    where x.plot in (c.plot, t.plot);
  else
    v_dur := 35;
    if t.wallet <= 0 then
      v_detail := 'empty';
    elsif random() < (case c.trait when 'sneaky' then 0.75 else 0.6 end) then
      v_detail := 'ok';
      v_coins := least(t.wallet, 5 + floor(random() * 36)::int);
      update public.characters x set wallet = x.wallet + case when x.plot = c.plot then v_coins else -v_coins end
      where x.plot in (c.plot, t.plot);
    else
      v_detail := 'caught';
    end if;
  end if;

  insert into public.character_events (town, at, dur, kind, detail, actor, target, winner, coins, hp_actor, hp_target)
  values (c.town, p_at, v_dur, v_kind, v_detail, c.plot, t.plot, v_winner, v_coins, dmg_a, dmg_t);

  gap_min := case c.trait when 'lazy' then 30 when 'hardworking' then 26 else 28 end + random() * 20;
  return p_at + make_interval(secs => v_dur + gap_min * 60);
end;
$$;

-- Bring a town up to date: everyone whose owner is away and who's due does their next thing.
-- Cheap when nothing is due. At most 200 people and 10 things each per call; the next call goes on.
create or replace function public.advance_town(p_town integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ch record;
  t timestamptz;
  n integer;
  lead_at timestamptz := now() + interval '5 minutes';
  horizon timestamptz := now() + interval '10 minutes';
begin
  if p_town is null or p_town < 1 or p_town > 1000000 then
    return;
  end if;
  -- One update per town at a time; anyone else asking meanwhile just skips.
  if not pg_try_advisory_xact_lock(hashtext('public.advance_town'), p_town) then
    return;
  end if;
  for ch in
    select c.plot, c.next_at from public.characters c
    where c.town = p_town and c.next_at <= horizon and not public.char_online(c.last_seen)
    order by c.next_at
    limit 200
  loop
    t := greatest(ch.next_at, now() - interval '12 hours' + random() * interval '30 minutes');
    n := 0;
    while t <= horizon and n < 10 loop
      -- Anything still to come is announced at least 5 minutes ahead.
      if t > now() and t < lead_at then
        t := lead_at + random() * interval '3 minutes';
      end if;
      t := public.char_auto_event(ch.plot, t);
      n := n + 1;
    end loop;
    update public.characters x set next_at = t where x.plot = ch.plot;
  end loop;
  -- Now and then, forget what happened more than 4 days ago.
  if random() < 0.02 then
    delete from public.character_events e
    where e.id in (select x.id from public.character_events x where x.at < now() - interval '4 days' limit 5000);
  end if;
end;
$$;

-- The owner is back: whatever their person was about to do on their own is called off (coins and
-- health go back), because from now on the owner is in control.
create or replace function public.char_cancel_future(p_plot integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.character_events;
begin
  for e in
    select * from public.character_events x
    where (x.actor = p_plot or x.target = p_plot) and x.at > now() and not x.live
    order by x.id
  loop
    if e.kind = 'steal' and e.coins > 0 then
      update public.characters x set wallet = greatest(0, x.wallet + case when x.plot = e.actor then -e.coins else e.coins end)
      where x.plot in (e.actor, e.target);
    elsif e.kind = 'fight' then
      update public.characters x set
        wallet = greatest(0, x.wallet + case when x.plot = e.winner then -e.coins else e.coins end),
        health = least(100, x.health + case when x.plot = e.actor then e.hp_actor else e.hp_target end)
      where x.plot in (e.actor, e.target);
    end if;
    delete from public.character_events x where x.id = e.id;
  end loop;
end;
$$;

-- 12. What the game calls.

-- A person as JSON (wallet and health are only sent to their owner).
create or replace function public.char_json(c public.characters)
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'plot', c.plot, 'look', c.look, 'age', c.age, 'trait', c.trait, 'job', c.job, 'income', c.income,
    'wallet', c.wallet, 'health', public.char_hp(c.health, c.health_at)
  );
$$;

-- What happened to someone, newest first, as [id, at, kind, detail, mine, other, other's username,
-- won, coins, live]. mine: they did it (rather than it was done to them); won: fights only.
-- Only things that have already started; p_since / p_after_id / p_before narrow it down.
create or replace function public.char_story(
  p_plot integer, p_since timestamptz, p_after_id bigint, p_before timestamptz, p_limit integer
)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_agg(json_build_array(
    s.id, s.at, s.kind, s.detail, s.mine, s.other, s.other_name, s.won, s.coins, s.live
  ) order by s.at_ts desc, s.id desc), '[]'::json)
  from (
    select e.id, e.at as at_ts, floor(extract(epoch from e.at))::bigint as at, e.kind, e.detail,
      e.actor = p_plot as mine,
      case when e.actor = p_plot then e.target else e.actor end as other,
      w.instagram_username as other_name,
      case when e.kind = 'fight' then e.winner = p_plot end as won,
      e.coins, e.live
    from public.character_events e
    left join public.waitlist w on w.plot = case when e.actor = p_plot then e.target else e.actor end
    where (e.actor = p_plot or e.target = p_plot)
      and e.at <= now()
      and (p_since is null or e.at > p_since)
      and (p_after_id is null or e.id > p_after_id)
      and (p_before is null or e.at < p_before)
    order by e.at desc, e.id desc
    limit greatest(1, least(coalesce(p_limit, 40), 60))
  ) s;
$$;

-- Coming into the game: the town catches up, your person stops doing things on their own, and you
-- get what happened since you were last here (first: you've never been in the game).
create or replace function public.game_enter()
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me integer := public.my_plot();
  c public.characters;
  seen timestamptz;
begin
  if me is null then
    raise exception 'join the waitlist first' using hint = 'game_not_on_list';
  end if;
  insert into public.characters (plot, look, age, trait)
  values (me, public.char_look(me), public.char_age(me), public.char_trait(me))
  on conflict (plot) do nothing;
  select * into c from public.characters x where x.plot = me;
  seen := c.last_seen;
  if not public.char_online(seen) then
    perform public.advance_town(c.town);
  end if;
  perform public.char_cancel_future(me);
  -- While you're here, your person does nothing on their own (and catches up on nothing later).
  update public.characters x set last_seen = now(), next_at = greatest(x.next_at, now() + interval '6 minutes')
  where x.plot = me
  returning * into c;
  return json_build_object(
    'now', extract(epoch from now()),
    'char', public.char_json(c),
    'first', seen is null,
    'since', floor(extract(epoch from coalesce(seen, c.created_at)))::bigint,
    -- The first time: the latest of everything so far.
    'events', public.char_story(me, seen, null, null, 40)
  );
end;
$$;

-- Still here (every 30 s while the game is open): keeps you in control and your town going, and
-- returns anything new that happened to you (after event p_after).
create or replace function public.game_ping(p_after bigint default null)
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me integer := public.my_plot();
  c public.characters;
begin
  if me is null then
    raise exception 'join the waitlist first' using hint = 'game_not_on_list';
  end if;
  update public.characters x set last_seen = now(), next_at = greatest(x.next_at, now() + interval '6 minutes')
  where x.plot = me
  returning * into c;
  if not found then
    return public.game_enter();
  end if;
  perform public.advance_town(c.town);
  return json_build_object(
    'now', extract(epoch from now()),
    'char', public.char_json(c),
    'events', public.char_story(me, now() - interval '1 hour', coalesce(p_after, 0), null, 20)
  );
end;
$$;

-- Leaving (closing the page): your person goes back to living on their own straight away.
create or replace function public.game_leave()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.characters x set last_seen = now() - interval '76 seconds',
    next_at = greatest(x.next_at, now() + interval '5 minutes')
  where x.plot = public.my_plot() and public.char_online(x.last_seen);
$$;

-- Older entries of your story (before Unix time p_before, or the latest without it).
create or replace function public.my_story(p_before bigint default null)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me integer := public.my_plot();
begin
  if me is null then
    raise exception 'join the waitlist first' using hint = 'game_not_on_list';
  end if;
  return public.char_story(me, null, null, case when p_before is null then null else to_timestamp(p_before) end, 40);
end;
$$;

-- Fight or steal from someone, as a player (you walked up to them). Same town only; the outcome is
-- decided here. Limits: a fight every 45 s, a theft every 2 min, the same person once in 6 hours.
create or replace function public.char_act(p_kind text, p_target integer)
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me integer := public.my_plot();
  c public.characters;
  t public.characters;
  hp integer;
  thp integer;
  v_detail text := '';
  v_dur integer;
  v_coins integer := 0;
  v_winner integer;
  loser integer;
  dmg_a integer := 0;
  dmg_t integer := 0;
  ev public.character_events;
begin
  if me is null then
    raise exception 'join the waitlist first' using hint = 'game_not_on_list';
  end if;
  if p_kind is null or p_kind not in ('fight', 'steal') then
    raise exception 'unknown action %', p_kind using hint = 'game_bad_action';
  end if;
  if p_target is null or p_target = me then
    raise exception 'nobody to do that to' using hint = 'game_no_target';
  end if;
  -- Lock both people in house order (the same order everything else uses).
  perform 1 from public.characters x where x.plot in (me, p_target) order by x.plot for update;
  select * into c from public.characters x where x.plot = me;
  if not found then
    raise exception 'join the waitlist first' using hint = 'game_not_on_list';
  end if;
  select * into t from public.characters x where x.plot = p_target;
  if not found or t.town <> c.town then
    raise exception 'house % is not in your town', p_target using hint = 'game_no_target';
  end if;
  if exists (
    select 1 from public.character_events e
    where e.actor = me and e.live and e.kind = p_kind
      and e.at > now() - case when p_kind = 'fight' then interval '45 seconds' else interval '2 minutes' end
  ) then
    raise exception 'too soon' using hint = case when p_kind = 'fight' then 'game_fight_wait' else 'game_steal_wait' end;
  end if;

  hp := public.char_hp(c.health, c.health_at);
  thp := public.char_hp(t.health, t.health_at);
  if p_kind = 'fight' then
    if hp < 15 then
      raise exception 'too hurt' using hint = 'game_too_hurt';
    end if;
    v_dur := 6;
    v_winner := case when random() < 0.5 + (hp - thp) / 250.0 then me else p_target end;
    loser := case when v_winner = me then p_target else me end;
    dmg_a := case when v_winner = me then 2 + floor(random() * 7)::int else 10 + floor(random() * 13)::int end;
    dmg_t := case when v_winner = p_target then 2 + floor(random() * 7)::int else 10 + floor(random() * 13)::int end;
    v_coins := least(case when loser = me then c.wallet else t.wallet end, floor(random() * 11)::int);
    update public.characters x set
      health = greatest(0, public.char_hp(x.health, x.health_at) - case when x.plot = me then dmg_a else dmg_t end),
      health_at = now(),
      wallet = x.wallet + case when x.plot = v_winner then v_coins else -v_coins end
    where x.plot in (me, p_target);
  else
    if exists (
      select 1 from public.character_events e
      where e.actor = me and e.target = p_target and e.live and e.kind = 'steal' and e.at > now() - interval '6 hours'
    ) then
      raise exception 'already robbed them' using hint = 'game_steal_again';
    end if;
    v_dur := 4;
    if t.wallet <= 0 then
      v_detail := 'empty';
    elsif random() < (case c.trait when 'sneaky' then 0.7 else 0.55 end) then
      v_detail := 'ok';
      v_coins := least(t.wallet, 5 + floor(random() * 36)::int);
      update public.characters x set wallet = x.wallet + case when x.plot = me then v_coins else -v_coins end
      where x.plot in (me, p_target);
    else
      v_detail := 'caught';
    end if;
  end if;

  insert into public.character_events (town, at, dur, kind, detail, actor, target, winner, coins, hp_actor, hp_target, live)
  values (c.town, now(), v_dur, p_kind, v_detail, me, p_target, v_winner, v_coins, dmg_a, dmg_t, true)
  returning * into ev;
  update public.characters x set last_seen = now(), next_at = greatest(x.next_at, now() + interval '6 minutes')
  where x.plot = me
  returning * into c;
  return json_build_object(
    'id', ev.id, 'kind', ev.kind, 'detail', ev.detail, 'winner', ev.winner, 'coins', ev.coins,
    'targetName', (select w.instagram_username from public.waitlist w where w.plot = p_target),
    'char', public.char_json(c)
  );
end;
$$;

-- What's going on in a town, for the map to act out: everything from 20 minutes ago to 20 minutes
-- ahead as [id, at, dur, kind, detail, actor, target, winner, coins, live], who's in the game
-- right now, and the server's clock (so every screen shows the same moment). Anyone can call it.
create or replace function public.town_events(p_town integer)
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t integer := greatest(1, least(1000000, coalesce(p_town, 1)));
begin
  perform public.advance_town(t);
  return json_build_object(
    'now', extract(epoch from now()),
    'events', coalesce((
      select json_agg(json_build_array(
        e.id, floor(extract(epoch from e.at))::bigint, e.dur, e.kind, e.detail, e.actor, e.target, e.winner, e.coins, e.live
      ) order by e.at, e.id)
      from public.character_events e
      where e.town = t and e.at > now() - interval '20 minutes' and e.at < now() + interval '20 minutes'
    ), '[]'::json),
    'online', coalesce((
      select json_agg(c.plot order by c.plot)
      from public.characters c
      where c.town = t and public.char_online(c.last_seen)
    ), '[]'::json)
  );
end;
$$;

revoke execute on function public.char_look(integer) from public, anon, authenticated;
revoke execute on function public.char_trait(integer) from public, anon, authenticated;
revoke execute on function public.char_age(integer) from public, anon, authenticated;
revoke execute on function public.char_hp(smallint, timestamptz) from public, anon, authenticated;
revoke execute on function public.char_online(timestamptz) from public, anon, authenticated;
revoke execute on function public.char_pick_task(text, integer) from public, anon, authenticated;
revoke execute on function public.char_auto_event(integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.advance_town(integer) from public, anon, authenticated;
revoke execute on function public.char_cancel_future(integer) from public, anon, authenticated;
revoke execute on function public.char_json(public.characters) from public, anon, authenticated;
revoke execute on function public.char_story(integer, timestamptz, bigint, timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.game_enter() from public, anon;
revoke execute on function public.game_ping(bigint) from public, anon;
revoke execute on function public.game_leave() from public, anon;
revoke execute on function public.my_story(bigint) from public, anon;
revoke execute on function public.char_act(text, integer) from public, anon;
revoke execute on function public.town_events(integer) from public;
grant execute on function public.game_enter() to authenticated;
grant execute on function public.game_ping(bigint) to authenticated;
grant execute on function public.game_leave() to authenticated;
grant execute on function public.my_story(bigint) to authenticated;
grant execute on function public.char_act(text, integer) to authenticated;
grant execute on function public.town_events(integer) to anon, authenticated;

-- Removed in older versions of this file (the map now reads waitlist_world).
drop function if exists public.waitlist_position();
drop function if exists public.waitlist_houses();
