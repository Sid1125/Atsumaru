# WIRING.md — how Atsumaru is wired, and how to boot it

Three separate npm packages (no workspaces), one Postgres database, zero deployed
infrastructure to start: everything except a dev machine needs the API keys that live
in `server/.env` / `apps/mobile/.env`. This file is the practical map; `docs/*.md` are
the spec, and `server/db/schema.sql` is the ground truth for the database.

## The pieces

| Piece | Where | Port | Talks to |
|---|---|---|---|
| API | `server/` — Node 25, Express 5, Socket.io, TypeScript (ESM) | **4000** | Supabase (Postgres + Auth), Groq, HuggingFace |
| Mobile | `apps/mobile/` — Expo SDK 57 / RN 0.86 / React 19 | **8081** (Expo/Metro) | API via REST + Socket.io |
| Marketing site | `site/` — Next.js 16 + Tailwind v4 | **3000** | nothing (no API calls, shares no code) |
| Database | Supabase project `ucxgvtcqoeazuhsgwbhf` (ap-northeast-1) | — | Postgres + PostGIS + pgvector in the `extensions` schema |

Supabase is the only remote dependency. Groq (`openai/gpt-oss-120b`, fallback for
decommissioned `llama-3.3-70b-versatile`) powers two features; HuggingFace powers
embeddings. Both degrade to 503 instead of crashing.

## Boot order

```bash
npm run setup          # one-time: installs server + mobile deps (site installs itself)
cp server/.env.example server/.env          # then fill in keys (below)
cp apps/mobile/.env.example apps/mobile/.env

npm run server         # terminal 1 — API on :4000, health at /health
npm run mobile         # terminal 2 — Expo dev server on :8081
cd site && npm run dev # optional — marketing site on :3000

npm test               # server unit tests (48)
npm run typecheck      # server + mobile type-checks
cd site && npm run build   # the site's type-check (no separate script)
```

No seed, no DB setup on the live project — `schema.sql` + migrations already applied
there. A fresh project needs `server/db/schema.sql` pasted into Supabase's SQL editor,
then each numbered file in `server/db/migrations/` in order, then
`notify pgrst, 'reload schema'` after any migration that adds a function.

## Environment

`server/.env` (secrets, never committed):

| Key | Used for | Missing → |
|---|---|---|
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | all data access; the service-role key **bypasses RLS** | data routes 503 `DB_UNAVAILABLE` |
| `SUPABASE_ANON_KEY` | keepalive CI ping only | — |
| `GROQ_API_KEY` | onboarding chat + vibe recap | 503 `AI_UNAVAILABLE` (recap falls to template instead) |
| `HUGGINGFACE_API_KEY` | MiniLM embeddings → `preference_vector` | 503 `EMBEDDING_UNAVAILABLE` |
| `LINE_CHANNEL_ID` / `SECRET` | LINE OAuth (exchanged by the API — Supabase has no LINE provider) | 503 `AUTH_PROVIDER_UNAVAILABLE` |
| `GOOGLE_CLIENT_ID` / `SECRET` | reference only — Google is brokered by **Supabase Auth**, keys live in the dashboard | — |
| `OAUTH_CALLBACK_URL` | our callback; **must also sit in Supabase → Auth → URL Configuration → Redirect URLs** or GoTrue redirects to Site URL with a valid-looking `?code=` | silent auth break |
| `APP_AUTH_REDIRECT` | deep link for the one-time code handoff (`atsumaru://auth`) | — |
| `AUTH_STATE_SECRET` | signs OAuth state + keys in-memory PKCE verifier; set long/per deployment | boots with dev default (warns in prod) |
| `REDIS_URL` | optional — BullMQ sweep driver (Upstash `rediss://` works) | falls back to in-process timer |

`apps/mobile/.env` (public, ships in the bundle — `EXPO_PUBLIC_*` only):

| Key | Notes |
|---|---|
| `EXPO_PUBLIC_API_URL` | blank on a simulator → defaults to `10.0.2.2:4000/api` on Android, `localhost:4000/api` on iOS. Physical device: your LAN IP |
| `EXPO_PUBLIC_WS_URL` | same default, socket endpoint (port 4000) |
| `EXPO_PUBLIC_DEMO_MODE` | `1` runs the whole app against `src/services/api/demo/` — no server, no DB. `0`/absent hits the real API. Must be off in shipped builds |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | **unused** — the map is a hand-authored SVG city (`components/map/`), not Mapbox |

