# context.md — working context for the Atsumaru backend + OAuth wiring

> Purpose: a durable record of *why* this work is happening and *what* was decided, so a
> fresh session (or a context reset mid-task) can resume without re-deriving anything.
> `CLAUDE.md` = how to work in this repo. `TRACKER.md` = what is built. **This file = the
> live state of the current task.**
>
> Started 2026-08-30. Update the Change Log section as work lands.
>
> Two tasks are recorded here: the backend bring-up (B1–B10, §2–7) and the auth task
> (§1 + §8 for the original bridge run, §10 for the move onto Supabase Auth plus LINE and
> identity linking). Both are **complete** as of 2026-08-30; §9 is the live to-do list.
> §11 records a third, smaller task: the vibe recap, also complete.

---

## 1. The ask (OAuth task — COMPLETED 2026-08-30)

Make real Google OAuth login work on the Android emulator through Expo Go (the previous
task left OAuth "wired but unexercised"), then drive a **real mutual 1:1 connection** for
the Google-authenticated user through the live stack (ngrok tunnel → Express OAuth bridge →
exp:// handoff → Supabase session → in-app feedback → connections row).

**Status: done.** Google sign-in walks end-to-end in Expo Go and the connection
`DingDong ↔ @harucafe` exists in the live `connections` table (see §8).

The backend bring-up task (B1–B10) below was complete before this one; its ask was to
stand the API up against the live project, which recorded the eight defects that only a
real run could surface.

## 2. Environment (verified, not assumed)

| Fact | Value |
|---|---|
| Repo root | `D:\WeLiveAppathon` (workspace; repo root may differ from the original author's machine — paths in this file are relative unless noted) |
| Branch | `feat-backend-app`, cut from `main` at `d50d19e` |
| Node / npm | v22.14.0 / 11.7.0 |
| Supabase project | `ucxgvtcqoeazuhsgwbhf`, `ap-northeast-1` (Tokyo), ACTIVE_HEALTHY |
| Postgres access | Management API via `scripts/sql.mjs`; `current_user` = `postgres` |
| `psql` | present but unused — `C:\Program Files\PostgreSQL\18\bin\psql.exe` (not on PATH) |
| DB password | never set or retrieved; the Management API covers DDL without it |
| Extensions | `postgis` 3.3.7, `vector` 0.8.2 — installed into `extensions`, not `public` |
| `server/.env` | **created by this task** (gitignored) |
| `apps/mobile/.env` | **created by this task**, `EXPO_PUBLIC_DEMO_MODE=0` |
| Credentials | Supabase URL/anon/service-role + HuggingFace + Groq live in `server/.env` (gitignored). **`access_token.txt` does NOT exist at this checkout** — so `scripts/sql.mjs` (Management API) is blocked; admin work uses a service-role `createClient` instead |
| Deps | all three packages installed (`server`, `apps/mobile`, `site`) |
| Redis | intentionally absent — the in-process timer is the driver under test (see §4) |
| OAuth | **Google is brokered by Supabase Auth (PKCE) as of 2026-08-30** — client id/secret live in the Supabase dashboard, not `server/.env`. LINE is exchanged by the API and is also live (channel email permission approved). Both walked end to end on the emulator; see §8 and §10 |
| ngrok tunnel | **No longer used.** It was needed only while Google's callback had to reach our server from the public internet; Supabase's callback is public, so the tunnel was retired (process stopped) |
| Handoff scheme | `APP_AUTH_REDIRECT=exp://10.0.2.2:8081/--/auth` — must match the origin Expo Go loaded the bundle from. Shipped builds use `atsumaru://auth` |
| Metro host | Expo Go must load the project as `exp://10.0.2.2:8081`; Metro mirrors the request host into `hostUri`, and loading it via a vEthernet IP (`192.168.236.1`) makes the bundle unreachable and hangs on the splash |
| JDK | Temurin **21** at `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`; JDK 25 breaks the RN CMake task — 21 is what a dev build (`expo run:android`) would use |

Baseline before changes: `tsc` exit 0 on both packages, 29/29 unit tests passing. **Every
test was pure logic — nothing in the suite touched a database, which is why all nine
defects below survived it.**

## 3. Root causes found (evidence, not guesses)

Numbered B1–B9 to keep them distinct from the mobile task's D1–D13.

### B1 — `verifyOtp()` poisons the service-role client *(critical)*
`session.ts:78` called `client.auth.verifyOtp()` on the singleton from `db()`.
supabase-js resolves PostgREST's `Authorization` header through `auth.getSession()` and
only falls back to the supabase key when no session is held; `persistSession: false`
suppresses *storage*, not the in-memory session. So after the first successful login,
every `db().from(...)` in the process sent that user's JWT — straight into the deny-all
RLS in `schema.sql:306`. `auth.admin.*` kept working because it uses the key explicitly,
which is why login itself looked fine. First visible symptom is in the same request:
`profileOrNull()` returns null, so `is_new` is wrong for returning users.
**Fix:** an isolated `authClient()` / `authDb()` for session minting. Same bug in
`seed.ts printTokens()`.

### B2 — HuggingFace embeddings had never worked *(critical, silent)*
`ai.ts:94` posted to `api-inference.huggingface.co`, which HuggingFace retired — the host
has no A record, so curl exits 6. `embed()` therefore threw on every call ever made.
Invisible because `onboarding/routes.ts:154` treats embed failure as non-fatal:
onboarding completed, `preference_vector` stayed null, `cosine` returned 0, and every
match score was capped at the **0.40** ceiling of the two remaining terms. The scoring
engine looked alive and was inert.
**Fix:** `router.huggingface.co/hf-inference/models/{model}/pipeline/feature-extraction`,
drop the unsupported `options.wait_for_model`. Also added the missing `hasEmbeddings`
flag and a `503 EMBEDDING_UNAVAILABLE`, since this was the one integration with no
`has*` flag — contrary to the convention in `CLAUDE.md`.

### B3 — the pinned Groq model is decommissioned *(critical)*
`GROQ_MODEL` defaulted to `llama-3.3-70b-versatile`, which is not among the 14 models the
key can reach. Every `POST /onboarding/chat` would have 404'd.
**Fix:** `openai/gpt-oss-120b` — same 131k context, honours
`response_format: json_object`, and follows the reply-in-language instruction. Tested
against the real `SYSTEM_PROMPT` contract in en and ja. `groq/compound` set `done: true`
on turn one and `qwen/qwen3.8-27b` ignored the JSON contract, so neither is a substitute.
Changed in `.env`, `.env.example`, and the `config/env.ts` default — the last one matters
because copying the example file would otherwise reinstate the dead model.

### B4 — `join_event` reported the wrong error for a full event
Filling the last seat flips `status` to `full`, so the next joiner failed the
`status <> 'open'` test *before* reaching the size test and got `EVENT_CLOSED` →
409 "This meetup is closed" instead of "full". Found by actually racing two joiners; not
visible from reading, because the ordering only matters at exactly capacity.
**Fix:** capacity is the more specific condition, so it is tested first. A started
meetup with room still correctly returns `EVENT_CLOSED`.

### B5 — `typing` broadcasts into arbitrary rooms
`socket/index.ts:124` forwarded a client-supplied `room_id` straight to `socket.to()`
with no check. Any authenticated socket could emit into `group:{any_event}`,
`dm:{any_connection}`, or `user:{any_user}` — presence spoofing into rooms the caller
cannot otherwise touch. Every other socket handler checks membership.
**Fix:** gate on `socket.rooms`, which only holds rooms that passed a membership check.

### B6 — feedback could be submitted before the meetup
`POST /events/:id/feedback` never checked status or `start_time`, so a member could rate
the group the moment it formed, collect the `+2` participation credit, and unlock a
mutual 1:1 before anyone had met.
**Fix:** `409 MEETUP_NOT_FINISHED` unless the derived status is `completed`.

### B7 — mutual unlock re-fired on every resubmission
The connections upsert always wrote `unlocked_at: new Date()` and unconditionally
`emitToUser(..., "match:unlocked", ...)`. `firstSubmission` gated reputation and vector
learning but not the unlock block, so repeated POSTs reset the timestamp and re-notified
the other party indefinitely — the one non-idempotent path in an otherwise replay-proof
route.
**Fix:** read the pair first; an existing row is already-delivered.

### B8 — schema gaps that RLS was assumed to cover
`event_sizes` was not `security_invoker`, so it ran as its owner and would expose every
event id and group size to the anon key — the single hole in an otherwise clean deny-all
posture. Also: `messages.connection_id` had no foreign key (a bad id was silently
storable, and deleting a connection orphaned its DMs), `push_tokens` had no primary key,
and eight columns the sweep and connections list filter on were unindexed.
**Fix:** `migrations/001_hardening.sql`, idempotent.

### B9 — the mobile app could not bundle at all
`babel-preset-expo` was not declared anywhere, so Metro failed to construct a transformer
and served nothing. `expo-constants` and `react-native-worklets` were imported in `src/`
and `babel.config.js` but only resolved transitively through `expo`.
**Fix:** all three declared explicitly in `apps/mobile/package.json`.

### Found *during* verification (not visible from reading the code)

**B10 — PostgREST 404s on a new function until its cache reloads.** After
`migrations/003` created `ping_keepalive()`, the REST call returned
`404 PGRST202 "Could not find the function"` while the function plainly existed in
Postgres. **Fix:** `notify pgrst, 'reload schema'` after any migration that adds one.
*This will recur on every future function, so it is documented in `CLAUDE.md`.*

## 4. Decisions

**Redis is deliberately off.** `jobs/index.ts` runs the identical `runSweep()` body under
either driver, so the timer exercises the real logic. More importantly, `sweep.ts` stamps
its idempotency columns *after* the side effect rather than atomically — with two drivers
(the BullMQ worker plus the boot-time `sweepOnce()`) that races, and I would have been
verifying the sweep while fighting that bug. One driver, deterministic. **The atomicity
fix is a prerequisite for setting `REDIS_URL`**; it is written up in `TRACKER.md` §5 and
was left unfixed on purpose rather than bundled in silently.

**OAuth stays deferred.** *SUPERSEDED — see §8 and §10.* Originally: `seed --tokens`
mints genuine Supabase sessions through the admin API, so every authenticated route was
verified without a provider. Both providers are now live: Google through Supabase Auth
(PKCE) and LINE through the API's own bridge, with identities linked onto one account.

**Extensions go in `extensions`, not `public`.** Supabase convention; keeps several
hundred PostGIS functions out of the table namespace. `search_path` already covers it, so
unqualified `st_dwithin` resolves — but an explicit cast needs `extensions.vector`.

**Migrations are numbered files *and* an edit to `schema.sql`.** So a fresh project comes
up correctly from one paste, and the live project can be brought forward incrementally.
`scripts/sql.mjs` runs DDL through the Management API, so neither needs the dashboard.

**Only the anon key goes into CI.** The keepalive function is `security definer` with the
table revoked from `anon`, so the workflow can call exactly one thing and read nothing.

## 5. How to run

```bash
npm run setup                      # server + apps/mobile; site needs its own install
cd site && npm install

npm run dev --prefix server        # API on :4000  — root `npm run server` proxies this
npm run seed --prefix server -- --tokens   # 6 users, 4 Shibuya meetups, prints tokens
cd apps/mobile && npx expo start   # Metro on :8081, DEMO_MODE=0 → hits the real API
cd site && npm run dev             # :3000

# DDL without the dashboard (env values are in access_token.txt)
export SUPABASE_ACCESS_TOKEN=sbp_… SUPABASE_PROJECT_REF=ucxgvtcqoeazuhsgwbhf
node scripts/sql.mjs -f server/db/migrations/001_hardening.sql
node scripts/sql.mjs -c "select count(*) from events"
```

On Windows curl the API as `http://127.0.0.1:4000`, not `localhost`.

## 6. Change log

### Defect fixes

| File | Change |
|---|---|
| `server/src/db/supabase.ts` | `authClient()` added; the `supabase()` doc comment now states why session minting must never run on the singleton. **Fixes B1.** |
| `server/src/db/queries.ts` | `authDb()` wrapper alongside `db()`. **Fixes B1.** |
| `server/src/modules/auth/session.ts` | `verifyOtp` moved onto `authDb()`. **Fixes B1.** |
| `server/scripts/seed.ts` | `printTokens()` mints each token on a fresh client instead of the shared one. **Fixes B1.** |
| `server/src/services/ai.ts` | `embed()` on `router.huggingface.co`, `wait_for_model` dropped, `503 EMBEDDING_UNAVAILABLE` via `hasEmbeddings`. **Fixes B2.** |
| `server/src/config/env.ts` | `hasEmbeddings` flag; `GROQ_MODEL` default → `openai/gpt-oss-120b`. **Fixes B2, B3.** |
| `server/.env.example` | Groq model updated with a note not to reinstate the dead one. **Fixes B3.** |
| `server/db/migrations/002_…sql` + `server/db/schema.sql` | `join_event` tests capacity before status. **Fixes B4.** |
| `server/src/socket/index.ts` | `typing` gated on `socket.rooms`. **Fixes B5.** |
| `server/src/modules/feedback/routes.ts` | `409 MEETUP_NOT_FINISHED` unless derived status is `completed`. **Fixes B6.** Existing connections read before upsert, so no re-stamp and no re-notify. **Fixes B7.** |
| `server/db/migrations/001_hardening.sql` | `security_invoker` on `event_sizes`, FK on `messages.connection_id`, PK on `push_tokens`, 8 indexes, pinned RPC `search_path`. **Fixes B8.** |
| `apps/mobile/package.json` | `babel-preset-expo`, `expo-constants`, `react-native-worklets` declared. **Fixes B9.** |

### New wiring

| File | Purpose |
|---|---|
| `scripts/sql.mjs` | **new** — runs SQL against the project through the Management API, so migrations need no dashboard trip. |
| `server/db/migrations/` | **new** — numbered migrations; `001` hardening, `002` join ordering, `003` keepalive. |
| `server/db/migrations/003_keepalive.sql` | **new** — `keepalive` table + `security definer` `ping_keepalive()`, granted to `anon` with the table revoked. |
| `.github/workflows/keepalive.yml` | **new** — one ping a day at 03:17 UTC (off the hour on purpose: busy cron minutes get delayed or dropped), 3 attempts with backoff, plus `workflow_dispatch`. |
| `server/.env` | **new** (gitignored) — all four integrations. |
| `apps/mobile/.env` | **new** (gitignored) — `EXPO_PUBLIC_DEMO_MODE=0`; URLs left blank so `config/env.ts` keeps choosing `10.0.2.2` on Android. |
| `apps/mobile/.env.example` | URLs blanked with the emulator reasoning; `DEMO_MODE` documented (it was missing entirely). |
| `access_token.txt` | **new** (gitignored, added to `.gitignore` *before* being written) — every credential, annotated with which are secret and what to rotate. |
| GitHub repo secrets | `SUPABASE_URL`, `SUPABASE_ANON_KEY` set via the Actions API. |

### Documentation

| File | Change |
|---|---|
| `CLAUDE.md` | Database section (project ref, migration discipline, `extensions` schema, the PostgREST cache reload, keepalive); `scripts/sql.mjs` commands; the `verifyOtp` prohibition; a note that third-party endpoints and model ids drift silently; `EMBEDDING_UNAVAILABLE` in the degradation list; "Not implemented" rewritten now that the backend is verified. |
| `TRACKER.md` | §1 closed with the assertion list; §1b (10 defects found by running it) and §1c (keepalive) added; sweep atomicity, non-transactional `POST /events`, and the leave-dodges-penalty gap added to §5; known-gaps table corrected — push has never delivered, and the demo layer's `/users/:id` hole is recorded. |

## 7. Verification log

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 — server and mobile |
| `npm test` | 29/29 passing |
| `cd site && npm run build` | clean; 4 static pages, TypeScript 8.5s |
| Metro bundle, `platform=android`, `DEMO_MODE=0` | **1782 modules**, 9.85 MB, no compile errors; every screen present |
| Seeded state | 6 users (**6/6 with a 384-dim `preference_vector`**), 4 events, 14 members, 4 messages, 3 feedback rows |

### Live API — 54 assertions, all passing

Run against the real project with tokens from `seed --tokens`, then reset to a clean
demo world and the harness deleted.

| Group | Result |
|---|---|
| Auth & profile (3) | `/auth/me` returns the profile; **`real_name` absent**; unauthenticated → 401 |
| PostGIS discovery (4) | 3 open meetups at Shibuya, finished one excluded, `location` nested, Osaka radius empty — the filter is real, not incidental |
| Match preview (4) | score **0.47–0.82**, reasons in the member's language. **Above the 0.40 no-vector ceiling, which is the proof embeddings reach the score** |
| `/events/mine` (2) | includes completed meetups, which `nearby` excludes |
| Membership gates (1) | non-member reading group chat → 403 `NOT_A_MEMBER` |
| Feedback gate (1) | unfinished meetup → 409 `MEETUP_NOT_FINISHED` (B6) |
| **Join row lock (7)** | two simultaneous joins for one seat → **exactly one 200 `matched`, one 409 `EVENT_FULL`**; `current_size` never exceeded `max_size`; event flipped to `full` |
| **Mutual unlock (7)** | 2 of 3 picks reciprocated → **exactly 2 connections, the non-mutual pick absent from the response** (`docs/RULES.md` §9); form excludes self |
| **Unlock idempotency (3)** | resubmitting left `unlocked_at` byte-identical, same ids, no duplicates (B7) |
| DM privacy (4) | send 201, paging envelope returned, **non-participant → 403 `NO_CONNECTION`** |
| Groq onboarding (8) | live chat in **en and ja** (`ラーメンとレトロゲーム、素敵ですね！…`), handle suggest/check, rate limiter never 500s |
| **Sweep (8)** | 90-min rewind → reminder stamped, settlement correctly withheld; second sweep silent; 3-hour rewind → **5/5 ghosts docked exactly 2 points**, stamped, event closed; fourth sweep changed nothing |

### Dev servers

| Service | Result |
|---|---|
| API `:4000` | `{"status":"ok","supabase":true,"groq":true,"oauth":{"line":false,"google":true}}` — Google creds present; LINE still empty |
| Metro `:8081` | HTTP 200, bundles the app against the real API |
| Site `:3000` | HTTP 200 |
| Keepalive workflow | ran the workflow's exact shell body locally against the live project — `ping_count` incremented, exit 0; anon can call the function but **cannot read the table** (401) |

**Known limitations (as of this task's end).** Push has never actually delivered: Expo Go
dropped Android remote push and `app.json` has no `extra.eas.projectId`, so no token can
be minted — the sweep's reminder branch is verified only as far as `pushTargets` returning
zero devices. The mobile loop has **now** been driven through the real API on the emulator
(demo is still the shortcut for a zero-config run): Google sign-in, onboarding,
discovery, feedback, mutual unlock, and the DM thread screen all walked live in this
session. OAuth is **no longer** unexercised — only the `atsumaru://` deep-link variant
(dev-build-only deeplinking into the running app) remains untested by design; Expo Go goes
through `exp://` instead.

**Housekeeping.** The `sbp_` management token is account-wide across 9 projects and the
`ghp_` token carries `admin:enterprise` and `delete:packages` for what only needed
`Contents:write`; both, plus the service-role key, passed through a chat transcript and
should be rotated. The commit diff was scanned for all four token prefixes (0 matches),
and the push URL credential was stripped from `.git/config` afterwards.

---

## 8. Session log — real Google OAuth + real mutual connection (2026-08-30)

### What was set up

| Item | State |
|---|---|
| Google creds | `server/.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_STATE_SECRET` (len 64). Console authorized redirect = the ngrok domain |
| `server/.env` fixes | `OAUTH_CALLBACK_URL` was wrong (`supabase.co/auth/v1/callback`) → now the tunnel; `APP_AUTH_REDIRECT=exp://192.168.1.11:8081/--/auth`, comment documenting it is dev-only |
| `apps/mobile/.env` | `EXPO_PUBLIC_DEMO_MODE=0`, API/WS URLs → tunnel |
| `useOAuthLogin.ts` | `exchange()` takes **any** URL with a `code` param (host-agnostic), so both `atsumaru://auth` and `exp://…/--/auth` handoffs work; listener + `getInitialURL` no longer filter on `://auth`. `tsc --noEmit` clean |
| JDK | Temurin 21 installed (machine scope) after JDK 25 CMake failure; dev build (`expo run:android`) was started then **aborted by user** — Expo Go chosen instead |
| Tunnel | `https://7577-106-219-157-93.ngrok-free.app` → `:4000`; OAuth verified through it (code exchange + session 200s in Supabase logs) |
| Google identity | provider_sub `103310651711276628766` → user `751fcbc7-991d-4f50-ab4d-5bb64a7c92cb`, handle **`@drivinggaming`**, display **DingDong** |

### The unlock (verification)

1. Drove feedback for completed **Morning Trail Run**
   `bfd54de8-cff6-4d8f-b88a-1c4c48d1adce`: added DingDong to `group_members`, pre-seeded
   `@harucafe`'s reciprocal pick (`fire`, `wants_connection=true`) via a throwaway
   service-role script (no `SUPABASE_ACCESS_TOKEN` exists anywhere, so `sql.mjs` was
   unusable).
2. In-app: opened the event, tapped **🔥 Great vibe** on @harucafe, **REJOIN=Yes**, ticked
   **@harucafe** in the connect chips, **Submit**.
3. **Result (verified from the live DB, table `connections`):**
   `harucafe 44428a51-8d37-4138-9348-3add3b14f0f5 ↔ DingDong 751fcbc7-…`, created
   `2026-08-30T10:12:25Z`. App landed straight in the new DM thread ("No messages yet.
   Say hello 👋"). **No `dms` table exists** — the first verify script 404'd on it; DM
   persistence lives in `messages` (`connection_id` FK), which returned `[]` at submit
   time because no message had been sent yet.
4. Side note: a stray tap also rated @sotaruns `fire` with `wants_connection=true`, but
   he never reciprocated → **no** extra connection surfaced (privacy rule held; only
   mutual pairs appear).

### Gotchas encountered

- Expo Go cannot route `atsumaru://`; it does handle `exp://` (verified in the manifest).
  `exp://host:8081/--/auth?code=…` delivered the handoff back to the app.
- The app bounced to LoginScreen on a hard reload (auth store not rehydrated); a second
  Google tap re-authenticates instantly with the existing consent.
- Sticking `pending` spinner on the Google button mid-`openURL` once; driving Chrome
  directly (`am start -a VIEW -d <authorize URL>`) ran the same handoff path fine.
- `sql.mjs` (Management API) is blocked here: `access_token.txt` does not exist in the
  repo the way §2 says — service-role `createClient` is the working substitute.
- Metro: `npx expo start --port 8081` (npm swallows `--port`); log at
  `C:\Users\siddh\AppData\Local\Temp\opencode\metro.log`; tunnel expires on ngrok
  restart — refresh `.env` + Google console together.

---

## 9. What is left (updated after §10)

**Done since this list was first written:** LINE OAuth (live), identity linking so one
person keeps one account across providers, and the move of Google onto Supabase Auth
(which retired the ngrok dependency).

1. **DM round-trip test**: the thread screen has been opened but no message sent — verify
   the `messages.connection_id` insert + `dm:{connection_id}` socket stream + REST history.
2. **`atsumaru://` handoff**: only `exp://` has been walked. A dev build (JDK 21 is ready)
   should re-run with `APP_AUTH_REDIRECT=atsumaru://auth`.
3. **Production URL set**: Google console keeps Supabase's callback, but `OAUTH_CALLBACK_URL`
   and the Supabase Redirect URLs list both need the deployed API origin instead of
   `10.0.2.2` before anything ships.
4. **`AUTH_STATE_SECRET` hardcoded default** — production only warns; make it exit
   (`TRACKER.md` §5). Now doubly relevant: the state also keys the PKCE verifier.
5. **Sweep atomicity** — still the gate on `REDIS_URL` + BullMQ.
6. **Push** — needs an EAS projectId and a dev build.
7. **`schema.sql` drift** vs `migrations/001–003` — a fresh project still comes up without
   the `event_sizes` RLS fix. Highest-priority item in `TRACKER.md` §5.
8. **Credential rotation** — `sbp_`, `ghp_`, service-role key all passed through chat
   transcripts. Google's client secret is now also in the Supabase dashboard; the copy in
   `server/.env` is unused and can be blanked.
9. **Mobile gaps (by design)**: map refetch debounce, message-history infinite scroll,
   venue picker in create-event.
10. **AI surface** *(item rewritten — see §11)*: GROQ now has **two** jobs, the onboarding
    chat and the post-meetup vibe recap; HuggingFace still has one, the preference vector.
    **Group chat and DMs remain pure text plumbing** — no summarization, sentiment, smart
    replies, or message embedding, and message content is deliberately not a matching
    signal. Adding AI there is still a product change needing new routes + socket hooks.

---

## 10. Session log — Google moved onto Supabase Auth, LINE live, accounts linked (2026-08-30)

### Why

The Google flow worked but depended on an ngrok tunnel whose domain rotated on every
restart, forcing a paired edit of `server/.env` and the Google console each time. Handing
the provider exchange to Supabase removes the public-callback requirement entirely, because
Supabase's own callback is already public.

Two shapes were considered. The thin one (redirect straight to Supabase and let it return
tokens in the URL fragment) was rejected: it would have put tokens in a URL, which is the
exact property `TRD.md` §5 and the one-time handoff code exist to avoid. The chosen shape
keeps that property.

### What changed

| File | Change |
|---|---|
| `modules/auth/oauth.ts` | `pkcePair()` (SHA-256 challenge), `supabaseAuthorizeUrl()`, `callbackWithState()`, and a single-use verifier store keyed by the signed state. Google's own authorize/token/tokeninfo code **deleted** — Supabase holds those credentials now; `CONFIG` narrowed to LINE. `providerConfigured("google")` now means "Supabase reachable" |
| `modules/auth/session.ts` | `sessionFromSupabaseCode()` redeems `?grant_type=pkce` with a bare `fetch` (supabase-js would save the session onto the client — the same trap `verifyOtp` sets). `isEmailTaken()` + link path: a provider address that already has an account gets the identity attached instead of a twin, id resolved from `generateLink`. `is_new` now means "no profile row" on **both** providers |
| `modules/auth/routes.ts` | `/auth/google` mints PKCE and redirects to Supabase; `/auth/callback` accepts our state back as `?st=` (GoTrue issues its own `state` to Google and forwards nothing of ours) and branches google → Supabase, line → the existing bridge. Handoff code and `?redirect_to=app` unchanged, so **mobile code needed no change at all** |
| `.env` / `.env.example` | `OAUTH_CALLBACK_URL` back to our own callback; topology documented in comments |
| tests | PKCE digest, authorize params, state round-trip through the callback URL, verifier single-use + expiry, `isEmailTaken` branch. 29 → **34 passing** |
| docs | `TRD.md` §5 rewritten with the three-URL table, `docs/README.md` + root `README.md` auth sections, `TRACKER.md` |

### Verified live (not inferred)

- `/auth/v1/settings` reported `google: false` at first — the dashboard toggle had not
  saved. That is why the authorize call answered
  `{"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`.
- Before the Redirect URLs list included our callback, Supabase silently redirected to
  **Site URL** instead: Chrome sat on `localhost:3000/?code=…` with
  `ERR_CONNECTION_REFUSED`. The code was valid; the destination was wrong. Worth
  remembering — it looks like an app bug and is not one.
- Redirect chain, after both were fixed: our `/api/auth/google` → Supabase authorize →
  `accounts.google.com` with `redirect_uri=https://<ref>.supabase.co/auth/v1/callback` and
  our `st` preserved on `redirect_to`.
- Google sign-in on the emulator attached a **`google` identity to the existing user**
  `751fcbc7` (`identities=[email, google]`), so `@drivinggaming`'s profile, membership and
  the harucafe connection survived the auth swap.
- LINE sign-in, after its channel email permission was approved, returned the real address
  → `createUser` answered "already registered" → the new link path attached
  `line/U5d0cc9b3c54…` to the same `751fcbc7`. Auth-user count stayed at **7**; the earlier
  twin (`e243beff`, no profile) was deleted first. LINE now lands on `@drivinggaming`
  directly, `is_new` false.

### Traps hit on the way

- **Endless Expo Go spinner was not our code.** Metro advertised
  `hostUri=192.168.236.1:8081` (a Hyper-V adapter), so the bundle URL was unroutable from
  the emulator: `ReactNativeJS: Cannot connect to Expo CLI`. Metro mirrors the host it was
  asked on, so opening `exp://10.0.2.2:8081` fixes it — and that origin must match
  `APP_AUTH_REDIRECT`, or the handoff deep link goes nowhere.
- A LINE login that *looked* like it opened the Google account had simply never reached the
  app: the deep-link origin was stale, so the app kept its existing session. The giveaway
  was `e243beff` having no `public.users` row.
- `sql.mjs` is still unusable here (no `SUPABASE_ACCESS_TOKEN`); every admin check in this
  session used a throwaway service-role `createClient` script, deleted after each run.

---

## 11. Session log — vibe recap built (2026-08-30)

### The ask, and the correction that shaped it

The user opened with an *assertion*, not a request: a table stating that GROQ and
HuggingFace are not in group chats, and that chat is pure plumbing. That assertion was
correct — I verified every cell against the code. But I then started writing docs and an
import-boundary test to **describe** that absence, which the user cut off: *"why u write
documenting the features which are not present build them"*. Reverted all of it
(8 files + a deleted test) and asked which AI-in-chat feature to build instead.

Chosen from four options: **vibe recap** (`docs/IDEA.md` §10, previously listed as
out-of-scope), with both real-API and demo-mode support. Explicitly *not* chosen: smart
replies and thread summary — the two that would have required sending message content to a
model.

**Lesson worth keeping:** a correct observation about missing behaviour is not a request to
document it. When the user states a fact about the codebase, the useful next move is to ask
what they want built on top of it.

### What was built

`GET /events/:id/recap` — one Groq-written line per member per finished meetup, about the
traits *they* rated highly.

| File | Purpose |
|---|---|
| `server/db/migrations/004_meetup_recaps.sql` + `schema.sql` | **new** — `meetup_recaps`, keyed `(event_id, user_id)`, RLS on. Written to both at once, so `004` is *not* part of the §9-item-7 drift |
| `server/src/modules/recap/vibe.ts` | **new** — pure: trait aggregation, en/ja/zh template, `sanitizeRecap`. No I/O, so the interesting cases are unit-testable |
| `server/src/modules/recap/routes.ts` | **new** — four gates, cache-first read, 10/hour generation cap |
| `server/src/services/ai.ts` | `vibeRecap()` — Groq's second and only other job |
| `apps/mobile/.../recap/VibeRecapCard.tsx` + `useVibeRecap` + `eventsApi.recap` | **new** — renders nothing in all three non-answer states, on purpose |
| `apps/mobile/.../demo/index.ts` + `world.ts` | template-path mirror, so demo mode works with no credentials |
| i18n `en/ja/zh` | `recap.title`, `recap.privacyNote` |

### Decisions

**Per-user, not per-event.** The recap is built from the rows where `from_user` is the
caller, so two members of one meetup see different text and neither can infer the other's
picks (`docs/RULES.md` §8). This is why `user_id` is in the primary key rather than just
`event_id`, and why nothing in the table records *who* was rated — only aggregate traits.

**The prompt cannot express a person.** `RecapPrompt` holds liked traits, cooled traits, a
count, and the meetup category. There is no field a handle or user id could travel in,
which is a stronger guarantee than remembering to strip them at the call site. Output still
passes `sanitizeRecap()` because a model can hallucinate a name it was never given.

**Ties break alphabetically, not by input order.** Input order is member join order; letting
it survive into the wording would make the sentence a weak channel for who was rated.

**Groq failing is not an error here.** No key, an unusable answer, or a rate-limited caller
all fall back to `templateRecap()`. Onboarding can afford a 503 because the user is sitting
there waiting; a recap is passive, so an error would render an empty card that reads as a
bug. `source` (`ai` | `template`) records which path ran — without it, "did the AI path
actually work?" is unanswerable from the data.

### Verified live (not inferred)

Migration applied through `scripts/sql.mjs` (the `sbp_` token *does* exist in
`access_token.txt` at this checkout, unlike what §8 records), then `notify pgrst, 'reload
schema'`. A throwaway harness ran **10/10 assertions** against `:4000` with real seeded
tokens, and was deleted along with its rows:

- 200 + non-empty recap; `source` ∈ {ai, template}; no handle in the payload
- re-read byte-identical (cache, not a re-roll)
- **@harucafe and @ramenkenji, same meetup, different recaps** — the per-user property
- a member with no own feedback → 403/404, never someone else's recap
- unfinished meetup → 409 `MEETUP_NOT_FINISHED`; unauthenticated → 401

Both paths exercised: a second instance on `:4001` with `GROQ_API_KEY` unset proved the
template fallback in English.

**A bug only the live run found.** The English template produced *"ramen and coffee and
hiking"* — one separator was used for both the run and the final join. Fixed with a separate
`lastJoin` (CJK keeps `、` for both), in the server *and* the demo mirror, plus a test
pinning the exact string. The unit tests had used a loose regex that matched the broken
output.

### Brute re-verification (2026-08-30, the "test it brutally" pass)

Same live API, adversarial this time — every gate hammered instead of walked, then all
harness rows deleted. 48/48 tests + typecheck held.

- **Rate-limit flood** — a fresh user with 11 seeded completed meetups, hit sequentially:
  calls 1–10 → all `source: "ai"`, call **11 → `source: "template"`**. The 10/hour cap
  lands exactly, and the over-budget member still gets a real sentence.
- **Concurrency** — 8 parallel `/recap` on one fresh meetup: all 8 → 200, byte-identical
  `created_at`, and exactly **one** row in `meetup_recaps`. `onConflict` holds under the
  race the cache-first read creates.
- **RLS** — anon and authenticated users (even the recap's owner) both get `[]` from Raw
  REST on `meetup_recaps`; **no policy is defined**, so the table is service-role-only —
  the recap is reachable solely through the gated API route. Strongest posture, not a leak.
- **Isolation** — ramenkenji reading trailbrew's recap row → `[]`; only the API route
  (membership-gated) serves recaps. sotaruns' all-meh recap proves the per-caller trait
  buckets: `traits: []` stored, but see the finding below.
- **Auth** — garbage and expired JWTs → 401 `UNAUTHORIZED`; non-member → 403 `NOT_A_MEMBER`;
  no-feedback member → 404 `NO_FEEDBACK_YET`; open meetup → 409 `MEETUP_NOT_FINISHED`.
- **`vibeRecap` never throws** — a failed or unparseable model answer returns null and the
  route falls back, confirmed by reading `ai.ts` (returns null on any catch).

**One new defect, now in `TRACKER.md` §5:** an **all-`meh` recap inverts the caller's
dislikes into a compliment.** A member who rates everyone `meh` gets `liked: []` but the AI
path still runs: the `cooled` traits reach Groq in `recapPrompt`, and the "never say anyone
was rated negatively" instruction leaves the model nothing to praise except the very people
the caller disliked. Live: sotaruns rated three members `meh` and was told "あなたは
アウトドアで、活動的でボードゲーム好き、そしてリラックスした雰囲気の人と仲良くなれました。"
The template path already does the right thing (`quiet` when `liked.length === 0`), so the
fix is a one-line gate: skip the AI branch on an empty `liked` list.

48/48 tests (14 new), `npm run typecheck` clean on both packages.

### State

Branch `feat-2-ai-vibe-recap`, cut from `main` at `403672f` after pulling 14 commits.
Commit `f48646c`, pushed to `origin` with upstream set. Staged diff was scanned for
`sbp_`/`ghp_`/`hf_`/`gsk_`/JWT prefixes — 0 matches; `access_token.txt` and both `.env`
files confirmed gitignored. No PR opened yet.

**Not touched:** the map. It was never in scope for this task and its state is unverified
here — `components/map/` is still the hand-authored SVG city, and the Mapbox path still
needs a token plus a dev build.
