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

-- current_size for the API's Event model.
create or replace view event_sizes as
  select e.id as event_id, count(gm.id) as current_size
  from events e
  left join group_members gm on gm.event_id = e.id
  group by e.id;

-- The API uses the service-role key and enforces access in code; RLS stays on so
-- anon/authenticated keys cannot read these tables directly.
alter table users enable row level security;
alter table events enable row level security;
alter table group_members enable row level security;
alter table messages enable row level security;
alter table feedback enable row level security;
alter table connections enable row level security;
