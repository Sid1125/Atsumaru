# Atsumaru — work tracker

Status of the build against `docs/`. Updated 2026-09-03.

Legend: `[x]` done and verified · `[~]` code complete, not verified against a live
Supabase project · `[ ]` not started.

Verification baseline right now: `npm run typecheck` clean (both packages),
`npm test` 54/54 passing, and **the backend proven against a live Supabase project**
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
- [x] Users: `GET/PATCH /users/me`, `GET /users/:id` — public projection only, never `real_name`
- [x] Onboarding: Groq chat (rate-limited, untrusted-output validation), handle suggest/check, `complete` with MiniLM embedding
- [x] Events: nearby (PostGIS radius, clamped), detail, create, mine, members, match-preview
- [x] Join/leave: `join_event` RPC holds a row lock, so the last seat cannot be double-booked
- [x] Group chat + DMs: paginated `{ messages, page, limit, total }`, membership/connection gated
- [x] Feedback: private ratings, reputation deltas, preference-vector learning, mutual-only unlock, replay-proof
- [x] Vibe recap: `GET /events/:id/recap` — per-user Groq recap of the caller's own ratings,
      cached in `meetup_recaps`, deterministic template fallback in en/ja/zh. **Verified
      live 2026-08-30** (10/10 assertions, both the `ai` and `template` paths). Brute pass
      same day: rate-limit flood (cap 10/hr exact, 11th call → template), 8-way concurrency
      (byte-identical `created_at`, exactly one row), RLS deny-all, gate
      401/403/409/404 — see `context.md` §11. Edge pass same day (fresh live harness,
      deleted after): mixed fire+meh stores only the liked bucket and the text never names
      a meh member's traits; all-fire bucket is alphabetical top-3; feedback added *after*
      a recap is generated is invisible to later reads (cache-first wins; the recap never
      changes — by design)
- [x] Connections: mutual-only list, participants only
- [x] Socket.io: `group:*`, `dm:*`, `member:joined`, `match:unlocked`, `typing`, `user:{id}` room; membership checked, persist-before-broadcast

Every line above carries `[x]` because §1 and §1e drove each of them against the live
project. They read `[~]` until 2026-09-03, which understated what had actually been
verified — the legend's `[~]` means "not verified against a live Supabase project", and
that stopped being true on 2026-08-30.

### Matching (docs/AI.md §5–7)

- [x] `0.6*cosine + 0.2*group_balance + 0.2*normalized_reputation`, backend-authoritative
- [x] Preference update: fire pulls, meh pushes, good at half rate
- [x] Reputation: credit for submitting, penalty for skipping, clamped 0–100
- [x] Match reasons returned in the member's own language
- [x] Vibe recap: `fire +2 / good +1 / meh -1` summed per trait, ties alphabetical so member
      join order cannot leak who was rated (`modules/recap/vibe.ts`)

### Auth (docs/TRD.md §5, §17 — OAuth only, no OTP)

- [x] Google — **brokered by Supabase Auth over PKCE** since 2026-08-30: client id/secret live in the Supabase dashboard, the API drives `code_challenge` → `?grant_type=pkce`, verifier single-use and keyed by the signed state. Walked live on the emulator
- [x] LINE — exchanged by the API (Supabase has no LINE provider): code → `id_token` → LINE verify → `createUser`/`generateLink`/`verifyOtp` on an isolated client. Walked live once the channel's email permission was approved
- [x] One person, one account: a provider address that already has an account gets its identity **linked** instead of creating a twin (`isEmailTaken` → id resolved from `generateLink`). Verified live — the LINE identity attached to the existing Google account, auth-user count unchanged
- [x] Supabase session minted through admin `generateLink` + `verifyOtp`; identities in `oauth_identities` — Google run produced the user + `oauth_identities` row (Supabase logs)
- [~] Deep-link handoff: `?redirect_to=app` → one-time code → `POST /auth/session` (tokens never in a URL) — `exp://` variant walked; `atsumaru://` variant still needs a dev build
- [~] `logout` revokes upstream; `503` when a provider is unconfigured
- [x] State signing, tamper, expiry, handoff single-use, PKCE digest/verifier reuse covered by tests (34/34)

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
      Superseded the same day by the Supabase-brokered flow below, which needs no tunnel
