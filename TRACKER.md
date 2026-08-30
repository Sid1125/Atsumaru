# Atsumaru — work tracker

Status of the build against `docs/`. Updated 2026-08-30.

Legend: `[x]` done and verified · `[~]` code complete, not verified against a live
Supabase project · `[ ]` not started.

Verification baseline right now: `npm run typecheck` clean (both packages),
`npm test` 29/29 passing, and **the backend proven against a live Supabase project**
(`ap-northeast-1`) — 46 assertions across REST, PostGIS discovery, the join row lock,
Groq onboarding, pgvector embeddings, mutual-only unlock, and the sweep. All three dev
servers boot: API `:4000`, Expo/Metro `:8081` (1782 modules bundled), site `:3000`
(`next build` clean). The mobile app has since been walked end to end on a **Pixel 10a
emulator** in Expo Go, demo mode (§1d) — the loop holds; the defects that run surfaced
are listed there, and the security review of the backend push is in §5. The loop was then
driven **live against the real API** (§1b OAuth box, `context.md` §8): Google sign-in →
onboarding → discovery → feedback → **real mutual connection** → DM thread, all
`DEMO_MODE=0`.

## Done

### Scaffold

- [x] Monorepo layout matching `docs/PROJECT_STRUCTURE.md` (`apps/mobile`, `server`, `docs`)
- [x] Expo SDK 57 / RN 0.86 / React 19 app: navigation, theme, i18n (ja/en/zh), API client, socket service
- [x] Express 5 + Socket.io server (NodeNext ESM), zod-validated env with `has*` flags
- [x] `server/db/schema.sql` — Postgres + PostGIS + pgvector, RLS on, idempotent to re-paste
- [x] Root scripts: `server`, `mobile`, `seed`, `test`, `typecheck`, `setup`

### API (docs/API_STRUCTURE.md §3)

- [x] `{ success, data }` / `{ success, error }` envelope, `asyncRoute`, `param`, `pageParams`
- [x] Postgres error text logged, never returned (`dbError`)
- [~] Users: `GET/PATCH /users/me`, `GET /users/:id` — public projection only, never `real_name`
- [~] Onboarding: Groq chat (rate-limited, untrusted-output validation), handle suggest/check, `complete` with MiniLM embedding
- [~] Events: nearby (PostGIS radius, clamped), detail, create, mine, members, match-preview
- [~] Join/leave: `join_event` RPC holds a row lock, so the last seat cannot be double-booked
- [~] Group chat + DMs: paginated `{ messages, page, limit, total }`, membership/connection gated
- [~] Feedback: private ratings, reputation deltas, preference-vector learning, mutual-only unlock, replay-proof
- [~] Connections: mutual-only list, participants only
- [~] Socket.io: `group:*`, `dm:*`, `member:joined`, `match:unlocked`, `typing`, `user:{id}` room; membership checked, persist-before-broadcast

### Matching (docs/AI.md §5–7)

- [x] `0.6*cosine + 0.2*group_balance + 0.2*normalized_reputation`, backend-authoritative
- [x] Preference update: fire pulls, meh pushes, good at half rate
- [x] Reputation: credit for submitting, penalty for skipping, clamped 0–100
- [x] Match reasons returned in the member's own language

### Auth (docs/TRD.md §5, §17 — OAuth only, no OTP)

- [x] Google bridge — exercised end-to-end on the emulator via Expo Go + ngrok + `exp://` handoff (2026-08-30; `context.md` §8). LINE half still [~]: bridge written, no channel
- [x] Supabase session minted through admin `generateLink` + `verifyOtp`; identities in `oauth_identities` — Google run produced the user + `oauth_identities` row (Supabase logs)
- [~] Deep-link handoff: `?redirect_to=app` → one-time code → `POST /auth/session` (tokens never in a URL) — `exp://` variant walked; `atsumaru://` variant still needs a dev build
- [~] `logout` revokes upstream; `503` when a provider is unconfigured
- [x] State signing, tamper, expiry, and handoff single-use covered by tests

### Background work (docs/TRD.md §14)

