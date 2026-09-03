-- Backend hardening from the TRACKER.md §5 / §1e list (2026-09-03).
-- Idempotent, like every migration here — safe to re-run.
--
-- schema.sql carries all of this too, so a fresh project comes up identical in one
-- paste. This file is only what a project already carrying 001–004 still needs.

-- 1. join_event's already-a-member early return read 'matched' off group size alone, so
--    re-joining a *completed* meetup answered 'matched' — the one join response that
--    could contradict event_status(). 'matched' now means what §3.5 says it means: the
--    group filled while it was still forming.
create or replace function join_event(p_event_id uuid, p_user_id uuid)
returns table (status text, current_size bigint)
language plpgsql
set search_path = public, extensions
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

  -- Already a member: report the current state instead of failing. 'matched' is withheld
  -- once the meetup has started or finished.
  if exists (
    select 1 from group_members gm
    where gm.event_id = p_event_id and gm.user_id = p_user_id
  ) then
    return query
      select case
        when v_size >= v_max and event_status(v_status, v_start) in ('open', 'full')
          then 'matched'
        else 'joined'
      end, v_size;
    return;
  end if;

  -- Capacity before status: a full event is full, not merely "closed".
  if v_size >= v_max then
    raise exception 'EVENT_FULL';
  end if;

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

-- 2. POST /events inserted the event and the host's group_members row in two separate
--    statements, so a failure between them left a group with no members. One
--    transaction now, the same reason join_event is one.
create or replace function create_event(
  p_host_id uuid,
  p_title text,
  p_category text,
  p_description text,
  p_venue_name text,
  p_lat double precision,
  p_lng double precision,
  p_start_time timestamptz,
  p_max_size int
)
returns uuid
language plpgsql
set search_path = public, extensions
as $$
declare
  v_event_id uuid;
begin
  insert into events (
    host_id, title, category, description, venue_name, location, start_time, max_size
  )
  values (
    p_host_id,
    p_title,
    p_category,
    p_description,
    p_venue_name,
    st_setsrid(st_point(p_lng, p_lat), 4326)::geography,
    p_start_time,
    p_max_size
  )
  returning id into v_event_id;

  insert into group_members (event_id, user_id) values (v_event_id, p_host_id);

  return v_event_id;
end;
$$;

-- 3. Expo delivery is two-phase: a send returns a ticket, and the outcome only appears
--    on a receipt minutes later. Tickets park here for a later sweep pass to collect.
create table if not exists push_receipts (
  ticket_id text primary key,
  token text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_receipts_created_idx on push_receipts (created_at);

alter table push_receipts enable row level security;

-- 4. Message history now orders by (created_at, id): a batch insert shares a timestamp,
--    which left the order arbitrary and let paging skip or repeat a row. Rebuild the two
--    indexes so the sort is still index-supported. `create index if not exists` will not
--    widen an existing index, hence the drop.
drop index if exists messages_event_idx;
create index messages_event_idx on messages (event_id, created_at, id);

drop index if exists messages_connection_idx;
create index messages_connection_idx on messages (connection_id, created_at, id);

-- PostgREST caches the function list, so create_event stays invisible (PGRST202) until
-- it reloads — see CLAUDE.md.
notify pgrst, 'reload schema';