- [x] Re-point Google at Supabase Auth (PKCE) and walk it live; LINE walked live too after
      its channel email permission was approved, linking onto the same account
      (`context.md` §10)
- [ ] Optional: set `REDIS_URL` (Upstash) and confirm the BullMQ driver takes over.
      No longer blocked: the sweep claims each idempotency stamp before acting (§5,
      2026-09-03), so two drivers can no longer double-notify. BullMQ itself has still
      never run

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

- [x] **Message ordering has a tiebreaker** (2026-09-03). `listMessages` sorted on
      `created_at` alone, the two seeded messages shared a timestamp from one batch insert,
      and the API returned them in the opposite order to the seed; equal timestamps also let
      `range()` paging skip or repeat a row. Now ordered by `(created_at, id)`, with
      `messages_event_idx` / `messages_connection_idx` widened to match so the sort stays
      index-supported, and `seed.ts` staggers its conversation a minute per message
- [x] A malformed path param answers `400 INVALID_ID` (2026-09-03) instead of
      `500 DB_ERROR`. Nothing ever leaked — Postgres' `invalid input syntax for uuid` was
      swallowed correctly — but the status blamed the server for the caller's mistake.
      `uuidParam()` in `utils/request.ts` validates first; every `:id` route uses it, while
      `param()` stays for `:provider`
- [x] `join_event`'s already-a-member early return no longer contradicts `event_status()`
      (2026-09-03). It read `matched` off group size alone, so re-joining a **completed**
      meetup answered `matched`; `matched` is now withheld once the meetup has started or
      finished, which is what §3.5 means by it — the group filled while still forming
- [x] Left behind in the live project by this run: one `"env smoke test"` message and one
      `"socket smoke test"` message on Morning Trail Run, plus an
      `ExponentPushToken[env-smoke-test]` row for `@trailbrew`. **Deleted 2026-09-03** by id
      and exact token — 2 messages + 1 push token, confirmed by a select first. Deliberately
      not `seed -- --reset`, which would have taken every demo row with them. Older
      `"E2E group chat check"` / `"shape probe"` messages from the E2E run are still on that
      meetup; they were never on this list, so they were left alone
- [x] `verifyOtp` / `authDb()` path in `modules/auth/session.ts` — exercised live by the
      Google OAuth callback (2026-08-30): provider identity created, session link generated,
      `oauth_identities` row written (Supabase logs + live user). LINE would reuse the same path

### 1f. Backend hardening pass, 2026-09-03 — `fix-backend-hardening`

Worked the whole §5 / §1e backend list in one branch: **16 items closed**, nothing from that
list left open. Typecheck clean both packages, `npm test` 54/54 (five new: uuid params,
limiter growth, limiter namespacing, state binding, the binding cookie). Each fix is marked
in place above and in §5 rather than repeated here.

`migrations/005_backend_hardening.sql` is **applied to the live project** — `create_event`
exists with the expected signature, `join_event` is replaced, `push_receipts` is created with
RLS on, and the two message indexes are rebuilt on `(…, created_at, id)`. PostgREST's schema
cache was reloaded by the migration's trailing `notify`, so `create_event` is visible.

Driven live against `:4000` and the real Supabase project after the migration:

| Assertion | Result |
|---|---|
| `POST /events` with a future `start_time` | `201`, `current_size: 1` — the host row is written in the same transaction |
| `POST /events` with a past `start_time` | `400 INVALID_BODY`, "start_time must be in the future." |
| `GET /events/not-a-uuid` | `400 INVALID_ID` (was `500 DB_ERROR`) |
| `POST /events/:id/leave` on a completed meetup | `409 MEETUP_ALREADY_STARTED` |
| Re-join a completed **full** meetup | `joined`, not `matched` — no longer contradicts `event_status()` |
| `POST /auth/refresh` with a junk token | `401 REFRESH_REJECTED` |
| `GET /auth/google` | `302` + `Set-Cookie: atsumaru_oauth=…; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=600`, and the state payload carries `bind` |
| Callback replayed **without** the cookie | `400 INVALID_STATE` — login CSRF refused at the binding |
| Same callback **with** the cookie | `502 AUTH_PROVIDER_ERROR` from the PKCE exchange, i.e. it got past the binding, which is the proof the check is the thing rejecting the first case |
| `GET /events/:id/messages` twice | Identical, ascending `created_at` both times |