- [~] `runSweep()`: close finished meetups, send feedback reminders ~1h after start, settle reputation once
- [x] BullMQ + ioredis when `REDIS_URL` is set, in-process timer otherwise, clean fallback when Redis is down
- [~] Expo push delivery: chunked sends, stale-token cleanup, localized copy, deep-link payload
- [~] `POST /users/me/push-token` device registration

### Demo data

- [~] `npm run seed` — 6 users, 4 Shibuya meetups (2/6, 5/6, live, finished), chat history
- [~] `--tokens` prints access tokens; `--reset` removes only demo rows
- [~] Finished meetup pre-seeded so `@trailbrew` unlocks a mutual connection on first submit

## To do

### 1. Prove the backend against a real project — DONE 2026-08-30

Supabase project `ucxgvtcqoeazuhsgwbhf` (`ap-northeast-1`). PostGIS 3.3.7 and pgvector
0.8.2 installed into the `extensions` schema, `schema.sql` applied, two migrations on
top (`server/db/migrations/`). DDL runs through `scripts/sql.mjs` against the Management
API, so re-applying needs no browser.

- [x] Supabase project created, `server/.env` filled, `schema.sql` applied — 8 tables,
      RLS on all 8, 5 RPCs
- [x] `npm run seed -- --tokens`, then `/events/nearby` with a printed token — 3 open
      meetups returned, the finished one correctly excluded, Osaka radius empty
- [x] `join_event` under two concurrent joiners: exactly one gets the last seat
      (1 × 200 `matched`, 1 × 409 `EVENT_FULL`, `current_size` never exceeded `max_size`)
- [x] Rewound `start_time` 90 minutes and swept: reminder stamped, settlement correctly
      withheld until 2h, second sweep silent
- [x] Ghosts drop 2 points exactly once — 5/5 members docked, `reputation_settled_at`
      stamped, a fourth sweep changed nothing
- [x] Mutual-only unlock: 2 of 3 picks reciprocated → exactly 2 connections, the
      non-mutual pick absent from the response; resubmitting did not rewrite
      `unlocked_at` or re-notify
- [x] DM round-trip over REST with the paging envelope; a non-participant gets 403
- [x] Groq onboarding chat live, in English and Japanese; handle suggest/check working
- [x] pgvector round-trip: all 6 seeded users have a 384-dim `preference_vector`, and
      match scores land at 0.47–0.82 (a null vector caps the score at 0.40)
- [x] Walk Google OAuth end to end **via Expo Go on the Android emulator**: ngrok tunnel →
      code exchange → `exp://` handoff → Supabase session → real mutual connection
      (DingDong ↔ @harucafe) driven through feedback (2026-08-30; details in `context.md` §8).
      LINE still deferred until a channel exists
- [ ] LINE OAuth once a channel exists
- [ ] Optional: set `REDIS_URL` (Upstash) and confirm the BullMQ driver takes over.
      **Blocked on the sweep atomicity issue below** — two drivers can currently
      double-notify

### 1c. Keeping the free-tier project alive

Supabase pauses a free project after ~7 days of inactivity, and restoring it is a manual
dashboard action — which would silently break every demo.

- [x] `keepalive` table + `ping_keepalive()` RPC (`migrations/003`). `security definer`,
      so the anon key can call the function while the table itself stays revoked from
      `anon` — the deny-all RLS posture is unchanged
- [x] `.github/workflows/keepalive.yml` — one request a day at 03:17 UTC, three attempts
      with backoff, plus `workflow_dispatch` for a manual run. Verified locally with the
      exact CI script: `ping_count` incremented, exit 0
