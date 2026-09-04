-- Push notification types beyond the feedback reminder (docs/TRD.md §14). — 2026-09-03.
--
-- Four new notifications: a meetup reminder ~15 minutes before `start_time`, a chat
-- notification when the recipient has no live socket, a "meetup near you" nudge, and a
-- re-engagement nudge for someone who has not opened the app in a while.
--
-- Three of the four need state that did not exist:
--   * the sweep had only two idempotency stamps, both already taken, so the pre-event
--     reminder brings its own;
--   * "inactive" had no backing column at all — `users` carried only `created_at`, and
--     `device_keys.last_seen_at` is written at device registration, not on app open;
--   * the nearby nudge reads `users.location`, which had no index and no record of when
--     it was set, so a stale point could not be told from a fresh one.
--
-- RLS stays on everywhere: the API enforces access in code and writes with the
-- service-role key.

-- ── Idempotency stamp for the pre-event reminder ──────────────────────────────
-- Claimed before the send, exactly like feedback_reminder_sent_at: a missed reminder
-- costs one notification, a double send is a user-visible defect.
alter table events add column if not exists start_reminder_sent_at timestamptz;

-- Only ever scanned for events starting within the next few minutes.
create index if not exists events_start_reminder_idx
  on events (start_time)
  where start_reminder_sent_at is null;

-- ── Activity, for the re-engagement nudge ─────────────────────────────────────
-- Touched from the auth middleware, throttled so it is not a write per request. Null
-- means "never seen since this column existed" and is deliberately NOT treated as
-- inactive, so applying this migration cannot nudge the whole table at once.
alter table users add column if not exists last_active_at timestamptz;

-- When the re-engagement nudge last went out. Separate from the daily quota: the quota
-- stops a burst, this enforces the long gap between nudges.
alter table users add column if not exists last_reengaged_at timestamptz;

-- ── Location freshness, for the nearby nudge ──────────────────────────────────
-- `users.location` already existed but was write-only and unindexed: no query read it,
-- there was no GiST index (unlike events_location_idx), and nothing recorded its age.
-- docs/RULES.md keeps location one-shot with no background tracking — this records when
-- the single fix was taken so a nudge can refuse to use a stale one. No new fix is taken.
alter table users add column if not exists location_updated_at timestamptz;

create index if not exists users_location_idx on users using gist (location);

-- ── Per-type opt-out ──────────────────────────────────────────────────────────
-- An absent row means enabled, so this migration does not silently opt anyone out of the
-- feedback reminder they already receive. `type` is closed: an unknown type would be a
-- preference nothing reads.
create table if not exists notification_prefs (
  user_id uuid not null references users (id) on delete cascade,
  type text not null check (
    type in ('feedback', 'meetup_soon', 'chat', 'nearby', 'reengagement')
  ),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, type)
);

alter table notification_prefs enable row level security;

-- ── Daily caps ────────────────────────────────────────────────────────────────
-- The unsolicited types get a persisted per-day ceiling on top of the in-process
-- debounce, so a restart cannot reset someone's budget. `meetup_soon` is absent on
-- purpose: it is bounded by its own per-event stamp and cannot repeat.
alter table usage_quotas drop constraint if exists usage_quotas_resource_check;

alter table usage_quotas add constraint usage_quotas_resource_check check (
  resource in (
    'events_created',
    'feedback_submitted',
    'groq_turns',
    'notif_chat',
    'notif_nearby',
    'notif_reengagement'
  )
);

-- ── Who to tell about a new nearby meetup ─────────────────────────────────────
-- Driven per created event rather than per user: one query when a meetup appears, instead
-- of a radius scan per user on every sweep pass.
--
-- `events_nearby` could not be reused — it takes coordinates rather than an event, admits
-- 'full' and 'ongoing' meetups, and has no limit. This returns only people who could
-- actually still join: not the host, not already a member, and only while the meetup is
-- open and in the future.
create or replace function events_nearby_users(
  p_event_id uuid,
  p_radius double precision default 5000,
  p_max_age_days integer default 7,
  p_limit integer default 200
)
returns table (user_id uuid, distance_m double precision)
language sql
stable
as $$
  select
    u.id as user_id,
    st_distance(u.location, e.location) as distance_m
  from users u
  cross join events e
  where e.id = p_event_id
    and u.id <> e.host_id
    -- A location that was never set, or set too long ago to still mean anything.
    and u.location is not null
    and u.location_updated_at is not null
    and u.location_updated_at > now() - make_interval(days => p_max_age_days)
    and st_dwithin(u.location, e.location, p_radius)
    and not exists (
      select 1
      from group_members gm
      where gm.event_id = e.id and gm.user_id = u.id
    )
    and e.start_time > now()
    and event_status(e.status, e.start_time) = 'open'
  order by distance_m asc
  limit p_limit
$$;

-- ── Who to re-engage, and with what ───────────────────────────────────────────
-- One statement rather than a candidate query plus a lookup per member.
--
-- Reads `group_members` and `display_name` only. It deliberately cannot see `feedback` or
-- `connections`: naming someone the member rated, or who picked them, would leak exactly
-- what docs/RULES.md keeps private. Co-membership is already mutual knowledge — the two
-- shared a group chat — so naming a co-member reveals nothing new.
--
-- `member_name` is picked alphabetically rather than by join order, so the copy is stable
-- across runs and the choice says nothing about who joined when.
create or replace function reengagement_candidates(
  p_inactive_days integer default 7,
  p_gap_days integer default 14,
  p_limit integer default 50
)
returns table (
  user_id uuid,
  language text,
  event_id uuid,
  event_title text,
  member_name text,
  other_count bigint
)
language sql
stable
as $$
  with dormant as (
    select u.id, u.language
    from users u
    -- Null means "not seen since the column existed", which is not evidence of absence.
    where u.last_active_at is not null
      and u.last_active_at < now() - make_interval(days => p_inactive_days)
      and (
        u.last_reengaged_at is null
        or u.last_reengaged_at < now() - make_interval(days => p_gap_days)
      )
    limit p_limit
  ),
  -- The most recent group each dormant member is in that has somebody else in it.
  latest as (
    select distinct on (d.id)
      d.id as user_id,
      d.language,
      e.id as event_id,
      e.title as event_title
    from dormant d
    join group_members gm on gm.user_id = d.id
    join events e on e.id = gm.event_id
    where exists (
      select 1
      from group_members other
      where other.event_id = e.id and other.user_id <> d.id
    )
    order by d.id, e.start_time desc
  )
  select
    l.user_id,
    l.language,
    l.event_id,
    l.event_title,
    (
      select o.display_name
      from group_members g
      join users o on o.id = g.user_id
      where g.event_id = l.event_id and g.user_id <> l.user_id
      order by o.display_name asc
      limit 1
    ) as member_name,
    (
      -- Co-members besides the one named above.
      select count(*) - 1
      from group_members g
      where g.event_id = l.event_id and g.user_id <> l.user_id
    ) as other_count
  from latest l
$$;

-- The API calls this via rpc(); new Postgres functions are invisible to PostgREST until
-- its schema cache reloads. Run once after applying: `notify pgrst, 'reload schema'`.