Test rows created by this run (two `"Hardening check"` events) were deleted afterwards;
`events` is back to 13.

Still unexercised, and not from the §5 list: the **Redis** path of `services/ephemeral.ts`
and the BullMQ sweep driver, both because `REDIS_URL` is empty; and Expo receipt collection,
because `sendPush` has never delivered a notification (no EAS project id).


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

- [x] **`schema.sql` now mirrors `migrations/001`, `002` and `003`** (2026-09-03). A fresh
      paste previously got `event_sizes` **without** `security_invoker` — the exact RLS
      bypass 001 exists to close, leaking every event id and group size to the anon key —
      plus no FK on `messages.connection_id`, no PK on `push_tokens`, none of the 8
      indexes, no pinned `search_path`, and no `keepalive`/`ping_keepalive()`. All of it is
      in `schema.sql` now, each index next to the table it belongs to, so a new environment
      comes up identical to the live one in one paste
- [x] **`AUTH_STATE_SECRET` no longer warns and carries on** (2026-09-03). The default is
      committed to this repo, so leaving it set made the OAuth `state` HMAC forgeable by
      anyone who had read the source. `config/env.ts` now collects production faults and
      `process.exit(1)`s on them, and the default is derived from one constant so the check
      and the value cannot drift apart
- [x] **OAuth `state` is now bound to the browser that started the flow** (2026-09-03).
      A signature only proved this server minted the state, so any well-formed one was
      accepted from any client — login CSRF. `signState` now also returns a random binding
      value, carried to the browser in an httpOnly `atsumaru_oauth` cookie
      (`Path=/api/auth`, `SameSite=Lax` because the provider's callback is a cross-site
      top-level navigation, `Secure` in production) while only its SHA-256 digest rides
      inside `state`. The callback rejects a state whose digest does not match the cookie
      and clears it on redemption, so a lifted state is useless in another client
- [x] The old Google `email_verified` hole is gone with the code that held it: Google no
      longer produces an `Identity` here at all — Supabase Auth verifies the provider and
      keys the user. **The equivalent risk now lives in identity linking** (`session.ts`):
      an address that already has an account gets the new identity attached to it, which is
      only safe while every linking provider verifies its addresses. LINE does, and only
      real provider-supplied addresses are ever linked (never a synthetic one)
- [x] **Site flare ported to mobile (2026-08-30).** Category stickers now encode data:
      `theme/colors.sticker` maps food/gaming/arts/outdoor to the site's electric band
      (neon/hot pink/lilac/sage) with an AA-verified `{ bg, on }` pair, shown on card,
      map pin, filter chip and meetup hero. `src/categoryMeta.ts` is the single source of
      glyph + colour (replaced four drifting per-surface maps). Editorial type: new
      `type.kicker` mono role + mono `sectionHeader` (Menlo / `monospace`, site's
      `ui-monospace` stack), tighter display/title1 leading. `components/ui/Sticker` does
      the site's hard offset vinyl shadow cross-platform (plain offset underlay — RN
      elevation cannot). Login gained the positioning kicker + 集まる wordmark + lilac
      ambient wash. Deliberately skipped: noise, marquee, dark mode, photo grids, real
      avatars. Typecheck clean, 34/34 tests
- [x] **Linking is gated on an explicit verified-email claim** (2026-09-03). It used to
      rest on an unwritten assumption that every provider verifies its addresses. `Identity`
      now carries `emailVerified`, each provider entry in `oauth.ts` declares
      `emailIsVerified` for itself, and `sessionForIdentity` answers
      `409 IDENTITY_NOT_LINKABLE` rather than attaching an identity to an existing account
      when the claim is missing. A new provider has to state the guarantee deliberately
      instead of inheriting it
- [x] `CORS_ORIGIN` defaulting to `*` is now a production boot failure (2026-09-03),
      alongside the state secret. Auth is a Bearer header rather than a cookie, so the
      exposure was low, but it is pinned now rather than trusted
- [x] **The app keeps its `refresh_token` and recovers from a 401** (2026-09-03). It was
      typed by `services/api/auth.ts` and then dropped, with no 401 handling outside the
      demo layer, so an expired access token dead-ended every screen with no way back.
      `storage/session.ts` now keeps it in SecureStore beside the access token (never
      AsyncStorage, per docs/RULES.md), `client.ts` refreshes once on a 401 and replays the
      original request, and `POST /api/auth/refresh` does the Supabase exchange server-side
      so no Supabase credential reaches the client. One refresh at a time — Supabase rotates
      the refresh token, so four concurrent queries firing four refreshes would spend it
      three times and kill the session. A failed refresh signs out rather than looping
