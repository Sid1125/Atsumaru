-- Per-user usage quotas (docs/ATSUMARU_SECURITY_COMPLETE §19.1 "Medium"/"Very strict"). — 2026-09-02.
--
-- Rate limits (in-process, in `utils/rateLimit.ts`) stop one burst; quotas are the
-- cumulative allowance over a day and persist across restarts so they cannot be reset by
-- recycling the process. Unlike a rate limit, a spent quota does not recover within a
-- window — it resets once per calendar day (UTC).
--
-- `bump_quota` is the only writer. It atomically increments the user's usage for a
-- resource for today and reports whether the call may proceed, refusing (without
-- incrementing) once the daily cap is reached. RLS stays on so the anon/authenticated
-- keys cannot read or write another user's quota directly; the API enforces limits in
-- code and writes through the service-role key.

create table if not exists usage_quotas (
  user_id uuid not null references users (id) on delete cascade,
  resource text not null check (
    resource in ('events_created', 'feedback_submitted', 'groq_turns')
  ),
  day date not null default current_date,
  usage integer not null default 0 check (usage >= 0),
  primary key (user_id, resource, day)
);

alter table usage_quotas enable row level security;

-- Atomic increment-if-under-cap. Returns true when the call may proceed and usage has
-- been counted; returns false (and does NOT increment) when the daily cap is already met.
create or replace function bump_quota(
  p_user uuid,
  p_resource text,
  p_limit integer
)
returns boolean
language plpgsql
as $$
declare
  u integer;
begin
  insert into usage_quotas (user_id, resource, day, usage)
  values (p_user, p_resource, current_date, 1)
  on conflict (user_id, resource, day)
  do update set usage = usage_quotas.usage + 1
  where usage_quotas.usage < p_limit
  returning usage into u;

  if u is null then
    return false;
  end if;
  return true;
end;
$$;

-- The API calls this via rpc(); new Postgres functions are invisible to PostgREST until
-- its schema cache reloads. Run once after applying: `notify pgrst, 'reload schema'`.
