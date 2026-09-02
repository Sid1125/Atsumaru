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
> §11 records a third, smaller task: the vibe recap, also complete. §12 is a fourth:
> wiring Mapbox behind a fallback — code complete, but the Mapbox surface itself has
> never run (no token, no dev build). §13 is the Warm Japanese Editorial visual
> overhaul (2026-09-01, complete); §14 the recap/onboarding AI hardening + E2E pass
> (2026-08-31); §15 the personality/interest/category onboarding work (2026-09-01,
> complete); §16 the TEE decision + hardware-backed device identity (2026-09-01,
> code complete, needs a dev build to run); §17 the security-hardening pass against
> ATSUMARU_SECURITY_COMPLETE.md (2026-09-02; findings + fixes in `docs/SECURITY_AUDIT.md`).

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
| Git history | `main` rewritten with `git-filter-repo` to strip the `Co-Authored-By: Claude` trailer from 6 merged commits; the three stale feature branches (`feat-backend-app`, `feat-mapbox`, `feat-2-ai-vibe-recap`) and local `backup-*` refs deleted. No code or authorship changed — the commit set and file tree are identical. |

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

**One defect, fixed and re-verified (now `TRACKER.md` §5):** an **all-`meh` recap inverts
the caller's dislikes into a compliment.** A member who rates everyone `meh` gets
`liked: []` but the AI path still ran: the `cooled` traits reach Groq in `recapPrompt`,
and the "never say anyone was rated negatively" instruction leaves the model nothing to
praise except the very people the caller disliked. Live: sotaruns rated three members
`meh` and was told "あなたは
アウトドアで、活動的でボードゲーム好き、そしてリラックスした雰囲気の人と仲良くなれました。"
The template path already does the right thing (`quiet` when `liked.length === 0`), so the
fix landed as a one-line gate in `routes.ts`: skip the AI branch on an empty `liked` list
(`summary.liked.length > 0 && recapLimiter.take(userId)`). **Re-verified live** after the
edit — sotaruns, one all-`meh` feedback on Morning Trail Run, answered `source:"template"`,
`"今回は静かな集まりでした。次のグループはもっと好みに近づきます。"`, `traits: []`;
the throwaway feedback row and recap were then deleted (DB back to seed state).

48/48 tests (14 new), `npm run typecheck` clean on both packages.

**Edge pass (2026-08-30, "test more edge cases"):** a fresh live harness — linlens zh,
two completed events, three helper members with controlled traits (`coffee/cheerful`,
`ramen/quiet`, `bouldering/calm`) — then deleted along with its rows:

- **Mixed fire+meh** — stored `traits` equalled the liked bucket **exactly**
  (`["cheerful","coffee"]`), and the AI text named only those: the meh member's
  `ramen/quiet` never surfaced. This is the all-meh inversion bug, checked at its
  non-degenerate neighbour.
- **All-fire** — bucket `["cheerful","coffee","quiet"]`: alphabetical top-3, `ramen`
  correctly sliced off at `MAX_RECAP_TRAITS`. Stored traits are the contract; the text is
  the model's paraphrase.
- **Cache-first beats new feedback** — after recap B was cached, adding a third member
  plus a `fire` rating changed nothing: re-GET was byte-identical (`created_at` the same),
  traits still 3. Confirms "the recap never changes" — later feedback is invisible by
  design, worth knowing before anyone expects a recap to update.
- Third live language exercised: **zh** (trailbrew en, ramenkenji ja, linlens zh).

Test count now 49/49 (the extra one pins the single-`good` boundary: weight 1 clears
`MIN_TRAIT_WEIGHT=1` into `liked`).

### State

Merged into `main` (PR #2). The all-meh fix and `WIRING.md` (wiring + boot map, linked from
the README docs table and referenced by `CLAUDE.md`) landed as commit `0e3eebd` on `main`;
working tree clean. The earlier feature-branch push (`f48646c`) was scanned for
`sbp_`/`ghp_`/`hf_`/`gsk_`/JWT prefixes before it left — 0 matches; `access_token.txt` and
both `.env` files are gitignored. No PR open beyond the merged one.

**Not touched:** the map. It was never in scope for this task and its state is unverified
here — `components/map/` is still the hand-authored SVG city, and the Mapbox path still
needs a token plus a dev build. *(Superseded by §12: Mapbox is now wired behind a
fallback, though still unrun.)*

## 12. Session log — Mapbox wired behind a fallback (2026-08-31)

### The ask

"Pull main, check whether Mapbox is set; if not, branch off main as `feat-mapbox` and wire
it." Pulled `main` (fast-forward through `0e3eebd`, the vibe-recap merge), checked, branched.

### What "set" turned out to mean

Mapbox was **installed but not wired**, which is the worst of the three possible states:

- `@rnmapbox/maps@10.3.5` in `apps/mobile/package.json`, and `"@rnmapbox/maps"` listed in
  `app.json` `plugins`
- **zero imports anywhere in `src/`** — the only mention was a comment in `geo.ts`
  explaining why the map was hand-authored instead
- `EXPO_PUBLIC_MAPBOX_TOKEN` present in both `.env` and `.env.example`, blank in both, and
  documented as "unused" in `WIRING.md`

