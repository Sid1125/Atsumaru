-- Keepalive for the Supabase free tier (2026-08-30).
--
-- Free projects pause after ~7 days with no activity, and a paused project has to be
-- restored by hand before the API works again. A once-a-day request is enough to keep
-- it awake. This gives that request something cheap and observable to hit.
--
-- Deliberately does NOT touch any product table: the ping must never be confusable
-- with real traffic, and must not depend on the deny-all RLS posture in schema.sql.

create table if not exists keepalive (
  id boolean primary key default true,
  last_ping timestamptz not null default now(),
  ping_count bigint not null default 0,
  constraint keepalive_single_row check (id)
);

insert into keepalive (id) values (true) on conflict (id) do nothing;

alter table keepalive enable row level security;

-- security definer so the anon key can run it without a policy on the table itself.
-- It writes one row and returns it, so the workflow can prove the round trip reached
-- Postgres rather than stopping at PostgREST.
create or replace function ping_keepalive()
returns table (last_ping timestamptz, ping_count bigint)
language sql
security definer
set search_path = public
as $$
  update keepalive
     set last_ping = now(),
         ping_count = keepalive.ping_count + 1
   where id
  returning keepalive.last_ping, keepalive.ping_count;
$$;

-- The anon key is all the scheduled job needs; the service-role key stays out of CI.
grant execute on function ping_keepalive() to anon;

revoke all on table keepalive from anon, authenticated;
