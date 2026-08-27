# Atsumaru (集まる)

> Not a dating app — friendship first.

Japan-focused social discovery: AI onboarding → nearby meetup → 4–6 person group → group chat → private post-meetup feedback → mutual 1:1 unlock.

Product docs live in [`docs/`](./docs) — `PRD.md`, `DESIGN.md`, `TRD.md`, `RULES.md`, `API_STRUCTURE.md`, `AI.md`.
Build status and the remaining work are tracked in [`TRACKER.md`](./TRACKER.md).

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

Fill in Supabase, Groq, HuggingFace, OAuth, and Mapbox values. `apps/mobile/.env` holds
only `EXPO_PUBLIC_*` values — they ship inside the app bundle, so no secrets there.

Then apply the database schema: paste `server/db/schema.sql` into the Supabase SQL editor.
It is safe to paste again after a pull — every statement is `create … if not exists`,
`create or replace`, or `add column if not exists`.

Optional demo data, once `server/.env` has the Supabase keys:

```bash
npm run seed             # 6 demo users, 4 meetups around Shibuya, chat history
npm run seed -- --tokens # also print an access token per demo user
npm run seed -- --reset  # remove the demo users again
```

## Run

```bash
npm run server      # API on http://localhost:4000/api  (health: /health)
npm run mobile      # Expo dev server
npm test            # server unit tests
npm run typecheck   # both packages
```

## Current state

Working: the full documented API against Supabase — OAuth sign-in for LINE and Google,
users, onboarding chat + handle suggestion/availability + profile completion (with
embedding), events (nearby/detail/create/mine/join/leave/members/match-preview), group
chat, private feedback with reputation + preference-vector learning and mutual-only
connection unlock, DMs, and Socket.io rooms (`group:{event_id}`, `dm:{connection_id}`,
`user:{user_id}`) that check membership and persist before broadcast. A post-meetup
sweep closes meetups out, sends the Expo feedback reminder ~1h after `start_time`, and
docks reputation from members who never submit feedback. The mobile shell is complete
(navigation, API client, socket service, i18n JP/EN/ZH, theme, Login → AI chat →
profile confirm → Discover → Meetup → feedback).

### Authentication

`GET /api/auth/line` and `GET /api/auth/google` redirect to the provider; the provider
returns to `GET /api/auth/callback`, which exchanges the code, verifies the `id_token`,
and mints a Supabase session. Both providers need their console to list
`OAUTH_CALLBACK_URL` as an allowed redirect URI. Add `?redirect_to=app` to come back
through `atsumaru://auth?code=…`; the app then posts that one-time code to
`POST /api/auth/session` — tokens never travel in a URL.

### Background work

The sweep runs through BullMQ when `REDIS_URL` is set (Upstash's free `rediss://` URL
works) and on a five-minute in-process timer otherwise. Both drivers run the same code;
if Redis is unreachable the API logs it and falls back to the timer.

Not wired yet:

- Mobile login screen still shows a "not wired" alert; the OAuth endpoints above are ready for it
- Mobile DM/connections screens, push-token registration, create-event UI, and settings
- Real Mapbox rendering (needs a token and a native dev build)

Two endpoints go beyond `docs/API_STRUCTURE.md`, both needed by the documented flows:
`POST /api/auth/session` (deep-link handoff) and `POST /api/users/me/push-token`
(device registration for the feedback reminder).

Data routes answer `503 DB_UNAVAILABLE` until `server/.env` has Supabase keys,
onboarding chat answers `503 AI_UNAVAILABLE` without `GROQ_API_KEY`, and login answers
`503 AUTH_PROVIDER_UNAVAILABLE` without that provider's credentials.

The map renders a placeholder until `EXPO_PUBLIC_MAPBOX_TOKEN` is set **and** the app
runs in a dev build — `@rnmapbox/maps` needs native code and does not work in Expo Go.