So the plugin was injecting a Mapbox maven repo and a native module into every Android
build — which is what forced `expo run:android` over Expo Go — for a map that did not
exist. `TRACKER.md` §1d had already flagged it as dead weight to delete. `docs/TRD.md` §12
names `@rnmapbox/maps` as the map, and docs win, so it was wired rather than dropped.

### The constraint that shaped the design

`@rnmapbox/maps` throws from **module scope**: `RNMBXModule.ts` reads
`NativeModules.RNMBXModule` and throws immediately if it is null, which is exactly the case
in Expo Go. A top-level `import` therefore takes the whole bundle down before any of our
code runs — the same class of trap as `expo-notifications` in `usePushRegistration.ts`,
though for a different mechanical reason (that one escapes `try/catch` via the global error
handler; this one is a plain synchronous throw, so a `try/catch` around `require()` *does*
contain it — what is unsafe is the static import).

Hence: one load point, `components/map/mapbox.ts`, deferred `require()`, and a hard rule
that no other module may import the package. `MapboxMap.tsx` needs its types, so it uses
`import type` — verified erased by emitting the file and grepping the output.

### What was built

- `mapbox.ts` — `loadMapbox()` / `hasMapbox()`, memoised. Requires **both** a token and a
  build that links the module; sets the access token and disables telemetry once
- `MapSurface.tsx` — one branch, deliberately the same shape as the `DEMO_MODE` switch in
  `services/api/client.ts`. Mapbox when available, `InteractiveMap` otherwise
- `PinBody.tsx` — the annotation extracted out of `MapPin`, now shared. `PIN_BOX` /
  `PIN_POINT_Y` are what let a `MarkerView` anchor the stem's point on the coordinate
- `framing.ts` — `CHROME_HEIGHT` / `EXPOSED_FRACTION` / `SHEET_MAX_EXPOSURE` lifted out of
  `InteractiveMap`, now feeding Mapbox camera padding as well as the vector map's pan clamp
- `MapboxMap.tsx` — `MapView` + `Camera` + one `MarkerView` per meetup, `StyleURL.Light`,
  labels localised to `i18n.language`, attribution/logo lifted clear of the sheet
- Refetch on settle (docs/FRONTEND.md §9) — gesture-driven moves only, 400 m threshold.
  `DiscoverScreen` holds the panned centre in its own state so the location read stays
  one-shot (docs/RULES.md)
- `app.json` pins `RNMapboxMapsVersion: "11.23.1"` — the value the package defaults to,
  read out of its own `package.json`, rather than leaving the native SDK floating

### Decisions

- **Fallback, not replacement.** The vector city stays and is the Expo Go path. It is a
  complete map, so a missing token changes the renderer rather than breaking the screen —
  the same reasoning as `templateRecap()` being the floor for the vibe recap
- **Label inside the pin's box.** Android clips a `MarkerView` child drawn outside the
  measured bounds, so the box reserves a fixed 52pt slot for it. That fixed height is also
  what makes the anchor ratio computable
- **Only the vector map counter-scales pins.** Mapbox positions annotations in screen space
  and leaves their size alone; counter-scaling there would fight it
- **No `id` prop on `MarkerView`** — not in its props type; `key` is what React needs

### Verified

- `npm run typecheck` clean on both packages; `npm test` 49/49
- `npx expo export --platform android` bundles 1771 modules — the Mapbox branch compiles
  and the deferred require does not pull the native module into the tokenless path
- `import type` erasure confirmed by emitting `MapboxMap.tsx` and grepping for `rnmapbox`

### Not verified — and why

**The Mapbox surface has never been on a screen.** No `pk.*` token has been issued, and
Expo Go has no native module, so every run took the vector-city branch. Tiles,
`MarkerView` anchoring, camera padding and the settle-refetch are all unexercised.

The emulator re-check was also blocked by something unrelated: Expo Go SDK 57 redboxes at
startup with `TurboModule method "installTurboModule" called with 0 arguments` out of
`NativeWorklets` (react-native-worklets / Reanimated 4 against this Expo Go build).
**Reproduced on `main` with these changes stashed**, so it predates this work — but it means
the vector-city branch was not re-confirmed on a device either. Worth chasing before the
next on-device pass; a dev build would clear both this and the Mapbox gate at once.

---

## 13. Session log — Warm Japanese Editorial visual overhaul (2026-09-01)

### The ask

The user opened with a hard rule set, not a soft "make it prettier" brief:
"Not better pills — FEWER PILLS and a replaced visual grammar." The whole app
was to stop reading as one padded rounded rectangle after another and take on
the marketing site's editorial DNA (`site/globals.css`). Specific mandates that
shaped everything:

- **Pills only for compact metadata** (tags / status / match% / filters). Never
  pills for nav, primary/secondary actions, menus, settings rows, event
  containers, section headers, chat controls, profile sections, generic cards.
- **Primary CTA = substantial rectangular** with restrained radius
  (`JOIN MEETUP →`), not a capsule.
- **NAV = typography + active indicator** (coral line/weight/movement), not
  capsules.