**OAuth is not configured.** No LINE or Google credentials exist yet; authenticated
routes are exercised with real Supabase sessions minted by `npm run seed -- --tokens`.

## How the request path is wired

```
Mobile screen → src/services/api/client.ts (single axios instance)
  ├─ DEMO_MODE=1 → demoRequest()  (in-app fake server, mirrors real API)
  └─ DEMO_MODE=0 → axios → http://<host>:4000/api/...
        interceptor injects  Bearer <token from SecureStore>
        unwraps  { success, data } / { success, error:{ code, message } }
        bad envelope / network → throws ApiError
```

Server side (`server/src/index.ts`):

```
GET /health                     → { status, supabase, groq, oauth:{line,google} }
GET /api/auth/*                 → module routes
GET /api/onboarding/*           → ...
GET /api/users/*                → ...
GET /api/events/*               → ...
GET /api/connections/*          → ...
anything else                   → 404 NOT_FOUND (API envelope, not Express HTML)
errorHandler                    → { success:false, error:{ code, message } } + status
http.createServer(app) → attachSocket() → Socket.io on the same :4000
startJobs()                     → post-meetup sweep in the background
```

Route handlers wrap in `asyncRoute`, validate bodies with zod, read params via
`param(req,"id")`, paging via `pageParams(req.query)`, and answer through `ok()` /
`HttpError` (`utils/response.ts`). Postgres errors become `throw dbError(error)` — the
raw Postgres text is logged, never returned to the client.

