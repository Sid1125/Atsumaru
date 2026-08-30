-- Atsumaru schema (Supabase Postgres). Run in the Supabase SQL editor.
-- Mirrors the models in docs/API_STRUCTURE.md §2.

create extension if not exists postgis;
create extension if not exists vector;

-- 384 dims = sentence-transformers/all-MiniLM-L6-v2
create table if not exists users (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique not null,
  display_name text not null,
  real_name text,                      -- PRIVATE: never returned to other users
  avatar_url text,
  language text not null default 'en' check (language in ('ja', 'en', 'zh')),
  interests text[] not null default '{}',
  personality text[] not null default '{}',
  reputation_score numeric not null default 50 check (reputation_score between 0 and 100),
  preference_vector vector(384),
  location geography(point, 4326),
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references users (id) on delete cascade,
  title text not null,
  category text not null,
  description text not null default '',
  venue_name text not null,
  location geography(point, 4326) not null,
  start_time timestamptz not null,
  max_size int not null check (max_size between 4 and 6),
  status text not null default 'open'
    check (status in ('open', 'full', 'ongoing', 'completed')),
  created_at timestamptz not null default now()
);

-- Added after the first release; the sweep in src/jobs stamps both.
alter table events add column if not exists feedback_reminder_sent_at timestamptz;
alter table events add column if not exists reputation_settled_at timestamptz;

create index if not exists events_location_idx on events using gist (location);
create index if not exists events_start_time_idx on events (start_time);

create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events (id) on delete cascade,
  connection_id uuid,                  -- set for 1:1 messages instead of event_id
  sender_id uuid not null references users (id) on delete cascade,
  message text not null check (length(message) between 1 and 2000),
  created_at timestamptz not null default now(),
  check ((event_id is null) <> (connection_id is null))
);

create index if not exists messages_event_idx on messages (event_id, created_at);
create index if not exists messages_connection_idx on messages (connection_id, created_at);

-- One rating per (event, rater, ratee). Private: only the server reads these.
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  from_user uuid not null references users (id) on delete cascade,
  to_user uuid not null references users (id) on delete cascade,
  rating text not null check (rating in ('meh', 'good', 'fire')),
  wants_connection boolean not null default false,
  rejoin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, from_user, to_user),
  check (from_user <> to_user)
);

-- user_a < user_b keeps a pair unique regardless of who submitted first.
create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  user_a uuid not null references users (id) on delete cascade,
  user_b uuid not null references users (id) on delete cascade,
  mutual boolean not null default false,
  unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, user_a, user_b),
  check (user_a < user_b)
);

-- OAuth bridge (docs/TRD.md §5). LINE is not a native Supabase provider, so the API
-- exchanges the code itself and maps the provider subject to a Supabase auth user.
create table if not exists oauth_identities (
  provider text not null check (provider in ('line', 'google')),
  provider_sub text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider, provider_sub)
);

