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
connection unlock, the post-meetup vibe recap (`GET /events/:id/recap` — a Groq one-liner
from your own ratings, cached per member, with a deterministic template fallback), DMs,
and Socket.io rooms (`group:{event_id}`, `dm:{connection_id}`,
`user:{user_id}`) that check membership and persist before broadcast. A post-meetup
sweep closes meetups out, sends the Expo feedback reminder ~1h after `start_time`, and
docks reputation from members who never submit feedback. The mobile shell is complete
(navigation, API client, socket service, i18n JP/EN/ZH, theme, Login → AI chat →
profile confirm → Discover → Meetup → feedback).

### Authentication

`GET /api/auth/line` and `GET /api/auth/google` start a login; both end at
`GET /api/auth/callback`, which mints a Supabase session. Add `?redirect_to=app` to come
back through `atsumaru://auth?code=…`; the app posts that one-time code to
`POST /api/auth/session` — tokens never travel in a URL.

The two providers differ underneath:

- **Google** is brokered by Supabase Auth. Its client id/secret live in the Supabase
  dashboard (Auth → Providers → Google), the Google console's redirect URI is Supabase's
  `https://<ref>.supabase.co/auth/v1/callback`, and the API drives PKCE so Supabase hands
  back a code rather than tokens in a fragment. `OAUTH_CALLBACK_URL` must therefore also
  be listed under Supabase → Auth → URL Configuration → **Redirect URLs**, or GoTrue
  quietly redirects to Site URL instead.
- **LINE** has no Supabase provider, so the API exchanges the code and verifies the
  `id_token` itself; its console lists `OAUTH_CALLBACK_URL`. A channel without email
  permission yields no address, so an internal synthetic one is used. When a provider does
  return an address that already has an account, the identity is linked to it rather than
  creating a second account.

On an Android emulator use `OAUTH_CALLBACK_URL=http://10.0.2.2:4000/api/auth/callback`
and point `APP_AUTH_REDIRECT` at the Expo Go origin the bundle is served from
(`exp://10.0.2.2:8081/--/auth`); `atsumaru://auth` needs a dev build.

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
`503 AUTH_PROVIDER_UNAVAILABLE` without that provider's credentials. The vibe recap is the
exception: with no `GROQ_API_KEY` it returns a template line rather than an error, because
nobody is waiting on it and an empty card reads as a bug.

The map renders a placeholder until `EXPO_PUBLIC_MAPBOX_TOKEN` is set **and** the app
runs in a dev build — `@rnmapbox/maps` needs native code and does not work in Expo Go.
