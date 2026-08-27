# Atsumaru (集まる)

> Not a dating app — friendship first.

Japan-focused social discovery: AI onboarding → nearby meetup → 4–6 person group → group chat → private post-meetup feedback → mutual 1:1 unlock.

Product docs live in [`docs/`](./docs) — `PRD.md`, `DESIGN.md`, `TRD.md`, `RULES.md`, `API_STRUCTURE.md`, `AI.md`.

## Layout

```text
apps/mobile/   React Native + Expo (TypeScript) client
server/        Node + Express + Socket.io API
server/db/     Supabase schema (Postgres + PostGIS + pgvector)
docs/          Product, design, and contract docs
```

## Setup

```bash
npm run setup                       # install both packages

cp server/.env.example server/.env
cp apps/mobile/.env.example apps/mobile/.env
```

Fill in Supabase, Groq, HuggingFace, and Mapbox values. `apps/mobile/.env` holds only
`EXPO_PUBLIC_*` values — they ship inside the app bundle, so no secrets there.

Then apply the database schema: paste `server/db/schema.sql` into the Supabase SQL editor.

## Run

```bash
npm run server      # API on http://localhost:4000/api  (health: /health)
npm run mobile      # Expo dev server
npm test            # server unit tests (matching / feedback math)
npm run typecheck   # both packages
```

## Current state

Working: the full API against Supabase — auth middleware, users, onboarding chat +
handle suggestion/availability + profile completion (with embedding), events
(nearby/detail/create/mine/join/leave/members/match-preview), group chat, private
feedback with reputation + preference-vector learning and mutual-only connection
unlock, DMs, and Socket.io rooms (`group:{event_id}`, `dm:{connection_id}`,
`user:{user_id}`) that check membership and persist before broadcast. Matching and
feedback math have unit tests. The mobile shell is complete (navigation, API client,
socket service, i18n JP/EN/ZH, theme, Login → AI chat → profile confirm → Discover →
Meetup → feedback).

Not wired yet:

- LINE/Google OAuth redirect + callback — `501 NOT_IMPLEMENTED`; the client shows a "not wired" alert
- BullMQ + Upstash feedback-reminder job and Expo push notifications

Data routes answer `503 DB_UNAVAILABLE` until `server/.env` has Supabase keys, and
onboarding chat answers `503 AI_UNAVAILABLE` without `GROQ_API_KEY`.

The map renders a placeholder until `EXPO_PUBLIC_MAPBOX_TOKEN` is set **and** the app
runs in a dev build — `@rnmapbox/maps` needs native code and does not work in Expo Go.