- [x] `utils/rateLimit.ts` exported `prune()` and nothing ever called it, so the onboarding
      limiter held one counter per caller for the process lifetime. `take()` now prunes
      itself — but at most once per window, since walking the map is O(n) and doing it on
      every request would be worse than the leak (2026-09-03)
- [x] `POST /events` rejects a `start_time` in the past (2026-09-03). It used to create a
      meetup that `event_status()` already reported as `completed`: joinable by nobody, and
      immediately eligible for the sweep's ghost penalty against a group that never met
- [x] **Sweep side effects are now atomic with their stamps** (2026-09-03). `remind()`
      pushed then stamped and `settle()` docked then stamped, so BullMQ alongside the
      boot-time `sweepOnce()`, or two API instances, could double-notify and double-dock.
      Both now go through `claim()`, a conditional `update ... where <column> is null`
      that returns the row: exactly one caller wins and does the work. The deliberate
      trade is the opposite failure — a crash between the claim and the effect skips that
      event instead of repeating it, which is the right way round, because a missed
      reminder costs one notification while a double dock permanently alters a reputation
- [ ] Accessibility pass: emoji ratings need text equivalents, touch targets, no colour-only state (docs/DESIGN.md §10)
- [x] Index on `events (start_time, status)` — added in `migrations/001` along with the
      other 7 unindexed filter columns
- [x] **Handoff codes, PKCE verifiers and rate limits are out of process memory**
      (2026-09-03) — `services/ephemeral.ts` is one keyed store with two backends, the same
      one-body-two-drivers shape as the sweep: in-process Maps by default, Redis when
      `REDIS_URL` is set. Every operation degrades to the in-memory store on a Redis error
      rather than failing the request, so a dead Redis costs per-instance limiting and one
      re-login instead of a 500. Limiters are namespaced now that they share a store, and
      `take()` returns `{ allowed, retryAfterSeconds }` in one round trip. **The Redis path
      has never run** — `REDIS_URL` is still empty
- [x] `POST /events` writes the event and the host's `group_members` row in one
      transaction (2026-09-03) — `create_event` in `schema.sql`, called through `rpc()`
      exactly like `join_event`. Two separate inserts could leave a group with no members
      at all if the second one failed
- [x] `POST /events/:id/leave` now answers `409 MEETUP_ALREADY_STARTED` on an ongoing or
      completed meetup (2026-09-03). Without the guard a member could drop their
      `group_members` row before `settle()` read it and escape the ghost penalty
- [x] **All-meh recap inverts the caller's dislikes into a compliment.** A member who
      rates everyone `meh` gets `liked: []` but the AI path still ran — `vibeRecap`
      sees the `cooled` traits in `recapPrompt`, and the system prompt's "never say
      anyone was rated negatively" leaves the model nothing to write about except the
      very traits the caller disliked. Live proof (flood test 2026-08-30): sotaruns
      rated three members `meh` on Morning Trail Run and received "あなたはアウトドアで、
      活動的でボードゲーム好き、そしてリラックスした雰囲気の人と仲良くなれました。"
      The template path already handles this (`quiet` when `liked.length === 0` in
      `templateRecap`). **Fix (2026-08-30, `modules/recap/routes.ts`):** skip the AI
      branch on an empty `liked` list (`summary.liked.length > 0 && recapLimiter.take(userId)`),
      which also stops an all-meh member from burning the generation cap. Re-verified
      live after the edit: all-meh member → `source:"template"`, `traits: []`, the quiet
      Japanese sentence; harness rows deleted, DB restored
- [x] `connections/routes.ts:32` interpolates `userId` into a PostgREST `.or()` filter.
      Safe today (it is a UUID off the verified JWT); defence-in-depth only
- [x] **AI surface, stated exactly.** GROQ has two jobs — the onboarding chat and the
      post-meetup vibe recap (`docs/AI.md` §6a). HuggingFace has one: MiniLM preference
      vectors at onboarding. Matching and feedback consume/update the stored vector with
      plain arithmetic, no service call. **Group chat and DMs remain pure text plumbing** —
      no summarization, sentiment, smart replies, or message embedding, and message content
      is not a matching signal. Adding AI there is a product change (`docs/RULES.md` §10),
      needing new routes plus a socket hook