- [x] Repo secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` set. **Only the anon key is in
      CI** — the service-role key never leaves `server/.env`

### 1b. Found by running it (fixed)

Every one of these was invisible without live credentials.

- [x] `verifyOtp()` ran on the shared service-role client, so after the first login every
      PostgREST query carried that user's JWT into the deny-all RLS. Session minting now
      uses an isolated client (`db/supabase.ts` `authClient()`); same fix in
      `seed.ts printTokens()`
- [x] HuggingFace `api-inference.huggingface.co` was retired and no longer resolves —
      `embed()` had never once succeeded. Now on `router.huggingface.co`; added the
      missing `hasEmbeddings` flag and a `503 EMBEDDING_UNAVAILABLE`
- [x] `GROQ_MODEL` pinned `llama-3.3-70b-versatile`, which Groq decommissioned — every
      onboarding call would have 404'd. Now `openai/gpt-oss-120b`
- [x] `join_event` raised `EVENT_CLOSED` for a merely-full event, because filling the
      last seat flips status to `full` before the size test ran. Capacity is now checked
      first (`migrations/002`)
- [x] `typing` forwarded a client-supplied `room_id` straight to `socket.to()` — any
      socket could spoof presence into any room. Now gated on `socket.rooms`
- [x] Feedback had no status gate: a member could rate the group the moment it formed,
      farm reputation, and unlock a 1:1 before meeting. Now `409 MEETUP_NOT_FINISHED`
- [x] Mutual unlock rewrote `unlocked_at` and re-emitted `match:unlocked` on every
      resubmission. Existing connections are now read first and treated as delivered
- [x] Schema hardening (`migrations/001`): `event_sizes` ran as owner and leaked every
      event id + size past RLS (now `security_invoker`); `messages.connection_id` had no
      FK; `push_tokens` had no PK; 8 filtered columns were unindexed
- [x] `babel-preset-expo` was missing entirely, so Metro could not construct a
      transformer and the app could not bundle. `expo-constants` and
      `react-native-worklets` were imported but only resolved transitively — all three
      now declared

### 1d. Pixel 10a emulator run, 2026-08-30 — Expo Go, demo mode

First on-device walkthrough after the backend push. `EXPO_PUBLIC_DEMO_MODE=1`, Expo Go,
`emulator-5554`, 1757 modules bundled. The whole loop works; the defects below are what
the run surfaced.

Passed end to end: onboarding chat (3 exchanges → `hiking`/`coffee`/`chill`) → handle
suggestions with live availability → Discover (hand-authored map, category chips, pins,
"For you" sheet) → meetup detail → join (2/6 → 3/6, score recomputed 43% → 46%) → group
chat with reply → private feedback (emoji **and** text on every rating) → mutual
connection unlocked → DM sent → host a meetup (auto-joined, 1/6). No `real_name`
anywhere; handles only.

Two blockers had to be cleared before it would boot at all:

- [x] `apps/mobile/package.json` pinned `react-native-worklets ~0.7.0` while
      `react-native-reanimated@4.5.1` requires peer `0.10.x`, so `npm install` failed
      `ERESOLVE` outright. Set to `0.10.1` (the version Expo SDK 57 expects);
      `expo-constants` → `~57.0.16` at the same time
- [x] After that bump, a redbox: `[Worklets] Mismatch between JavaScript code version and
      Worklets Babel plugin version (0.10.1 vs. 0.10.4)` — a stale Metro transform cache.
      `expo start --clear` clears it. Worth knowing after any worklets version change

Defects found on device:

- [ ] **Connections row hangs on "Loading…" forever** with a `?` avatar. Two causes, both
      need fixing: `demo/index.ts` has no `GET /users/:id` (throws `501`), *and*
      `ConnectionRow` renders `display_name ?? t("common.loading")` with no error branch —
      so a failed lookup is indistinguishable from loading against the real API too.
      Better still, return the other participant's public projection inside
      `GET /connections` and drop the per-row request entirely
- [ ] "Shibuya Café Crawl · Leave feedback" still shows on Discover after feedback was
      submitted — that card is never invalidated
- [ ] A joined upcoming meetup never appears under YOUR MEETUPS (joined Morning Hike &
      Coffee; the section still listed only the feedback-pending one)
- [ ] The host sees "Leave group" on their own meetup. The server answers
      `403 HOST_CANNOT_LEAVE`, so the button should be hidden for the host
- [ ] DM empty state puts the composer at the top of the screen; it only pins to the
      bottom once a message exists
- [ ] A fully expanded Discover sheet covers the profile pill / heart / settings header
      ("Find your people nearby" is clipped) — the sheet's max height ignores the header
- [ ] Meetup detail says "YOUR GROUP · 2/6 PEOPLE" before you have joined, while the CTA
      on the same screen still reads "Join group"
- [ ] Match-% pill is green at every value — 26% reads as positive. The site got a ramp
      (`site/src/lib/match.ts`, ≥95 green / 90–94 amber / <90 red); mobile did not
- [ ] Nit: a Discover card needs two taps to open — the first selects its map pin
- [ ] Not testable in Expo Go: **Settings** (language override, sign out). Expo Go's
      dev-launcher floating button sits exactly on the app's header gear and intercepts
      every tap. Needs a dev build, or a temporary second entry point
- [ ] `@rnmapbox/maps` is imported nowhere in `src/`, but its `app.json` plugin still
      injects a Mapbox maven repo and a native module into the Android build. Dropping
      both removes the native-build requirement that `expo run:android` introduced
- [ ] `expo install --check`: `expo@57.0.17` → `~57.0.18` still pending

### 1e. Independent re-verification with `server/.env`, 2026-08-30

`server/.env` landed, so everything that needed live credentials was re-run from a clean
process. Configured then: Supabase, Groq, HuggingFace. Still empty then: both OAuth
providers and `REDIS_URL`. **Google creds landed later that day and the full Google flow
was walked live (see §1b checkbox + `context.md` §8); LINE and `REDIS_URL` remain empty.**

- [x] Boot: `supabase:true, groq:true, oauth:{line:false,google:false}`, timer driver
      selected ("set REDIS_URL for BullMQ"), and the boot sweep ran — `1 completed,
      0 reminders, 0 settled` *(at this point; health now reports `google:true`)*
- [x] `GET /api/auth/google` with no credentials → `503 AUTH_PROVIDER_UNAVAILABLE`
- [x] `npm run seed -- --tokens`: 6 users, all six **with vector**, 4 meetups. Idempotent
      re-run (find-by-title then update) — no duplicate rows
- [x] `GET /users/me` returns exactly `PUBLIC_USER_COLUMNS`; `real_name` absent from the
      caller's own row and from every expanded member row
- [x] PostGIS + `event_status()`: Shibuya centre → 3 events (2 open, 1 ongoing), the
      finished one correctly excluded; Osaka → 0. `GET /events/mine` → 3, one per state
- [x] `join_event` live: non-member join → `joined` (2/6 → 3/6), second join idempotent,
      `leave` restored 2/6. A non-member joining the **ongoing** meetup →
      `409 EVENT_CLOSED`
- [x] Groq live in both languages on `openai/gpt-oss-120b`; handle suggest returns 6 free
      handles, `check-handle` on a taken one → `available:false`
- [x] pgvector cosine is live: match previews returned 0.47 / 0.79 / 0.79 — above the 0.40
      ceiling a null vector imposes. `why` strings localized
- [x] Feedback gates: form on a group I am not in → `403 NOT_A_MEMBER`; submit on an open
      meetup → `409 MEETUP_NOT_FINISHED`; the form excludes the caller
- [x] Chat REST: paging envelope correct, non-member history → `403`, insert returned a
      row id
- [x] `POST /users/me/push-token` accepts an Expo token twice with no duplicate-key error
      (the `push_tokens` PK from `migrations/001` is live) and rejects a malformed token
      with `400`
- [x] Socket.io against the live DB: garbage handshake token → `unauthorized`; `group:join`
      on a non-member group → `NOT_A_MEMBER`; member send persisted **and** broadcast with
      its row id; empty body → `INVALID_MESSAGE`; **`typing` into a room the socket never
      joined was not echoed** — the spoofing fix holds
- [x] Postgres text never surfaces: unknown id → `404 NOT_FOUND`, and a DB-level failure
      returns only `DB_ERROR / "Database request failed."`

New defects this run surfaced:

- [ ] **Message ordering has no tiebreaker.** `listMessages` sorts on `created_at` alone.
      The two seeded messages share an identical timestamp (one batch insert), and the API
      returned them in the opposite order to the seed. Equal timestamps also make paging
      able to skip or repeat a row. Add `id` as a secondary sort key, and stagger the
      timestamps in `seed.ts`
- [ ] A malformed path param (`GET /events/not-a-uuid`) returns **`500 DB_ERROR`** where it
      should be `400`. Nothing leaks — Postgres' `invalid input syntax for uuid` is
      swallowed correctly — but the status is wrong. Validate id params as UUIDs in
      `utils/request.ts`
- [ ] `join_event`'s already-a-member early return reports `matched` / `joined` from size
      alone, ignoring derived status, so re-joining a **completed** meetup answers
      `matched`. Cosmetic, but it is the one join response that can contradict
      `event_status()`
- [ ] Left behind in the live project by this run: one `"env smoke test"` message and one
      `"socket smoke test"` message on Morning Trail Run, plus an
      `ExponentPushToken[env-smoke-test]` row for `@trailbrew`. `npm run seed -- --reset`
      clears them along with all demo data
- [x] `verifyOtp` / `authDb()` path in `modules/auth/session.ts` — exercised live by the
      Google OAuth callback (2026-08-30): provider identity created, session link generated,
      `oauth_identities` row written (Supabase logs + live user). LINE would reuse the same path

### 2. Mobile — close the demo loop (docs/FRONTEND.md §13)

Done 2026-08-29 and walked end to end on a Pixel 9 emulator in demo mode
(`EXPO_PUBLIC_DEMO_MODE=1`). See `context.md` for the full defect list and run log.

- [x] Login screen: opens `/api/auth/{line,google}?redirect_to=app`, handles the `atsumaru://auth` deep link, exchanges the code, stores the token in SecureStore (`useOAuthLogin`)
- [x] Route `is_new` / `user: null` into onboarding, everyone else to Discover — **this was structurally impossible before**: the gate tested `!user.handle`, but `handle` is `not null` and `/auth/me` returns `user: null` pre-onboarding, so the onboarding stack was dead code
- [x] Connections list + DM thread screens
- [x] `match:unlocked` → celebration state, then route into the new 1:1 chat
- [x] Extract a shared `ChatThread` from `GroupChat` for group + DM reuse (`GroupChat.tsx` deleted)
- [x] Register the Expo push token after login (Expo Go cannot receive Android push — gated, never crashes)
- [ ] Debounced refetch on map region change (docs/FRONTEND.md §9) — still one-shot
- [ ] Deep-link the feedback notification — `linking.ts` is wired but `atsumaru://` does not route in Expo Go; needs a dev build