All shared data access lives in **`server/src/db/queries.ts`** (reuse, don't re-query):
`findEvent`, `findMembers`, `publicUser`, `requireMembership`, `requireConnection`,
`listMessages`, `insertMessage`, `db()` (service-role), `authDb()` (throwaway client for
session minting — never `auth.signIn*/verifyOtp` on the shared singleton, it demotes the
whole process's `Authorization` header and trips RLS).

PostGIS/pgvector and transactional writes go in `schema.sql` as Postgres functions called
via `rpc()` — `events_nearby`, `event_detail`, `events_for_user`, `join_event`. Match
scoring (`0.6·cosine + 0.2·group_balance + 0.2·reputation`) is **backend-authoritative**
in `server/src/modules/matching/score.ts`; the app displays only, never computes.
`real_name` never leaves the server — select users via `PUBLIC_USER_COLUMNS`.

## AI wiring (deliberately small — docs/AI.md §10)

Groq has exactly two jobs, HuggingFace one, all in `server/src/services/ai.ts`:

| Function | Used by | Notes |
|---|---|---|
| `onboardingChat` | onboarding conversation | the only chat AI ever |
| `vibeRecap` | `GET /events/:id/recap` | wraps Groq; returns **null on any failure** → never throws |
| `embed` | interests + personality → `preference_vector` | MiniLM, pgvector `vector(384)` |

Matching and post-feedback learning consume/update that stored vector **arithmetically**.
Group chat, DMs, and the sweep touch no model. Putting AI in chat is a product change.

The vibe recap route (`server/src/modules/recap/routes.ts`) is the one with real gates,
in order: auth → membership → event completed → **caller's own feedback exists** (privacy
gate — a member with no ratings gets nothing, and generating from the group's ratings
would leak others' picks) → rate limit → generate. Gates:

- cached in `meetup_recaps` (result is final; a cache hit costs no Groq call)
- `recapLimiter` (10/hour per user, consumed **only on cache miss**)
- AI branch skipped entirely when the caller rated **no one as liked** — an all-meh recap
  with nothing to say returns the quiet `templateRecap()` instead of an AI line that
  praised the very people the caller disliked
- Groq down → `templateRecap()` floor, recorded in `meetup_recaps.source` (`"ai"` /
  `"template"`); a recap is passive, an empty card reads as a bug
- `meetup_recaps` has RLS enabled **with no policies** → deny-all for anon and
  authenticated; only the service-role route client can reach it

## Real-time wiring

One shared socket in `apps/mobile/src/services/socket/index.ts` (`connectSocket`,
`onServerEvent`, `socketActions`) — never a second connection. Server rooms
(`socket/index.ts`):

| Room | Scope |
|---|---|
| `group:{event_id}` | group chat, `group:message`, `member:joined` |
| `dm:{connection_id}` | 1:1 chat, `dm:message`, `typing` |
| `user:{user_id}` | server → user pushes, e.g. `match:unlocked` |

Handlers **check membership/connection and persist to Postgres before broadcasting**, so
REST history and the live stream never disagree. In demo mode the bridge is local
(`demoAppendMessage`) with identical event names.

## Post-meetup sweep

`runSweep()` in `server/src/jobs/sweep.ts` — one idempotent body:
completed meetups → Expo feedback reminder ~1h after `start_time` → dock reputation from
members who never submitted feedback → settle. Two drivers, same body:

- `REDIS_URL` set → BullMQ worker + job scheduler in `server/src/jobs/index.ts`
  (5 attempts to connect, then falls back silently)
- otherwise → 5-minute in-process timer (unref'd, so tests don't hang)

Known open issue (TRACKER.md): idempotency columns are stamped after the side effect,
not atomically — fix before enabling a second driver.

## Auth wiring (docs/TRD.md §17, OAuth canonical)

Two providers, one handoff:

```
App → GET /api/auth/{line,google}            starts OAuth
Provider → redirect to OAUTH_CALLBACK_URL    (?redirect_to=app → atsumaru://auth?code=…)
App → POST /api/auth/session { code }        one-time handoff, tokens never in a URL
App → Bearer JWT on everything after
```

- **Google**: Supabase Auth brokers it (PKCE; client id/secret in the dashboard).
  Provider address already on an account → identity **linked**, never twinned
  (only real addresses; synthetic `@oauth.atsumaru.invalid` never links). `is_new`
  = "no profile row yet".
- **LINE**: API exchanges the code and verifies the id_token itself (no Supabase
  provider).
- Provider logic lives in `modules/auth/oauth.ts` + `session.ts`, not in routes.

## Demo mode (mobile)

`EXPO_PUBLIC_DEMO_MODE=1` → one branch in `api/client.ts` + a matching one in
`socket/index.ts` route everything into `src/services/api/demo/`:
- `index.ts` stands in for the *server* (holds match scoring + mutual unlock — mirror of
  `server/src/modules/matching/score.ts`, change both or they drift)
- `world.ts` mirrors `scripts/seed.ts`, lives on `globalThis` (Fast Refresh can't desync
  it from the Zustand auth store)
- screens/hooks/query keys identical in both modes; flipping the flag to `0` removes the
  demo layer from the call path entirely

## Seed / smoke test

```bash
npm run seed                       # 6 demo users + 4 Shibuya meetups + chat history
npm run seed -- --tokens           # prints access tokens (real Supabase sessions)
npm run seed -- --reset            # clears demo data
node scripts/sql.mjs -c "select count(*) from events"     # hit the live DB (needs
                                                          # SUPABASE_ACCESS_TOKEN + REF)
curl http://127.0.0.1:4000/health  # expect supabase:true, groq:true
```

Demo handles: `trailbrew`, `ramenkenji`, `harucafe`, `mikaplays`, `linlens`, `sotaruns`.
Full end-to-end: Login → AI onboarding → profile confirm → Discover map → join meetup →
group chat → feedback → recap → mutual 1:1.

## Failure modes at a glance

| Symptom | Cause |
|---|---|
| `503 DB_UNAVAILABLE` | no Supabase service-role key |
| `503 AI_UNAVAILABLE` / `EMBEDDING_UNAVAILABLE` | no Groq / HuggingFace key |
| `503 AUTH_PROVIDER_UNAVAILABLE` | no LINE/Google credentials |
| recap returns a template line with `source:"template"` | Groq down **or** rate-limit floor **or** caller rated nobody liked |
| mobile network error on Android | emulator needs `10.0.2.2`, not `localhost` (default is already right); physical device needs your LAN IP in `EXPO_PUBLIC_API_URL` |
| OAuth redirect lands on the wrong host | callback missing from Supabase → Auth → URL Configuration → Redirect URLs |
| Expo Go blue spinner forever | launched from a virtual-adapter IP (`192.168.x.x`); use `exp://10.0.2.2:8081` |
| `PGRST202` after a migration | PostgREST schema cache stale — run `notify pgrst, 'reload schema'` |

Live project pauses after ~7 days idle; `.github/workflows/keepalive.yml` pings
`ping_keepalive()` daily with the anon key (service-role stays out of CI).