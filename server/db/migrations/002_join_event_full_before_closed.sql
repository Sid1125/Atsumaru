-- join_event reported EVENT_CLOSED when an event was merely full (2026-08-29).
--
-- Filling the last seat flips status to 'full', so the next joiner failed the
-- `status <> 'open'` test before ever reaching the size test and got EVENT_CLOSED.
-- Proven by racing two joiners for one seat: the loser saw EVENT_CLOSED, and
-- events/routes.ts maps that to 409 "This meetup is closed" rather than "full".
--
-- Capacity is the more specific condition, so it is tested first. A meetup that has
-- started but still has room correctly stays EVENT_CLOSED.

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

  -- Already a member: report the current state instead of failing.
  if exists (
    select 1 from group_members gm
    where gm.event_id = p_event_id and gm.user_id = p_user_id
  ) then
    return query
      select case when v_size >= v_max then 'matched' else 'joined' end, v_size;
    return;
  end if;

  -- Capacity before status: a full event is full, not merely "closed".
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