### 3. Mobile — P1 features

- [x] Create-event screen (FR-13) — posts a fixed Shibuya point; a venue picker is still to do
- [x] Settings: language override → `PATCH /users/me`, sign out
- [x] "Your meetups" section on Discover — a completed meetup had no UI route at all, so feedback was reachable only via a push the device cannot receive
- [ ] Reusable components still inlined in screens: `Avatar`, `MemberRow`, `ChatBubble`, `ChatInput`, `RatingSelector`, `MatchScore`, `BottomSheet`, `LoadingSkeleton` (docs/DESIGN.md §7)
- [ ] Infinite scroll on message history now that the paging envelope is returned
- [ ] Mapbox: real pins need `EXPO_PUBLIC_MAPBOX_TOKEN` plus a native dev build

### 4. Marketing site (`site/`)

Gen-Z pop pass done 2026-08-30: electric palette (`--color-neon` / `lilac` / `hotpink`
/ `cyan`) layered over the existing editorial base, sticker + tape badge system,
highlighter `.marker` headline treatment, dual-direction kinetic tape tickers, the
interactive Vibe Check squad-pass toy, draggable hero stickers, and punchier copy
(all of it in `src/lib/constants.ts`).

- [x] Palette, sticker/tape/marker utilities, reduced-motion handling for the marquees
- [x] `MarqueeTicker` (two rows, opposite directions, hover-pause, clipped so it adds no horizontal scroll)
- [x] `VibeCheckToy` — pick up to 3 vibes, deterministic squad pass, opt-in SFX
- [x] `DraggableSticker` — grab, toss with momentum, springs home
- [x] `StickerSheet` + `Decal` — die-cut vinyl decals (white cut line, gloss, squircle/round/rounded-square), one per gathering type, with dashed empty slots for the roadmap badges
- [x] `StickerArt` — drawn SVG stickers (ramen, arcade, café, trail, 35mm, vinyl, torii, 集 hanko) pasted through Problem / HowItWorks / Activities / Japan / CTA and across the sheet
- [x] Activity photos corrected: anime/movies → cinema, music → concert, photography → camera
- [x] Hero phone reads as a held device — thick lit side rails with power/volume buttons, bottom rail with speaker slot, yaw raised to 28°
- [x] Match-score colour ramp centralised in `src/lib/match.ts` (≥95 green, 90–94 amber, <90 red) and applied to every mock-up
- [x] Footer parallax reveal per Awwwards scroll reference 66 (inner starts at −35%, lands at 0 exactly as the footer bottoms out; no layout change)
- [ ] WebGL hero phone: attempted with react-three-fiber/drei and reverted — the device body and rails rendered well, but projecting the live `PhoneScreenUI` DOM onto the glass via drei `<Html transform>` needs per-camera scale calibration. Revisit by baking the screen to a texture instead of hosting DOM in 3D
- [x] Opt-in Web Audio SFX with a persisted `SoundToggle` in the navbar (silent by default)
- [x] Copy pass: "Dating apps are cooked", "escape the group chat ghost town", "passes the vibe check", "Zero 1-on-1 cringe"
- [x] Hero left column nudged down at `xl` so the 集まる line clears the fixed navbar
- [x] `suppressHydrationWarning` on `<body>` — Grammarly-class extensions add attributes before hydration
- [x] Cleared the 4 pre-existing React-compiler lint errors (`ai-chat-demo`, `wave-field`)
- [ ] Remaining lint warnings are all `next/image` advice on deliberate `<img>` use — `next.config.ts` needs `remotePatterns` for Unsplash before that can change
- [ ] Copy still says "sample plans"; swap the ticker to real meetups once the API is live