-- Expo push targets for meetup/feedback notifications (docs/TRD.md §14).
create table if not exists push_tokens (
  user_id uuid not null references users (id) on delete cascade,
  token text not null,
  platform text,
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

-- One cached vibe recap per member per finished meetup (docs/AI.md §6a).
-- Keyed by user, not just event: the text is derived from the caller's own ratings, so
-- two members see different recaps and neither can infer the other's picks
-- (docs/RULES.md §8). Nothing here records who was rated, only aggregate traits.
-- `source` says whether Groq answered or the deterministic template did.
create table if not exists meetup_recaps (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  recap text not null check (length(recap) between 1 and 400),
  traits text[] not null default '{}',
  language text not null check (language in ('ja', 'en', 'zh')),
  source text not null check (source in ('ai', 'template')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- current_size for the API's Event model.
create or replace view event_sizes as
  select e.id as event_id, count(gm.id) as current_size
  from events e
  left join group_members gm on gm.event_id = e.id
  group by e.id;

-- A meetup becomes 'ongoing' at its start time and 'completed' two hours later. The
-- API never recomputes this: reads go through the functions below, and the sweep in
-- src/jobs writes the same transition back to events.status.
create or replace function event_status(p_stored text, p_start timestamptz)
returns text
language sql
stable
as $$
  select case
    when p_stored = 'completed' then 'completed'
    when now() >= p_start + interval '2 hours' then 'completed'
    when now() >= p_start then 'ongoing'
    else p_stored
  end
$$;

-- Nearby events for the map. PostGIS distance filtering cannot be expressed
-- through the supabase-js query builder, so the API calls this via rpc().
create or replace function events_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius double precision default 5000,
  p_category text default null
)
returns table (
  id uuid,
  host_id uuid,
  title text,
  category text,
  description text,
  venue_name text,
  lat double precision,
  lng double precision,
  start_time timestamptz,
  max_size int,
  current_size bigint,
  status text,
  distance_m double precision
)
language sql
stable
as $$
  select
    e.id,
    e.host_id,
    e.title,
    e.category,
    e.description,
    e.venue_name,
    st_y(e.location::geometry) as lat,
    st_x(e.location::geometry) as lng,
    e.start_time,
    e.max_size,
    coalesce(s.current_size, 0) as current_size,
    event_status(e.status, e.start_time) as status,
    st_distance(e.location, st_point(p_lng, p_lat)::geography) as distance_m
  from events e
  left join event_sizes s on s.event_id = e.id
  where st_dwithin(e.location, st_point(p_lng, p_lat)::geography, p_radius)
    and (p_category is null or e.category = p_category)
    and event_status(e.status, e.start_time) in ('open', 'full', 'ongoing')
  order by distance_m asc
$$;

-- Single event with its computed size, in the same shape as events_nearby.
create or replace function event_detail(p_event_id uuid)
returns table (
  id uuid,
  host_id uuid,
  title text,
  category text,
  description text,
  venue_name text,
  lat double precision,
  lng double precision,
  start_time timestamptz,
  max_size int,
  current_size bigint,
  status text
)
language sql
stable
as $$
  select
    e.id,
    e.host_id,
    e.title,
    e.category,
    e.description,
    e.venue_name,
    st_y(e.location::geometry) as lat,
    st_x(e.location::geometry) as lng,
    e.start_time,
    e.max_size,
    coalesce(s.current_size, 0) as current_size,
    event_status(e.status, e.start_time) as status
  from events e
  left join event_sizes s on s.event_id = e.id
  where e.id = p_event_id
$$;

-- Events the caller hosts or has joined.
create or replace function events_for_user(p_user_id uuid)
returns table (
  id uuid,
  host_id uuid,
  title text,
  category text,
  description text,
  venue_name text,
  lat double precision,
  lng double precision,
  start_time timestamptz,
  max_size int,
  current_size bigint,
  status text
)
language sql
stable
as $$
  select d.*
  from events e
  cross join lateral event_detail(e.id) d
  where e.host_id = p_user_id
     or exists (
       select 1 from group_members gm
       where gm.event_id = e.id and gm.user_id = p_user_id
     )
  order by e.start_time asc
$$;

-- Joining must be atomic: two people racing for the last seat would both pass a
-- read-then-insert check in the API. The row lock serialises joins per event.
create or replace function join_event(p_event_id uuid, p_user_id uuid)
returns table (status text, current_size bigint)
language plpgsql
as $$
declare
  v_max int;
  v_status text;
  v_start timestamptz;
  v_size bigint;
begin
  select e.max_size, e.status, e.start_time into v_max, v_status, v_start
  from events e where e.id = p_event_id
  for update;

  if v_max is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  select count(*) into v_size from group_members gm where gm.event_id = p_event_id;

  -- Already a member: report the current state instead of failing.
  if exists (
    select 1 from group_members gm
    where gm.event_id = p_event_id and gm.user_id = p_user_id
  ) then
    return query
      select case when v_size >= v_max then 'matched' else 'joined' end, v_size;
    return;
  end if;

  -- Capacity before status: filling the last seat flips status to 'full', so testing
  -- status first would report a full event as merely EVENT_CLOSED.
  if v_size >= v_max then
    raise exception 'EVENT_FULL';
  end if;

  -- Derived status, so a meetup that has already started is closed even if the
  -- sweep has not written the transition yet.
  if event_status(v_status, v_start) <> 'open' then
    raise exception 'EVENT_CLOSED';
  end if;

  insert into group_members (event_id, user_id) values (p_event_id, p_user_id);
  v_size := v_size + 1;

  if v_size >= v_max then
    update events set status = 'full' where id = p_event_id;
  end if;

  return query
    select case when v_size >= v_max then 'matched' else 'joined' end, v_size;
end;
$$;

-- The API uses the service-role key and enforces access in code; RLS stays on so
-- anon/authenticated keys cannot read these tables directly.
alter table users enable row level security;
alter table events enable row level security;
alter table group_members enable row level security;
alter table messages enable row level security;
alter table feedback enable row level security;
alter table connections enable row level security;
alter table oauth_identities enable row level security;
alter table push_tokens enable row level security;
alter table meetup_recaps enable row level security;