- **Cards = hierarchy via composition** (thin rules, edge-to-edge, asymmetric,
  image-led, 1-2 rounded corners, or no container), not floating rounded rects.
- **Settings = whitespace + hairline rules**, not rounded cards.
- **Colour-blind-safe**: emoji/colour always pairs with text.
- Visual test the user described: hide colours/images/icons — geometry alone
  must carry hierarchy.

Also three explicit feature changes that rode along:
1. **Username removed** from the top of the Discover map.
2. **Discover nav** = top-left connections circle (SVG) + top-right profile
   avatar circle.
3. **One Profile page** (profile view + stats + settings index + app settings)
   replacing the old Settings screen.

### Palette decision (superseded an earlier critique)

The marketing site is the north star and its brand accent is `#FF432A`, so
**coral = `#FF432A`** (== existing `colors.primary`, unchanged). `neon` folds
**into** coral (one action register; the neon-lime as a general accent is gone)
and `neonText` → cream `#F7F4EE`. Sage `#719B86` is the secondary semantic.
Cream `#F7F4EE` content ground; warm-ink `#171717` night family. Food sticker
lime → warm amber `#D9A441`. No fake toggles on the Profile page — it shows only
real, functional settings (Language, Sign out, static About/Safety/privacy).

### What was built

| Area | Change |
|---|---|
| `theme/tokens.ts` | rebalanced: `primary` kept `#FF432A`; `neon`→`#FF432A`, `neonText`→`#F7F4EE` (lime gone as general accent); `accent`→sage `#719B86`; bg→cream; night→warm ink; food→warm amber; added `nightRaisedSoft` `#2C2925` for the completed-tile background |
| `components/ui/Icons.tsx` | **new** — stroke-based 24×24 `currentColor` SVG set: `IconConnections`, `IconProfile`, `IconGear`, `IconChevronRight`, `IconSparkle`, `IconMap`, `IconWarning`, `IconSend`, `IconWave` (all in one file, `react-native-svg` 15.15.4 already present) |
| `components/common/Button.tsx` | `base.borderRadius` `radius.pill`→`radius.xs` — all variants rectangular, no capsule anywhere |
| `components/events/EventCard.tsx` | floating rect (bg/radius/elevation/border) → rounded editorial tile: `nightRaised` bg, `radius.lg`, hairline border; score moved from a soft `accentSoft` pill to a coral numeric mark in the kicker row; trail `→` affordance |
| `screens/Discover/DiscoverScreen.tsx` | identity band → two `circleButton` anchors (connections SVG left, profile avatar right), username removed; feedback/location rows floating-rect → editorial transparent+hairline; `section` gap; `bandBottom` onLayout still anchors the filter rail |
| `screens/Settings/ProfileScreen.tsx` | **new** — editorial Profile page: night hero (avatar/kicker/handle/name), stats row (rep/connections/meetups), numbered interests index, mono group labels (APPS PREFS / ACCOUNT), language menu with coral check, sign-out, privacy note. Uses `useConnections` + `useMyEvents` |
| `app/navigation/{types,RootNavigator,linking}.tsx` | `Settings` route → `Profile`; old `SettingsScreen.tsx` deleted |
| `components/common/ScreenState.tsx` | ⏳ (loading, stays ActivityIndicator), ⚠️→`IconWarning`, 🗺️→`IconMap` |
| `components/feedback/FeedbackPanel.tsx`, `screens/Meetup/MeetupScreen.tsx` | 🎉→`IconSparkle` |
| `components/chat/ChatThread.tsx`, `screens/Onboarding/AIChatScreen.tsx` | 👋→`IconWave`, send ↑→`IconSend` |
| i18n `en/ja/zh` | added `profile.*` keys (title/heroKicker/statConnections/statMeetups/prefsGroup/accountGroup) |
| `docs/DESIGN.md` | new §1b "Visual World — Warm Japanese Editorial" codifying palette + component grammar |
| `docs/VISUAL_OVERHAUL.md` | **new** — checkpoint of the whole pass |

### User follow-ups (end of session)

1. **Discover tile contrast** — upcoming meetups slightly greyer
   (`EventCard` `nightRaised`), completed "leave feedback" tiles lighter
   (`FeedbackRow` `nightRaisedSoft`). Rediscovered both lists looked identical
   and had sharp (square) corners, so both became `radius.lg` rounded tiles with
   clearly different fills (`#1E1C1A` vs `#2C2925`), `section` gap restored so
   they read as separate cards, selected state = thicker coral border + lighter
   fill.
2. **LINE button lime green** on the login — `#06C755` style override (LINE's
   brand colour, matching the in-app `LineLogo`).

### Verified

- `npm run typecheck` clean on both packages after every batch.
- Emoji that *live as data marks* deliberately stay: category glyphs
  (🍜🎮🎨⛰), rating faces (😐🙂🔥), and the greet-emoji inside i18n copy
  strings. Only UI *chrome* was swapped to SVG.
- **Visual QA left to a human eye on the emulator** — the model cannot read
  screenshots (CLAUDE.md). The handle/empty/selection states were the final
  point to eyeball.

### Not touched (deliberate)