### 5. Polish and hardening

Reviewed 2026-08-30 against the backend push. Dependency audits: server **0
vulnerabilities**; mobile 11 moderate, all one advisory (`uuid <11.1.1` via `xcode` →
`@expo/config-plugins`), build tooling only, no fix available, nothing in the shipped
bundle. No secrets tracked — nothing matching `.env`/token/key in `git ls-files`, no
JWT-shaped literals anywhere.

- [ ] **`schema.sql` does not mirror `migrations/001`, `002`, or `003`.** `CLAUDE.md`
      requires both, so that a fresh project comes up identical in one paste. Today a
      fresh paste gets `event_sizes` **without** `security_invoker` — the exact RLS bypass
      001 exists to close, leaking every event id and group size to the anon key — plus no
      FK on `messages.connection_id`, no PK on `push_tokens`, none of the 8 indexes, no
      pinned `search_path`, and no `keepalive`/`ping_keepalive()`. The live project is
      fine; any new environment is not. Highest-priority item in this section
- [ ] **`AUTH_STATE_SECRET` ships a hardcoded default and production only warns.**
      `config/env.ts:35` defaults to `"atsumaru-dev-state-secret"` and line 63 logs a
      warning and continues — that value is in the repo, so the OAuth `state` HMAC is
      forgeable on any deploy that forgets the env var. Make it `process.exit(1)` when
      `NODE_ENV === "production"`
