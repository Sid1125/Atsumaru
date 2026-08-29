# Atsumaru — work tracker

Status of the build against `docs/`. Updated 2026-08-29.

Legend: `[x]` done and verified · `[~]` code complete, not verified against a live
Supabase project · `[ ]` not started.

Verification baseline right now: `npm run typecheck` clean (both packages),
`npm test` 29/29 passing, API boots in four configurations (no provider, fake Supabase,
unreachable Redis, fake LINE credentials).

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

### 1. Prove the backend against a real project (blocks everything else)

- [ ] Create the Supabase project, fill `server/.env`, paste `server/db/schema.sql`
- [ ] `npm run seed -- --tokens`, then hit `/events/nearby` with a printed token — expect four meetups, the past one `completed`
- [ ] Confirm `join_event` under two concurrent joiners: exactly one gets the last seat
- [ ] Rewind an event's `start_time` by 90 minutes and run one sweep: reminder stamped, second sweep silent
- [ ] Confirm a ghost drops 2 points exactly once (`reputation_settled_at`)
- [ ] Walk Google OAuth end to end; then LINE once a channel exists
- [ ] Optional: set `REDIS_URL` (Upstash) and confirm the BullMQ driver takes over

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

### 4. Polish and hardening

- [ ] Accessibility pass: emoji ratings need text equivalents, touch targets, no colour-only state (docs/DESIGN.md §10)
- [ ] Sweep only reads events past their reminder window; add an index on `events (start_time, status)` if the table grows
- [ ] Move OAuth handoff codes out of memory if the API ever runs more than one instance
- [ ] Rotate `AUTH_STATE_SECRET` per deployment (the dev default warns in production)

### 5. Out of scope for the appathon (docs/IDEA.md §10)

AI icebreakers, conversational feedback, women-only groups and safety layer, LINE
messaging integration, gamification, vibe recap, recurring circles, venue partnerships,
premium tier.

## Known gaps and risks

| Area | Note |
|---|---|
| LINE credentials | The bridge is written but unexercised; a LINE Login channel is needed, and channels without the email scope fall back to a synthetic internal address |
| Push receipts | Tickets are checked, but Expo's async receipt endpoint is not polled — a token can go stale for one cycle |
| Single instance | Handoff codes and the rate limiter live in process memory; horizontal scaling needs Redis for both |
| `docs/API_STRUCTURE.md` §5–6 | Still references the old OTP screens; `TRD.md` §17 says OAuth is canonical, and the code follows TRD |
| Two extra endpoints | `POST /auth/session` and `POST /users/me/push-token` are not in the contract; both are documented in README and CLAUDE.md |
| Demo mode | `EXPO_PUBLIC_DEMO_MODE=1` runs the app against an in-app stand-in for the API (`src/services/api/demo/`). It duplicates the match formula from `server/src/modules/matching/score.ts` — the two must not drift. Ship builds must have it off |
| Mobile loop verified only in demo mode | The full loop passes on-device against the demo layer, not yet against a real API; §1 still gates that |