No backend/AI code changed in this session — those fixes (all-meh recap gate,
vibe recap, B1–B10) belong to §11 and the earlier sections. This is a purely
frontend presentation pass. Category `categoryMeta.ts` single-source stays the
glyph/colour authority; stickers keep their emoji as compact data marks.

## 14. Session log — recap prompt + onboarding prompt + AI hardening + E2E (2026-08-31)

Backend/AI pass (distinct from the visual overhaul in §13; git history hygiene
commit `aa7c849` + prompt work landed before the UI session). All folded into
`TRACKER.md §5`. The user's specific asks, captured here:

### Recap prompt — fixes "recap too vague"

`recapPrompt` is now `recapPrompt(language, event.category, summary)`
(`routes.ts:190`), so the **meetup category reaches Groq** — the one public,
non-member field a sparse recap can anchor on. Wording live-validated
(verdict: good):

- 3 traits → names them all: "people who love hiking, coffee, and ramen"
- 1 trait → category anchor: "people who love strategy at this board games meetup"
- 0 traits → category-alone (JA): "料理のミートアップで良い雰囲気でした…"
- Category detail surfaces exactly as requested (option 1).

Type change: `RecapPrompt` interface in `modules/recap/vibe.ts` — anonymous by
construction (no handle/id field can travel), so verification at the call site
is guaranteed, not remembered.

Route stores `vibeRecap()` output which is internally sanitized → OK. New recaps
get the concrete wording; already-cached recaps stay old (immutable by design).

**Open decision:** reword the deterministic `templateRecap` category-anchor fallback
the same way, or is the Groq path enough? (Groq runs first; `templateRecap` is only
the fallback when Groq fails/sanitizes to null.)

### Onboarding prompt

- Rich input draws more out of the user; "idk" → concrete Japanese draw-out;
  hostile redirect stays in character; still JSON-only.
- **Deployed `SYSTEM_PROMPT` matches `extractionSchema` (interests + personality, no
  `goals`).** The pasted reference had a `goals` field — the deployed one correctly
  omits it; no action needed. `groq/compound` tests pin the contract (§11).
- Verdict: clean.

### Code fixes