- [ ] OAuth `state` is a stateless HMAC blob only, not bound to the browser or session, so
      any well-formed state is accepted from any client — login CSRF. Bounded by the
      one-time deep-link code, but the binding is missing
- [ ] Google identity trusts `email` without checking `email_verified` (`oauth.ts:217`).
      Supabase Auth keys users by email, so an unverified address colliding with an
      existing account is a takeover risk — check the claim, fall back to the synthetic
      `@oauth.atsumaru.invalid` address when false
- [ ] `CORS_ORIGIN` defaults to `*` for both Express and Socket.io. Auth is a Bearer
      header rather than a cookie, so the exposure is low, but pin it in production
- [ ] Mobile drops the `refresh_token`: `services/api/auth.ts` types it,
      `storage/session.ts` stores only the access token, and there is no 401 handling
      outside the demo layer. When the Supabase access token expires the app dead-ends
      into silent failures with no re-auth path
- [ ] `utils/rateLimit.ts` exposes `prune()` but nothing calls it, so the onboarding
      limiter's counter map grows one entry per user for the process lifetime
- [ ] `POST /events` accepts a `start_time` in the past, which creates a meetup that is
      already `completed` by `event_status()`
- [ ] **Sweep side effects are not atomic with their stamps.** `remind()` pushes then
      stamps; `settle()` docks then stamps. One driver is safe (verified), but two —
      BullMQ plus the boot-time `sweepOnce()`, or two API instances — can double-notify
      and double-dock. Make the stamp a conditional update before enabling Redis