### 6. Out of scope for the appathon (docs/IDEA.md §10)

AI icebreakers, conversational feedback, women-only groups and safety layer, LINE
messaging integration, gamification, recurring circles, venue partnerships,
premium tier.

## Known gaps and risks

| Area | Note |
|---|---|
| LINE credentials | **Live 2026-08-30.** Channel configured and walked end to end; email permission approved, so LINE returns the real address and its identity links onto the existing account instead of creating a twin. The synthetic `@oauth.atsumaru.invalid` fallback remains for channels without that permission |
| Google OAuth | **Brokered by Supabase Auth (PKCE) since 2026-08-30**, so no public tunnel is needed and the client secret is out of the API. Walked live on the emulator. Three URLs must agree: Google console → Supabase's `/auth/v1/callback`, `OAUTH_CALLBACK_URL` → the API's own callback, and that same callback listed in Supabase → Redirect URLs (otherwise GoTrue silently falls back to Site URL — that failure looked like a broken app) |
| Identity linking trust | Linking a second provider to an existing address trusts the provider's email claim. LINE only releases verified addresses, and Google is now verified by Supabase itself, but the `email_verified` gap in §5 is what keeps this honest — do not extend linking to a provider that does not verify |
| Push receipts | **Collected since 2026-09-03.** Accepted tickets land in `push_receipts`, and `collectPushReceipts()` reads them back on a later sweep pass (Expo needs ~15 minutes to produce one), retiring a `DeviceNotRegistered` token and discarding a ticket Expo never answers within 24h. Isolated from the rest of the sweep, so a receipt problem cannot fail the stamped work. Unexercised for the same reason as the row below |
| Push in Expo Go | `sendPush` has never delivered: Expo Go dropped Android remote push, and `app.json` has no `extra.eas.projectId`, so no token can be minted. The sweep's reminder branch is verified only up to `pushTargets` returning zero devices |
| Single instance | **Addressed 2026-09-03.** Handoff codes, PKCE verifiers and rate-limit counters moved to `services/ephemeral.ts`, which uses Redis when `REDIS_URL` is set and process memory otherwise, so a second instance is now possible. Untested against a real Redis — `REDIS_URL` is still empty, and the BullMQ sweep driver is unexercised for the same reason |
| `docs/API_STRUCTURE.md` §5–6 | Still references the old OTP screens; `TRD.md` §17 says OAuth is canonical, and the code follows TRD |
| Two extra endpoints | `POST /auth/session` and `POST /users/me/push-token` are not in the contract; both are documented in README and CLAUDE.md |
| Demo mode | `EXPO_PUBLIC_DEMO_MODE=1` runs the app against an in-app stand-in for the API (`src/services/api/demo/`). It duplicates the match formula from `server/src/modules/matching/score.ts` — the two must not drift. `apps/mobile/.env` now ships with `0`, so the app talks to the real API |
| Demo layer gaps | `demo/index.ts` has no `/users/:id` handler, so the Connections list shows `@…` forever in demo mode (confirmed on device, §1d); and connect-picks for unrated members are dropped. Real API mode is unaffected |
| Expo Go vs the header | Expo Go's dev-launcher floating button covers the app's top-right settings gear, so Settings cannot be reached in Expo Go at all — the app's own screen is fine, the launcher just wins the tap |
| Mobile loop against the real API | **Closed 2026-08-30** — Google sign-in, onboarding (Groq), discovery, feedback submit, mutual unlock, and the DM thread were all driven live against `:4000`/Supabase with `DEMO_MODE=0` (Pixel emulator, Expo Go, ngrok tunnel; `context.md` §8). Only the DM *send* and the `atsumaru://` deep-link variant remain |
| `schema.sql` drift | It is behind `migrations/001–003`, so a fresh project is missing the `event_sizes` RLS fix and the rest. `004` is **not** part of this drift — it was written into `schema.sql` at the same time. See §5 |
| Vibe recap in demo mode | `EXPO_PUBLIC_DEMO_MODE=1` always takes the `source: "template"` path — there is no Groq offline. The card, traits and privacy line are real; nothing pretends a model ran |

