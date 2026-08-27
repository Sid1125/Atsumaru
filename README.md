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

Working: API skeleton with the `{ success, data }` contract, Supabase JWT auth
middleware, Socket.io rooms (`group:{event_id}`, `dm:{connection_id}`), Groq-backed
`POST /api/onboarding/chat` with validated extraction, matching/feedback math with
tests, and the full mobile shell (navigation, API client, socket service, i18n
JP/EN/ZH, theme, Login → AI chat → profile confirm → Discover → Meetup → feedback).

Not wired yet — each returns `501 NOT_IMPLEMENTED` with a `TODO` at the route:

- Supabase-backed events, members, join/leave, match preview, messages, feedback, connections
- Handle suggestion/availability and `POST /onboarding/complete` (needs `embed()` + DB)
- LINE/Google OAuth redirect + callback (the client currently shows a "not wired" alert)
- BullMQ + Upstash feedback-reminder job and Expo push notifications

The map renders a placeholder until `EXPO_PUBLIC_MAPBOX_TOKEN` is set **and** the app
runs in a dev build — `@rnmapbox/maps` needs native code and does not work in Expo Go.