- **`sanitizeRecap` collapses Unicode NEL U+0085** (`vibe.ts:202`, regex now
  `[\s\u0085]+`). `\s` misses the NEL separator a model can emit around an em-dash —
  a latent line-break hole. Pinned by `vibe.test.ts`. (The earlier "newline in
  recap" was actually terminal text-wrapping of a wide CJK line — no real bug.)
- **`onboardingChat` returns graceful retry on Groq request failure**
  (`services/ai.ts:104-120`). The old JSON-mode guard only caught Groq returning
  *malformed* JSON (ai.ts:81-90), not *rejecting the request* (intermittent
  `invalid_request_error` / "Failed to generate JSON" in `json_object` mode) — that
  threw through the route to a 500. Root-cause single-point fix: wrap
  `create()` in the same try/catch that already guards `JSON.parse`, return
  `RETRY_REPLY` on throw. One guard in the shared function covers the route.
  Finding 1 resolved.

### E2E report — 44 checks, 43 PASS / 1 FAIL (live project, 2026-08-31)

Server :4000 (health ok, supabase:true groq:true oauth:line google), emulator :5554.

- PART A fresh user + onboarding AI + events: 21/21
- PART B post-meetup feedback + AI vibe recap: 5/5 (recap source=ai, real Groq)
- PART C group chat + connections/DMs + privacy gates: 12/12
- Finding 1 (the 1 FAIL): multi-turn onboarding chat → intermittent 500 (~3 of 4
  calls) — exactly the missing try/catch above. Fixed, retested 8/8 → 200 with real
  replies.
- Finding 2 (non-issue): no slash-commands in group chat — never specified, by design.
- Notables: two earlier "failures" were test bugs, not app bugs (pgvector string-vs-
  array; wrong harness field). Frontend wiring of every tested route verified.

## 15. Session log — onboarding personality + interests + meetup categories (2026-09-01, DONE)

### The ask

User wants to ask the user their personality during onboarding (bubbly, happy-go-lucky,
self-contained, etc.), under a handful of questions, to get a general personality +
interests picture for **better matching**.

Investigation showed personality is *already* extracted passively — the AI onboarding
host (`services/ai.ts` SYSTEM_PROMPT) guesses 2–4 `personality` tags from whatever the
user volunteers, and `complete()` embeds `[...interests, ...personality]` →
`preference_vector` → matching's 0.6 cosine term (`modules/matching/score.ts`). So the
data path exists; the gap is that nobody *asks*.

### Decisions (locked with the user)

1. **Keep the AI chat** as the intro/icebreaker (not removing Groq's onboarding job).
2. **Prompt the host to ask** the personality question (SYSTEM_PROMPT change), with
   concrete options, rather than guessing.
3. **Fixed localized vocabulary (en/ja/zh), multi-select** — not free AI-generated tags.
4. **Quick-reply chips inside the chat** — a tappable chip tray above the composer;
   tap-to-toggle, submit sends one localized user turn into the transcript, so the real
   AI and the demo both extract those traits.
5. **No matching/weighting/schema change** — tags still go into the same preference_vector.

### The plan

- `apps/mobile/src/onboardingPersonality.ts` — fixed localised vocab (~10 traits:
  bubbly, laid-back, self-contained, outgoing, curious, energetic, thoughtful,
  adventurous, creative, easygoing), labels = canonical keys.
- i18n `onboarding.personalityPrompt` + `onboarding.traits.*` (en/ja/zh).
- `AIChatScreen` — chip tray above composer, multi-select `Chip`s, one localized user
  turn `"I'm {selected}"`, selection clears on send.
- `services/ai.ts` SYSTEM_PROMPT — host asks "what's your vibe?" with the fixed options,
  normalizes to 2–4 short tags, keeps all hard boundaries (no name/contact/romance).
- Demo mirror: extend `PERSONALITY_VOCAB` in `demo/index.ts` with the new trait words so
  tapped chips extract correctly in demo mode (matches the real path). `world.ts` seeds
  unchanged.
- Server API shape unchanged (`{role, content}` free text). ProfileConfirm/Profile flows
  already render `personality` — untouched.

### Notes

- Server + mobile are separate packages (no shared code, CLAUDE.md), so the canonical
  trait keys are deliberately duplicated (prompt text + mobile chips), same as the
  built-in demo `PERSONALITY_VOCAB`.
- Micro-decision: tapped chips queue a selection; a submit on the tray sends **one**
  combined message ("I'm a, b, c") rather than one send per tap — clean single turn.
- Category emoji / colour-blind rules don't apply here (plain labelled chips).

### Follow-ups (this session)

1. **Tray is gated.** The chips are not always visible — the host's reply carries
   `showPersonality: true` while it poses the personality question, and the client shows
   the tray only on that signal (schema + prompt in `ai.ts`; demo mirrors the handshake).
   Send clears the tray state.
2. **Host asks language first.** The first turn now asks ja/en/zh and returns it as
   `language` in the JSON; the client applies it via `setLanguage`, flipping the whole app
   (and re-rendering the transcript). Demo turn 1 asks the same and echoes the current
   choice. This sets both the chat language and the app-language setting.
3. Verified: `npm run typecheck` (server + mobile) green; `npm test` 49/49.
4. **Gross roots.** Raised the interests ceiling 12 → 30 (`ai.ts`, `onboarding/routes.ts`,
   `users/routes.ts`) so the system accepts a much richer list, and widened the prompt to
   probe distinct activity categories (outdoor/food/creative/games/travel/social/wellness)
   across a 4-6 exchange chat, extracting 8-15 diverse interests. Demo mirror:
   `INTEREST_VOCAB` grew 10 → ~28 activity types (cooking, cycling, film, gym, yoga,
   swimming, camping, climbing, karaoke, izakaya, live shows, fish, pets, skiing, onsen,
   volunteer, gardening, travel, reading…), `FOLLOW_UPS` now probe 7 categories, and
   personality Q moved to turn 4 with extraction done at turn 9+. Live Groq run returned
   9 diverse interests (prev ~3-4). NOTE: model still self-limits chat length and its
   offered trait list can drift to a non-vocab word (e.g. "social") — extraction discards
   it, harmless.
5. **Meetup categories 4 → 9.** Added music, wellness, travel, learning, sports.
   `categoryMeta.ts` CATEGORY_ORDER/GLYPH + 5 WCAG-AA sticker `{bg,on}` pairs
   (`colors.sticker`), `discover.categories.*` labels en/ja/zh, demo world + server seed
   +5 events each. Categories are free-form text in the DB, so no migration. Sticker
   band on the product ≠ site palette. Verified: typecheck + 49/49.
6. **Hardware-backed device identity (2026-09-01, [~] code complete).** Android Keystore
   ECDSA P-256 non-exportable key (StrongBox requested, hardware-backed flag reported),
   proven once at sign-in: register SPKI → GET challenge (32-byte nonce, ~2-min TTL,
   single-use) → sign raw bytes in the Keystore → verify with `node:crypto` SHA256 in
   `modules/users/deviceIdentity.ts`. Migration `005_device_keys.sql` + schema mirror.
   Native module under `android/app/src/main/java/com/atsumaru/app/keystore/` registered
   in `MainApplication.kt`; gated TS wrapper `services/deviceIdentity/keystore.ts`
   (Expo Go-safe) + orchestrator `deviceIdentity.ts` (SecureStore per-install id,
   best-effort, never blocks sign-in); fire-and-forget after OAuth exchange + session
   restore; demo returns simulated `{verified:true}`. Verified: typecheck + 53/53.
   **Not verified:** keystore module at runtime (needs `expo run:android` dev build) and
   live DB row. Deliberate scope: verify-at-login only, no per-request signing, no
   biometric gate, no Play Integrity cert-chain check.

## 16. Session log — TEE decision → hardware-backed device identity (2026-09-01, code complete)

### The ask

User pasted a TEE analysis weighing **Android hardware-backed device identity** against
**AWS Nitro Enclaves** (server-side, `kms` + enclave image + attestation) and asked which
to build. Recap of the ranking that shaped the call: client-side Keystore is **high
value / low difficulty** (real, verifiable "same physical device" proof with a few
hundred lines); Nitro Enclaves is high value but **high setup cost** (enclave images,
attestation flow, at-rest footprint tied to AWS) — a poor fit for an appathon's current
threat model, and it only earns its keep once the server is the place you fear tampering.
Android Keystore goes first; Nitro Enclaves stays on the shelf.

### Decisions locked (with the user)

1. **Client key + minimal server counterpart** (not a client-only facade). The server
   must actually use the key: store the uploaded SPKI, issue a challenge, verify a
   signature — otherwise the key is theater. This is the full meaningful loop.
2. **Custom native Kotlin module**, hand-registered in `MainApplication.kt` under
   `android/app/src/main/java/com/atsumaru/app/keystore/` — not an Expo config-plugin
   module. Direct `AndroidKeyStore` access, StrongBox requested where the hardware
   exists, `isInsideSecureHardware()` reported to the API. Requires the `expo run:android`
   dev build (Expo Go cannot load custom native modules).
3. **Write the code now, build later.** No dev-build/emulator compile this session;
   correctness guarded by typecheck + unit tests; runtime verification deferred.

### Scope deliberately cut (ponytail flags, each with a named ceiling)

- **Verify at sign-in only** — proof of possession runs once per session, not per request.
  Per-request signing/attestation is the follow-up when a request's device binding
  actually matters (and would cost a Keystore op on every API call).
- **`setUserAuthenticationRequired(false)`** — no lock-screen/biometric gate on the key
  in the MVP; adding it is a `KeyGenParameterSpec` flag plus a re-verify-on-unlock flow,
  deferred.
- **No key-attestation cert-chain validation / Play Integrity** — the server stores the
  SPKI at first registration and verifies challenge signatures against it. That catches
  a lifted *SPKI* (the signature won't verify), but cannot catch a key pair generated on
  emulated hardware; a fixed attestation chain is the follow-up.
- **Key per device-install** — SecureStore UUID + Keystore alias `atsumaru.device_identity.v1`;
  not per-login or per-account.

### What was built

| Side | Piece |
|---|---|
| Native | `android/.../keystore/AtsumaruKeystoreModule.kt` (generate / getPublicKeySPKI / sign / isHardwareBacked / delete, ECDSA P-256, base64 in/out) + `AtsumaruKeystorePackage.kt`, registered in `MainApplication.kt` |
| Client wrapper | `services/deviceIdentity/keystore.ts` — gated deferred read of `NativeModules` (Expo Go safe; `null` = unavailable), same convention as `mapbox.ts`, `DEVICE_KEY_ALIAS` shared with the module |
| Client orchestrator | `services/deviceIdentity/deviceIdentity.ts` — per-install id in SecureStore (`getDeviceId`, cached for the interceptor), `registerDeviceIdentity()` = register SPKI → GET challenge → sign raw nonce bytes (hex→bytes→base64, matching the server's verify input) → POST verify. Best-effort: **never throws, never blocks sign-in**. `DEMO_MODE` short-circuits to `{ verified: true, hardwareBacked: false }`; `X-Device-Id` set by the `client.ts` interceptor once resolved |
| Wiring | Fire-and-forget `void registerDeviceIdentity()` after the OAuth exchange (`useOAuthLogin.ts`) and on session restore (`useSession.ts`) |
| Server | `migrations/005_device_keys.sql` + `schema.sql` mirror (`device_keys`, PK `(user_id, device_id)`, SPKI cert, `strongbox`, single pending `challenge_nonce` + expiry, RLS on); `registerDeviceKey`/`getDeviceKey`/`setDeviceChallenge`/`clearDeviceChallenge` in `queries.ts`; `POST /users/me/device`, `GET /users/me/device/challenge` (32-byte nonce, ~2 min TTL, single-use), `POST /users/me/device/verify` (SHA256 over the stored SPKI via pure `modules/users/deviceIdentity.ts`) |
| Test | `modules/users/deviceIdentity.test.ts` — SPKI round-trip, wrong-challenge rejection, random-signature rejection, malformed-input-no-throw (53/53 total) |

### Verified (the "test everything" pass, 2026-09-01)

- `npm run typecheck` — **clean, server + mobile** (after the two narrowing fixes).
- `npm test` — **53/53** (incl. the 4 new device tests; prior floor was 49/49).
- `site` — `next build` clean (also type-checks the site), `next lint` 0 errors,
  20 pre-existing warnings (`<img>` intentional per CLAUDE.md; no NEW warnings).
- Groq live re-run after the interest/vocab/prompt changes — extraction + retry floor
  green (see §15).
- Demo mode + Mapbox remain unexercised end-to-end (demo needs an emulator; Mapbox
  needs a token + dev build — both documented, not regressions).

### Not verified — and why

- **The Kotlin module has never run.** It compiles in the sense that the bundle builds,
  but the native code is only exercised by a `expo run:android` dev build. First run
  should check: `generate` signs without a lock-screen, `getPublicKeySPKI` round-trips
  through `createPublicKey`, `isHardwareBacked` returns true on a real secure-element
  device, and Expo Go stays on the vector city as if no native module existed.
- **Migration applied to the live project 2026-09-02.** `005_device_keys.sql` ran via
  `scripts/sql.mjs`; `select count(*) from device_keys` → 0 (no rows yet — expected before
  any device registers). Remaining: one real register+verify round-trip (needs a dev build,
  or a manual register against a seed-minted session) to land a row.

---

## 17. Session log - security hardening vs ATSUMARU_SECURITY_COMPLETE.md (2026-09-02)

### The ask

Audit the whole app against the 84-section security engineering standard the user supplied
(`ATSUMARU_SECURITY_COMPLETE.md`, Downloads), flag genuine gaps vs. product tradeoffs, and
close what is cheap.

### What the audit found (evidence, not vibes)

- **Posture was already strong** where it matters: `requireAuth` on every protected route;
  `requireMembership`/`requireConnection` on chat/DM/feedback/recap (REST + socket);
  `host_id: req.userId!` on create-event (no mass assignment); `real_name` never leaves
  (`PUBLIC_USER_COLUMNS`/`CONNECTION_COLUMNS`); RLS **on with zero policies** = deny-all;
  service-role key server-side only, gitignored, absent from `git ls-files`; OAuth =
  HMAC-signed state (TTL) + PKCE claimed-once + 60s single-use handoff codes; `authDb()`
  throwaway client avoids the session-demotion trap; AI gated to Groq×2 + HF×1 and **no AI
  in chat**; `sanitizeRecap` rejects model-invented handles. No `SELECT *`, no raw SQL with
  user input.
- **Real gaps:**
  1. **§19.1 "Very strict" auth rate limits missing.** `/auth/login`-path (`/auth/:provider`),
     `/auth/callback`, and `/auth/session` had none — the handoff-code exchange is an
     unauthenticated brute-force surface for the 60s single-use session codes.
  2. **§19.1 feedback submission unrated.** It re-runs connection-unlock processing and
     drives reputation on every call.
  3. **§61.4/§62/§75 — zero negative/authorization tests.** All 11 test files were pure unit
     (score, vector, oauth, session, deviceIdentity, rateLimit, request, sweep). The DoD
     explicitly requires negative tests.
  4. Product tradeoffs (not bugs): non-member can read any event's member list (discovery
     needs it), handle/profile reveal account existence. Both recorded in SECURITY_AUDIT.md.
  5. Dead, not dangerous: `SUPABASE_URL`/`SUPABASE_ANON_KEY` exported in mobile `env.ts`,
     never imported (anon is public anyway).

### What was changed

- `modules/auth/routes.ts` — IP-keyed `AUTH_RATE_LIMITS`: session 20/min (tightest),
  callback 30/min, provider 30/min; `enforceLimit` → 429 + `Retry-After`. Per-IP is a
  known ceiling (§19.2 warns mobiles share networks); the fix is a shared Redis limiter —
  ponytail flag: single-instance scope is fine for one API process.
- `modules/feedback/routes.ts` — `feedbackLimiter` 10/hr keyed by **user** (authenticated),
  sitting after `requireMembership`.
- `db/queries.ts` — extracted `canAccessConnection` (mutual AND participant) as a pure
  predicate now shared by `requireConnection` and socket `dm:join`/`dm:message`; unchanged
  behavior, testable.
- New tests: `db/authorization.test.ts` (4 negative cases), `modules/auth/authRateLimit.test.ts`
  (2: budget ordering + actual blocking). `npm test` 53 → 59.
- `docs/SECURITY_AUDIT.md` written; TRACKER §5c + Known-gaps rows added.

### Blocked / deferred

- Route-level `User A cannot X` tests need a `db()` injection seam. `node:test` `mock.module`
  is **unavailable** on the installed Node 25.5 (`no mock`). Next step is an
  injectable db handle in `db/queries.ts`, not fighting the loader.
- Authentication-matrix items (missing/malformed/expired token → 401) are code-correct but
  not automated; same for RLS User A/B (needs live Supabase + seed).
- The §22 sweep atomicity fix (stamp after side effect) is still open and must land before
  `REDIS_URL`.
- Route-level tests blocked; see TRACKER §5c "Open".

### Deep pass (line-by-line) — new findings and fixes (2026-09-02, second round)

Re-read the full server line-by-line (auth/oauth/session, all route modules, socket, AI,
matching, `db/queries.ts`, `schema.sql` + all migrations, mobile service layer). The
architecture claims all held (RPCs parameterized → no SQL injection; `security_invoker` +
pinned `search_path` in migration 001; RLS deny-all; `real_name` never leaves; AI untrusted
input gated through zod `safeParse` + `sanitizeRecap`). Six additional findings were cheap
and standards-mapped, so they were closed:

- **Rate-limit keying was spoofable.** `clientIp` trusted `X-Forwarded-For` blindly, so any
  attacker could rotate the header to reset budgets or pin a victim's. `config/env.ts` now
  has `TRUST_PROXY` (default off); `clientIp` only honours the header behind a proxy.
- **Limiter map never pruned in production** — `prune()` existed but no timer called it, so a
  rotating-IP attacker grows memory without bound. `utils/rateLimit.ts` now `setInterval`s an
  unref'd prune per limiter on its own window.
- **`AUTH_STATE_SECRET` had a hardcoded dev default and prod only warned.** Now fails to boot
  in production with the dev default (§5.4/§41). **Deployment note: set a real secret.**
- **`/health` leaked integration + OAuth config booleans** to anyone. Now liveness-only (§20).
- **Malformed JSON answered 500** — the body-parser `entity.parse.failed` SyntaxError fell
  through to `INTERNAL_ERROR`. `errorHandler` now maps it to 400 `INVALID_JSON` (§43/§62).
- **No send/creation limits on group chat, DM, or event creation.** Added per-user budgets on
  both REST and the socket path: chat 300/hr, DM 120/hr, event-create 30/day (§19.1).

New tests: `middleware/errorHandler.test.ts` (3) + auth `TRUST_PROXY`/limiter-spacing (2).
`npm test` 59 → 64; `npm run typecheck` clean.

### Third pass — rate limiting everywhere, usage quotas, throttling, CAPTCHA (2026-09-02)

User asked for five: rate limiting, usage quotas, request throttling, CAPTCHA, cost controls.
Scoped via questions: read-side rate limits (all reads), quotas core + persisted, Turnstile on
auth, cost-controls **skipped** (user decision — rate limits + quotas already cap Groq/HF).

- **Read throttling everywhere** (`utils/readLimit.ts`): one shared per-user read budget
  (240/min, `READ_RATE_LIMIT`) applied to every discovery/profiling GET — events
  nearby/mine/:id/members/match-preview, connections + history, chat + DM history,
  `/users/:id`, onboarding handle probes, recap. Auth `/me`, `users/me`, device-challenge are
  self-reads/handshakes, left unthrottled (legit high poll).
- **Persisted usage quotas** (migration `006_usage_quotas.sql` + `utils/quota.ts`): table
  `usage_quotas(user_id, resource, day, usage)` + atomic `bump_quota` RPC (increment-if-under,
  refuse-without-increment over cap, resets daily). Wired: events-created 30/day
  (`enforceQuota` → 429), feedback-submitted 200/day (429), groq-turns 500/day (429 on
  onboarding chat; recap uses `tryQuota` and **fails open to its template** so a passive card is
  never 429'd). `tryQuota` also fails open on RPC error (in-process limiter is still a layer).
  **Needs applying to the live project + `notify pgrst,'reload schema'`.**
- **Turnstile auth gate** (`modules/auth/turnstile.ts`, `config/env.ts`): `TURNSTILE_SITE_KEY` /
  `TURNSTILE_SECRET_KEY`, `hasTurnstile`. When configured, `POST /auth/session` requires a
  valid widget token (`server-side siteverify`, `CAPTCHA_FAILED` 403); off by default (no keys
  → no challenge, matches has* degrade). gated exactly like Mapbox/Keystore on mobile
  (`services/auth/turnstile.ts` — returns undefined until site key + `react-native-webview` +
  dev build); wired into `useOAuthLogin`.
- Tests: `modules/auth/turnstile.test.ts` (degrade pass when unconfigured). `npm test` 64 → 65;
  `npm run typecheck` clean (server + mobile).

### Email/password auth (docs/TRD.md §17 — DONE server + client)

- **Server** (`modules/auth/email.ts`, `routes.ts`): `passwordSchema` (min 8 + upper/lower/digit)
  + `emailSchema`. `signUp` → confirmation email, **no tokens** (confirm-then-login), 409
  `EMAIL_TAKEN`; `logIn` → single-use handoff `{ code }` redeemed via the shared
  `POST /auth/session`; `requestPasswordReset` anti-enumeration (always `{sent:true}`);
  `completePasswordReset` verifies recovery token + sets password on **one throwaway `authDb()`
  client** (fixed the two-client verifyOtp/updateUser bug).
- **Turnstile fail-closed on email surfaces**: `signUp`/`requestPasswordReset` → 503
  `CAPTCHA_REQUIRED` when no `TURNSTILE_SECRET_KEY` (direct-hit surfaces don't default open;
  `/auth/session` still *skips* when unconfigured).
- **Limiters**: signup 10/hr, login 20/min, reset 10/hr, reset-complete 10/min; routes before
  the `/:provider` catch-all.
- **Client**: `authApi` `signup/login/requestPasswordReset/completePasswordReset`; `useEmailAuth`
  hook (login redeems code → store `signIn`); `EmailAuthScreen` (login/signup/reset modes,
  theme tokens); `AuthStack` + "Continue with email" on `LoginScreen`; i18n en/ja/zh.
- Tests: `email.test.ts` (password/email schema, pure only — live Supabase keys block unit
  testing real flows). `npm test` 65 → 68; `npm run typecheck` clean (server + mobile).
- **Open**: `atsumaru://auth?action=recovery` deep-link → reset-complete UI is unexercised (same
  dev-build linking as OAuth; the hook + API exist). Confirm/SMTP/redirect must be set in the
  Supabase dashboard (see `server/.env.example` appendix). Migration 006 still needs applying to
  the live project.