- [ ] `connections/routes.ts:32` interpolates `userId` into a PostgREST `.or()` filter.
      Safe today (it is a UUID off the verified JWT); defence-in-depth only
- [ ] Accessibility pass: emoji ratings need text equivalents, touch targets, no colour-only state (docs/DESIGN.md §10)
- [x] Index on `events (start_time, status)` — added in `migrations/001` along with the
      other 7 unindexed filter columns
- [ ] Move OAuth handoff codes out of memory if the API ever runs more than one instance
- [ ] `POST /events` inserts the event and the host's `group_members` row in two
      statements; a failure between them leaves a hostless group. Move into an RPC like
      `join_event`
- [ ] `POST /events/:id/leave` has no status guard, so a member can leave an ongoing or
      completed meetup and escape the ghost penalty before `settle()` runs

### 6. Out of scope for the appathon (docs/IDEA.md §10)

AI icebreakers, conversational feedback, women-only groups and safety layer, LINE
messaging integration, gamification, vibe recap, recurring circles, venue partnerships,
premium tier.

## Known gaps and risks

| Area | Note |
|---|---|
| LINE credentials | The bridge is written but unexercised; a LINE Login channel is needed, and channels without the email scope fall back to a synthetic internal address |
| Google OAuth | Exercised end-to-end via Expo Go + ngrok + `exp://` handoff (2026-08-30, `context.md` §8). Dev-build-only note: shipped builds use the canonical `atsumaru://auth` back to `APP_AUTH_REDIRECT`; only the `exp://` variant has been walked |
| Push receipts | Tickets are checked, but Expo's async receipt endpoint is not polled — a token can go stale for one cycle |
| Push in Expo Go | `sendPush` has never delivered: Expo Go dropped Android remote push, and `app.json` has no `extra.eas.projectId`, so no token can be minted. The sweep's reminder branch is verified only up to `pushTargets` returning zero devices |
| Single instance | Handoff codes and the rate limiter live in process memory; horizontal scaling needs Redis for both — and the sweep atomicity fix in §5 first |
| `docs/API_STRUCTURE.md` §5–6 | Still references the old OTP screens; `TRD.md` §17 says OAuth is canonical, and the code follows TRD |
| Two extra endpoints | `POST /auth/session` and `POST /users/me/push-token` are not in the contract; both are documented in README and CLAUDE.md |
| Demo mode | `EXPO_PUBLIC_DEMO_MODE=1` runs the app against an in-app stand-in for the API (`src/services/api/demo/`). It duplicates the match formula from `server/src/modules/matching/score.ts` — the two must not drift. `apps/mobile/.env` now ships with `0`, so the app talks to the real API |
| Demo layer gaps | `demo/index.ts` has no `/users/:id` handler, so the Connections list shows `@…` forever in demo mode (confirmed on device, §1d); and connect-picks for unrated members are dropped. Real API mode is unaffected |
| Expo Go vs the header | Expo Go's dev-launcher floating button covers the app's top-right settings gear, so Settings cannot be reached in Expo Go at all — the app's own screen is fine, the launcher just wins the tap |
| Mobile loop against the real API | **Closed 2026-08-30** — Google sign-in, onboarding (Groq), discovery, feedback submit, mutual unlock, and the DM thread were all driven live against `:4000`/Supabase with `DEMO_MODE=0` (Pixel emulator, Expo Go, ngrok tunnel; `context.md` §8). Only the DM *send* and the `atsumaru://` deep-link variant remain
| `schema.sql` drift | It is behind `migrations/001–003`, so a fresh project is missing the `event_sizes` RLS fix and the rest. See §5 |

