# context.md — working context for the Atsumaru backend wiring

> Purpose: a durable record of *why* this work is happening and *what* was decided, so a
> fresh session (or a context reset mid-task) can resume without re-deriving anything.
> `CLAUDE.md` = how to work in this repo. `TRACKER.md` = what is built. **This file = the
> live state of the current task.**
>
> Started 2026-08-30. Update the Change Log section as work lands.
>
> The previous task (the mobile rewire, D1–D13) is finished and recorded in
> `TRACKER.md` §2–3; its detail is in git history up to `d50d19e`. This file has been
> replaced with the task now in flight.

---

## 1. The ask

Stand the backend up against a real Supabase project, fix whatever that exposes, get all
three dev servers running, and push the work to `feat-backend-app` without opening a PR.
Then keep the free-tier project from pausing.

`TRACKER.md` §1 opened with "blocks everything else", and it was right: the API was
code-complete, unit-tested, and had never once spoken to a database.

## 2. Environment (verified, not assumed)

| Fact | Value |
|---|---|
| Repo root | `C:\Users\saksh\Documents\Japan\Atsumaru` |
| Branch | `feat-backend-app`, cut from `main` at `d50d19e` |
| Node / npm | v22.14.0 / 11.7.0 |
| Supabase project | `ucxgvtcqoeazuhsgwbhf`, `ap-northeast-1` (Tokyo), ACTIVE_HEALTHY |
| Postgres access | Management API via `scripts/sql.mjs`; `current_user` = `postgres` |
| `psql` | present but unused — `C:\Program Files\PostgreSQL\18\bin\psql.exe` (not on PATH) |
| DB password | never set or retrieved; the Management API covers DDL without it |
| Extensions | `postgis` 3.3.7, `vector` 0.8.2 — installed into `extensions`, not `public` |
| `server/.env` | **created by this task** (gitignored) |
| `apps/mobile/.env` | **created by this task**, `EXPO_PUBLIC_DEMO_MODE=0` |
| Credentials | Supabase (URL + anon + service-role + `sbp_` management), HuggingFace, Groq, GitHub `ghp_` — all in `access_token.txt` (gitignored) |
| Deps | all three packages installed (`server`, `apps/mobile`, `site`) |
| Redis | intentionally absent — the in-process timer is the driver under test (see §4) |
| OAuth | no LINE or Google credentials; `seed --tokens` mints real sessions instead |

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

**OAuth stays deferred.** `seed --tokens` mints genuine Supabase sessions through the
admin API, so every authenticated route was verified without a provider. Only the
provider redirect and the `atsumaru://auth` handoff remain unexercised.

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
| API `:4000` | `{"status":"ok","supabase":true,"groq":true,"oauth":{"line":false,"google":false}}` |
| Metro `:8081` | HTTP 200, bundles the app against the real API |
| Site `:3000` | HTTP 200 |
| Keepalive workflow | ran the workflow's exact shell body locally against the live project — `ping_count` incremented, exit 0; anon can call the function but **cannot read the table** (401) |

**Known limitations.** Push has never actually delivered: Expo Go dropped Android remote
push and `app.json` has no `extra.eas.projectId`, so no token can be minted — the sweep's
reminder branch is verified only as far as `pushTargets` returning zero devices. The
mobile loop has been walked on-device in *demo* mode only; the app bundles against the
real API but has not been driven through it on an emulator. OAuth remains unexercised.

**Housekeeping.** The `sbp_` management token is account-wide across 9 projects and the
`ghp_` token carries `admin:enterprise` and `delete:packages` for what only needed
`Contents:write`; both, plus the service-role key, passed through a chat transcript and
should be rotated. The commit diff was scanned for all four token prefixes (0 matches),
and the push URL credential was stripped from `.git/config` afterwards.
