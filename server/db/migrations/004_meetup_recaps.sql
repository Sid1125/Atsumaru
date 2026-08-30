-- Vibe recap (docs/AI.md §6a, docs/IDEA.md §10) — 2026-08-30.
--
-- After a meetup completes, each member who submitted feedback gets one short
-- AI-written recap of what their own ratings imply ("You clicked with people who love
-- the outdoors"). Cached per (event, user) because it costs a Groq call and never
-- changes once written: the ratings it summarises are already final.
--
-- Per-user, not per-event, and that is the privacy line. A recap is derived from the
-- caller's OWN ratings, so two members of the same meetup see different text and neither
-- can infer the other's picks (docs/RULES.md §8). `user_id` is therefore part of the key,
-- and nothing here records who was rated — only the aggregate traits.
--
-- `source` distinguishes a real Groq answer from the deterministic template the route
-- falls back to when GROQ_API_KEY is absent or the model returns something unusable.
-- Without it a template line is indistinguishable from a model one, which would make
-- "did the AI path actually run?" unanswerable from the data.

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

-- The API uses the service-role key and enforces access in code; RLS stays on so the
-- anon/authenticated keys cannot read another member's recap directly.
alter table meetup_recaps enable row level security;
