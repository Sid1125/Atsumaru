# Atsumaru — work tracker

Status of the build against `docs/`. Updated 2026-08-30.

Legend: `[x]` done and verified · `[~]` code complete, not verified against a live
Supabase project · `[ ]` not started.

Verification baseline right now: `npm run typecheck` clean (both packages),
`npm test` 29/29 passing, and **the backend proven against a live Supabase project**
(`ap-northeast-1`) — 46 assertions across REST, PostGIS discovery, the join row lock,
Groq onboarding, pgvector embeddings, mutual-only unlock, and the sweep. All three dev
servers boot: API `:4000`, Expo/Metro `:8081` (1782 modules bundled), site `:3000`
(`next build` clean).

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

- [~] LINE + Google bridge: HMAC-signed `state` + nonce, code exchange, `id_token` verified provider-side
- [~] Supabase session minted through admin `generateLink` + `verifyOtp`; identities in `oauth_identities`
- [~] Deep-link handoff: `?redirect_to=app` → one-time code → `POST /auth/session` (tokens never in a URL)
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
- [ ] Walk Google OAuth end to end; then LINE once a channel exists — still deferred,
      `seed --tokens` covers authenticated routes without a provider
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

- [ ] **Sweep side effects are not atomic with their stamps.** `remind()` pushes then
      stamps; `settle()` docks then stamps. One driver is safe (verified), but two —
      BullMQ plus the boot-time `sweepOnce()`, or two API instances — can double-notify
      and double-dock. Make the stamp a conditional update before enabling Redis
- [ ] Accessibility pass: emoji ratings need text equivalents, touch targets, no colour-only state (docs/DESIGN.md §10)
- [x] Index on `events (start_time, status)` — added in `migrations/001` along with the
      other 7 unindexed filter columns
- [ ] Move OAuth handoff codes out of memory if the API ever runs more than one instance
- [ ] Rotate `AUTH_STATE_SECRET` per deployment (the dev default warns in production)
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
| Google OAuth | Same — the code path is unexercised. `seed --tokens` mints real Supabase sessions, which is how every authenticated route was verified |
| Push receipts | Tickets are checked, but Expo's async receipt endpoint is not polled — a token can go stale for one cycle |
| Push in Expo Go | `sendPush` has never delivered: Expo Go dropped Android remote push, and `app.json` has no `extra.eas.projectId`, so no token can be minted. The sweep's reminder branch is verified only up to `pushTargets` returning zero devices |
| Single instance | Handoff codes and the rate limiter live in process memory; horizontal scaling needs Redis for both — and the sweep atomicity fix in §5 first |
| `docs/API_STRUCTURE.md` §5–6 | Still references the old OTP screens; `TRD.md` §17 says OAuth is canonical, and the code follows TRD |
| Two extra endpoints | `POST /auth/session` and `POST /users/me/push-token` are not in the contract; both are documented in README and CLAUDE.md |
| Demo mode | `EXPO_PUBLIC_DEMO_MODE=1` runs the app against an in-app stand-in for the API (`src/services/api/demo/`). It duplicates the match formula from `server/src/modules/matching/score.ts` — the two must not drift. `apps/mobile/.env` now ships with `0`, so the app talks to the real API |
| Demo layer gaps | `demo/index.ts` has no `/users/:id` handler, so the Connections list shows `@…` forever in demo mode; and connect-picks for unrated members are dropped. Real API mode is unaffected |
| Mobile loop against the real API | The backend is proven and the app bundles against it (1782 modules, `DEMO_MODE=0`), but the on-device walkthrough has only ever been done in demo mode. Needs an emulator run |

