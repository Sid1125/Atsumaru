-- Hardening found while proving the schema against a live project (2026-08-29).
-- Idempotent, like schema.sql — safe to re-run.

-- 1. event_sizes ran as its owner, so it bypassed the deny-all RLS posture and would
--    expose every event id and group size to the anon key. security_invoker makes the
--    caller's permissions apply.
alter view event_sizes set (security_invoker = true);

-- 2. DM history was not referentially tied to connections: a bad connection_id was
--    silently storable and deleting a connection orphaned its messages.
alter table messages
  drop constraint if exists messages_connection_id_fkey;
alter table messages
  add constraint messages_connection_id_fkey
  foreign key (connection_id) references connections (id) on delete cascade;

-- 3. push_tokens had no primary key. The unique pair is the natural one.
alter table push_tokens drop constraint if exists push_tokens_pkey;
alter table push_tokens add primary key (user_id, token);

-- 4. Indexes for the filters the sweep, the connections list, and feedback actually
--    use. Every one of these columns was being sequentially scanned.
create index if not exists group_members_user_idx on group_members (user_id);
create index if not exists feedback_event_idx on feedback (event_id);
create index if not exists feedback_from_user_idx on feedback (from_user);
create index if not exists feedback_to_user_idx on feedback (to_user);
create index if not exists connections_user_a_idx on connections (user_a);
create index if not exists connections_user_b_idx on connections (user_b);
create index if not exists push_tokens_user_idx on push_tokens (user_id);

-- The sweep selects on (start_time, status) together; TRACKER.md §5 flagged this.
create index if not exists events_start_status_idx on events (start_time, status);

-- 5. The RPCs are security invoker and are called with the service-role key, which
--    bypasses RLS. Pin search_path anyway so a schema-shadowing object cannot change
--    what st_dwithin or event_status resolves to.
alter function event_status(text, timestamptz) set search_path = public, extensions;
alter function events_nearby(double precision, double precision, double precision, text)
  set search_path = public, extensions;
alter function event_detail(uuid) set search_path = public, extensions;
alter function events_for_user(uuid) set search_path = public, extensions;
alter function join_event(uuid, uuid) set search_path = public, extensions;
