# Atsumaru — work tracker

Status of the build against `docs/`. Updated 2026-09-03.

Legend: `[x]` done and verified · `[~]` code complete, not verified against a live
Supabase project · `[ ]` not started.

Verification baseline right now: `npm run typecheck` clean (both packages),
`npm test` 87/88 passing (1 skip: Turnstile unconfigured degrade path, configured in
env), and **the backend proven against a live Supabase project**
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

- [x] `0.6*fit + 0.2*group_balance + 0.2*normalized_reputation`, backend-authoritative —
      `fit` is the **pairwise** mean cosine against each current member (an outlier
      member scores honestly lower than the old centroid did), with a set-overlap
      tag fallback when either side has no preference vector (cold-start users are
      no longer hard-capped at 0.40)
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

- [~] `runSweep()`: remind ~15 min before start, close finished meetups, send feedback reminders ~1h after start, settle reputation once, re-engage dormant members
- [x] BullMQ + ioredis when `REDIS_URL` is set, in-process timer otherwise, clean fallback when Redis is down
- [~] Expo push delivery: chunked sends, stale-token cleanup, localized copy, deep-link payload
- [~] `POST /users/me/push-token` device registration
- [~] Five notification types behind one `notify()` gate — per-type opt-out, JST quiet hours, persisted daily caps (§1g)

### Demo data

- [~] `npm run seed` — 6 users, 4 Shibuya meetups (2/6, 5/6, live, finished), chat history
- [~] `--tokens` prints access tokens; `--reset` removes only demo rows
- [~] Finished meetup pre-seeded so `@trailbrew` unlocks a mutual connection on first submit

## To do

### 5h. Manual security review, 2026-09-04 — white-box audit, no critical/high findings

Free manual review of `server/src` + live API (`https://atsumaru-6i3n.onrender.com/api`).
Strix agentic scanning was attempted but cannot run free: OSS CLI needs a paid LLM key
(Groq free = 8k TPM < request size; Gemini free = 20 req/day, no tool-calling), and Strix
Cloud is signed-in but credits cost $1 each (a source code_review starts at ~$60). User
chose the manual path. Result: **no critical or high severity** issues. The backend is
already hardened (rhymes with `fix-backend-hardening` in §1f). Full scope in
`docs/ATSUMARU_SECURITY_COMPLETE.md` §1–22 terms.

What held up (verified in code + live):
- **AuthN/AuthZ.** `requireAuth` verifies the Supabase token server-side
  (`auth.getUser`) and asserts `isUuid(user.id)` before any route uses it — which also
  renders the one interpolated PostgREST `.or()` in `connections/routes.ts:46`
  injection-proof. Socket handshake runs the same check (`verifySocketToken`).
- **IDOR/BOLA.** Every object-scoped read/write gates on the caller's own id:
  `requireMembership` (group chat, feedback, recap), `requireConnection` (mutual +
  participant-only DMs), everything else scoped `.eq("id", req.userId!)`. All `:id`
  params via `uuidParam` → 400 before hitting the DB.
- **Mass assignment.** `PATCH /users/me` (patchSchema) and onboarding `completeSchema`
  are explicit zod whitelists — no `reputation_score`/`role`/`preference_vector` in the
  request path; the vector is recomputed server-side.
- **Injection.** Zero dynamic SQL besides the two compile-safe interpolations
  (`PUBLIC_USER_COLUMNS` constant; uuid-guarded `.or`). All functions in
  `schema.sql` are parameterised, `search_path` pinned (blocks schema-shadowing),
  RLS on for every table, `event_sizes` view `security_invoker=true`, service-role key
  (RLS-bypassing) but every access re-gated in route code.
- **Sensitive data.** `PUBLIC_USER_COLUMNS` never contains `real_name`/email; `dbError`
  logs Postgres text but returns a generic 500; error envelope/server errors leak no
  body. OAuth response bodies (can echo codes) are never surfaced. No sensitive
  `console.*` logging found.
- **Auth flows.** HMAC-SHA256-signed OAuth `state` + httpOnly SameSite=Lax binding
  cookie (login CSRF), PKCE, nonce, timing-safe compares, single-use handoff codes
  (60 s TTL) + single-use PKCE verifier. LINE id_token verified via LINE's `/verify`.
  Email/password: password policy, fail-closed Turnstile on signup/reset, anti-
  enumeration login/reset, throwaway `authDb()` client avoids session-poisoning the
  singleton.
- **Rate/abuse.** Per-IP auth limits (session redeem very strict 20/min + Turnstile),
  per-user send/read limits, persisted atomic daily quotas via `bump_quota` RPC.
- **Secrets.** No hardcoded keys; `.git` tracks only blank `.env.example`. Root
  `.gitignore:5` `.env`/`.env.*` covers `apps/mobile/.env` (the mobile `.gitignore`
  gap is harmless).
- **Live smoke (black-box):** `/api/users/me` and `/api/events/nearby` → 401
  unauthenticated; unknown route → 404 envelope; `/health` → `{"success":true,...}`
  with no provider/config disclosure.

Low / informational (no fix, tracked for awareness):
- **`GET /events/:id/match-preview` has no `requireMembership` gate** — any authenticated
  user can compute their own fit against any event's full member set (members'
  `preference_vector` used internally, never serialized; only the caller's own scalar
  score + public-tag reasons are returned). Consistent with public event browsing; not a
  leak. If group privacy is ever wanted, gate it like feedback/recap.
- **Feedback submit is a TOCTOU** — `firstSubmission` is `count === 0` then upsert +
  reputation bump with no transaction, so two concurrent submissions could each double-
  apply the reputation delta and the vector update. Bounded to 0–100 reputation, no
  privilege escalation; low. A unique partial index / advisory lock on
  `(event_id, from_user)` would close it.
- **Socket `typing` is un-throttled** (unlike `group:message`/`dm:message`) — a member
  can spam typing to a room they're in. Membership-bounded; low.
- **`strongbox` is a client-supplied boolean** and Play Integrity attestation is
  deliberately out of scope — the flag is metadata, not a control; the actual proof is
  the Keystore signature over the nonce.

`npm run typecheck` clean, `npm test` green, live guards verified. No code changed.

### 5i. Release APK + live heavy attack, 2026-09-04 — one finding (Turnstile disabled in prod)

Continued the security work onto the built release APK
(`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`, v1.0.0) on a Genymotion
emulator and against the live Render API.

**Release-APK forensics — clean.** Extracted `assets/index.android.bundle` from the APK and
grep'd for hardcoded secrets:
- Only two URLs: `https://atsumaru-6i3n.onrender.com/api` (the API) and an `rnmapbox` docs
  link (dead code).
- One `pk.` **public** Mapbox token (user `yashchoudharyog`, scoped to a mapbox project id) —
  public by Mapbox's design, unsafe only if it were `sk.`. **No `sk.` token present.**
- **Zero** Supabase anon/service JWTs, Groq/HuggingFace keys, OAuth client ids /
  channel secrets. Matches the server-side-secrets-only design. Release build leaks nothing.

**Live finding (Medium) — Turnstile human-verification gate is disabled in production.**
Probed the live API (`atsumaru-6i3n.onrender.com`):
- `POST /api/auth/session` with a fabricated `turnstile_token` + invalid code →
  `400 INVALID_CODE` ("That sign-in code is no longer valid.") — **not** `403 CAPTCHA_FAILED`,
  so `verifyTurnstile` returned `true` on a bogus token.
- `POST /api/auth/password/reset` with a bogus token + nonexistent email →
  `200 {sent:true}` (generic anti-enumeration) — **not** `CAPTCHA_FAILED`.
- `POST /api/auth/signup` with a bogus token → got **past** the gate to the *email-format*
  zod validation (`INVALID_BODY` "Enter a valid email address") — **not** `CAPTCHA_FAILED`.

`verifyTurnstile` (`modules/auth/turnstile.ts`) returns `true` either when `hasTurnstile` is
false (no `TURNSTILE_SECRET_KEY`) or when `TURNSTILE_ALWAYS_PASS === true`. On the deployed
instance one of those holds, so the CAPTCHA on session-mint / signup / reset is **not
enforced in production** — a test/degradation flag shipped to prod. Enables email-storm /
mass-signup abuse and weakens brute-force defence, and for this app specifically it defeats
the fail-closed bot gate that `email.ts` and the handoff route are built around.

**Mitigation (deploy-side, not code):** confirm `TURNSTILE_ALWAYS_PASS` is `false`/unset and
`TURNSTILE_SECRET_KEY` is set on Render, then re-probe — the three requests above should
return `CAPTCHA_FAILED`. The code is correct; the deployment carried the bypass. Honest
severity: Medium — the per-IP auth rate limiters still apply (login/session/reset/signup
are IP-limited and Turnstile-gated in depth), so this lowers rather than removes the
brute-force barrier, but a control explicitly built to fail closed is failing open here.

**RESOLVED — verified fixed live 2026-09-04.** Owner set `TURNSTILE_SITE_KEY` +
`TURNSTILE_SECRET_KEY` on Render and removed `TURNSTILE_ALWAYS_PASS`, then redeployed
(Render does **not** auto-redeploy on a dashboard env edit — the first re-probe still saw the
old process config until a manual deploy/restart). Re-probed all three endpoints with a bogus
token: `signup`, `password/reset`, and `session` each now return
`403 CAPTCHA_FAILED "Human verification failed."` — the gate fails closed as designed
(`env.ts:93` `hasTurnstile`, `turnstile.ts:19/24/26-41`). Device UI down-stream also shows the
Turnstile widget rejecting.

Also re-verified the 💯 items still hold live: release app boots to the real auth screen and
talks to the live API; unprotected routes 401; unknown routes 404 envelope. No code changed.

### 5j. Drove the app end-to-end on the emulator + live API battery, 2026-09-04 — two findings

Continued §5i onto the **running release app**: drove `com.atsumaru.app` v1.0.0 on the Genymotion
emulator through the whole product via `adb input`, and ran the authenticated API attack battery
with a freshly minted session against the live Render API. **The app does not crash anywhere.**

**App drive (all real UI, on-device):**
- **Login** with the confirmed `campus.crusaders.auh@gmail.com` account (driven by `adb input text`).
- **Onboarding complete** — AI chat (Groq live), vibe chips, handle `hiker`, display `Hikaru`,
  "Find my people", the runtime notification-permission dialog, then **DISCOVER**. Profile saved:
  `handle=hiker`, `display_name=Hikaru`, interests/personality persisted, `is_new` flipped false.
  (An earlier "landed on launcher" scare was a mis-tap hitting the Android nav bar, not a crash —
  process stayed alive throughout; corrected, not a finding.)
- **Discover / Mapbox surface** — release build loads the real Mapbox renderer ("Powered by Mapbox
  Maps" present), shows seeded meetup cards at their map pins with match % (42%) group fit.
- **match-preview** opens for a meetup.
- **Join group** — "Nigga's Hideout" via `join_event`; now 2/6, "You are already in this group",
  members `@drivinggaming` + `@hiker`. GROUP CHAT section renders.
- **Connections tab** — empty state "No connections yet. They unlock after a meetup." (correct
  pre-meetup gating for the mutual 1:1 unlock).

**Finding (Moderate) — `match-preview` has no membership gate, confirmed live.**
`GET /events/{id}/match-preview` (`events/routes.ts:299`) runs a non-member call to `200` and
returns the caller's **match score against a group they are not in** plus shared-interest reasons
("Shared interests: hiking, photography, board games", "3/6 spots taken"). It never names a member,
but it computes and leaks a group-fit signal about a private group the caller cannot see, built from
that group's member vectors. White-box identified in §5h; this run promoted it to Moderate because
the exposure is now proven reachable live by an unrelated account. Fix: add
`await requireMembership(id, userId)` before computing — one line, matches every other per-event
sub-resource (feedback, chat, recap all gate).

**Finding (Low / UI bug) — group-chat composer is behind the Android nav bar (edge-to-edge insets
unhandled).** On the release build the chat `EditText` (bounds y 1177–1230) and the **Send** button
(y 1191–1226) render in the system-nav-bar region of a 570×1230 screen; tapping them dispatches
Android Home and the app backgrounds instead of focusing input / sending. The primary chat action is
effectively unreachable through the UI on this build. The REST chat path works fine (below), so this
is an inset/insets-bug, not a backend gap. Fix on the mobile side: consume `SafeAreaInsets` bottom
(and the IME) for the chat screen composer.

**Live API battery — everything else held:**
- **Turnstile re-confirmed bypassed on a real auth** (same Medium as §5i): a fabricated
  `turnstile_token` on `/auth/session` minted a **valid session** (no `CAPTCHA_FAILED`).
- `PATCH /users/me` **mass-assignment probe**: editable `language` / `interests` / `display_name`
  write through; **`reputation_score:9999` was ignored** (stayed 50) — protected fields are
  server-authoritative. Not a vuln. (Test mutation was reverted to the original profile.)
- `POST /:id/feedback` + `GET /:id/feedback-form` on a non-member meetup → `NOT_A_MEMBER`
  (membership gate + per-user limiter + persisted quota + post-meetup status gate all present).
- `POST/GET /:id/messages` — **member send works** (message persisted, `{messages,page,limit,total}`
  returned); **non-member POST and GET → `NOT_A_MEMBER`** (no chat IDOR).
- `GET /users/{id}` for an arbitrary user returns only public columns (handle / display_name /
  interests / personality / reputation_score) — **no `real_name`, no email** (`PUBLIC_USER_COLUMNS`
  held). Intended social read, not a leak.

**Seed-data note (not a security defect):** the seeded demo events/accounts use the display name
"Nigga" ("Nigga's Hideout", "Official nigga"). It is live test data the project owner created
(visible in this user's own join flow), not a PII breach, but brand-reputational for any public
demo. Recommend renaming the seed rows before any showcase.

No code was changed in this pass; all live scratch state (profile mutation, chat message) was left
as ordinary test data under the test account.

**Feedback / mutual-unlock path — every reachable gate verified; the genuine unlock is not
reachable without DB-admin write access, and that is by design.**
- Member `GET /:id/feedback-form` on an open meetup → `200`, lists only the *other* member (caller
  excluded — the §8 privacy rule).
- Member `POST /:id/feedback` on an open (not yet completed) meetup → `409 MEETUP_NOT_FINISHED`
  (the status gate holds for a legitimate member, not just a non-member).
- `createSchema` (`events/routes.ts:44-49`) **rejects any past `start_time`** ("start_time must be
  in the future") — so a past-dated meetup cannot be created via the API to farm an unlock or skip
  the meetup. Deliberate hardening, verified in source.
- The genuine two-way **mutual unlock** (two reciprocal `connect_with` picks on a *completed*
  meetup → a `connections` row is created and `match:unlocked` fires) could not be driven without a
  second authenticated picker and a completed meetup I'm a member of. Reaching it would require
  either a second account or direct DB writes (no `access_token.txt` / Supabase admin creds
  available in this environment, and injecting state into the shared live project is out of scope).
  This is a data-availability limit, not an open surface — the write gate, form privacy, and the
  status gate are all confirmed to hold.

### 5k. Turnstile client widget implemented — phone login unblocked (2026-09-04)

Flipping the server gate to strict (§5i resolved) exposed a latent gap: **the mobile client never
minted a Turnstile token** — `acquireTurnstileToken()` was a stub that always returned
`undefined` (`turnstile.ts:37`), so every real login after the server went strict failed with
`CAPTCHA_FAILED` (the phone showed "human verification failed"). Fixed by implementing the client
widget so real users pass the gate.

- **`react-native-webview` 13.16.1** added (`expo install`). Native module — only the dev build /
  release APK can run it; Expo Go renders nothing (same deferred-require convention as
  `mapbox.ts`/`keystore.ts`).
- **`services/auth/TurnstileWidget.tsx`** — invisible, managed Turnstile widget inside an off-screen
  WebView (`size: "invisible"`). Loads Cloudflare's `api.js` with the site key, auto-executes on
  load and after each consume, forwards each `turnstile-callback` token to the token slot. Invisible
  mode auto-solves low-risk sessions with no visible puzzle; challenged sessions get Cloudflare's
  interstitial. Zero-size, `pointerEvents="none"`.
- **`services/auth/turnstileToken.ts`** — the shared slot. Widget writes, `takeTurnstileToken()`
  reads (consuming clears it, single-use) and waits up to 5s for the first mint. Also nudges the
  widget to re-execute for the next attempt via `setTurnstileTokenHandler`.
- **`services/auth/turnstile.ts`** — `acquireTurnstileToken()` now returns the slot's token
  (awaits it) instead of `undefined`. API unchanged, so the two auth hooks needed no logic change.
- **Mounted on `LoginScreen`** (pre-mints for the OAuth `/auth/session` handoff) **and
  `EmailAuthScreen`** (login/signup/reset).

Verified: `npm run typecheck` (server + mobile) clean. Real-device proof still required — a rebuild
(`expo run:android` or a fresh `app-release.apk`) + a real login on the phone to confirm the token
passes `siteverify` and the session mints. Follow-up: confirm the site key (len 24) belongs to the
same widget/site as the server `TURNSTILE_SECRET_KEY`.

### 5l. Turnstile scoped to email auth only — OAuth passes through (2026-09-04)

First real-device test of §5k exposed the design flaw: the OAuth deep-link handoff needed a
widget-minted token on `POST /auth/session`, but the widget's WebView is backgrounded (and often
paused/torn down) for the whole provider round trip, and Cloudflare is hostile to WebViews
(no DOM storage by default, `X-Requested-With` detection). Login dead-ended on the strict gate.

**Decision (user-driven): Turnstile stays on the email surfaces only; Google/LINE pass through.**
The OAuth code is already human-gated upstream — provider round trip + PKCE verifier + signed
state + binding cookie — and the redeem keeps its per-IP 20/min limiter. The direct-hit surfaces
CAPTCHA exists for (email signup, password reset, email-login redeem) keep the fail-closed gate.

- `server/.../session.ts` — handoff stash now carries an `origin` (`"oauth" | "email"`);
  `claimSession` returns `{ origin, session }`.
- `server/.../routes.ts` — `/auth/session` applies the Turnstile gate only when
  `handoff.origin === "email"`; OAuth codes redeem without a token. `/auth/callback` stashes
  `"oauth"`, `email.ts logIn` stashes `"email"`.
- `apps/mobile` — `LoginScreen` no longer mounts the widget; `useOAuthLogin` sends no token.
  `EmailAuthScreen` keeps it.
- `TurnstileWidget.tsx` hardened for the email flows: `domStorageEnabled` (Cloudflare requires
  DOM storage; react-native-webview defaults it **off** on Android — without it no token is ever
  minted), bounded retry so the first `execute` can't lose the race against `api.js`, and a
  re-execute on `AppState` active so a backgrounded app mints a fresh token.
- Docs: `API_STRUCTURE.md` §3.1 + `SECURITY_AUDIT.md` §22 rows updated to the email-only scope.

Tests: session round-trip now pins `origin` (oauth default, email explicit); typecheck clean.

### 5m. Venue search scoped to the member's own area (2026-09-04)

Create-event's place search (Mapbox Search Box, `services/places.ts`) was hardcoded to
`country=jp` and `near` was never wired in, so for a member outside Japan the picker
searched Japan-wide and returned "no place found" even though the map showed their real
fix. Two changes:
- `places.ts` — when a real fix exists, send `proximity` + `radius` (1° ≈ 111 km,
  district/province scale) around it and drop the `country` filter; the Japan filter is
  now only the no-fix baseline.
- The member's one-shot Discover fix is shared via a new `useLocationStore`
  (`store/index.ts`); `DiscoverScreen` mirrors `coords` into it when `hasRealFix`
  (never the Shibuya fallback), and `CreateEventScreen` passes it as `near` to
  `VenuePicker`. No new location read anywhere — same single fix, reused.

Mobile typecheck clean; no server change.

### 5n. Widget page served by the API — Cloudflare hostname gate (2026-09-04)

Email login still failed after the §5k/5l fixes + real keys: the widget's HTML was injected
inline into the WebView, so the page's origin was `about:blank` — and Cloudflare hostname-checks
the page that renders the widget against the widget's dashboard hostname list. No FQDN matches
`about:blank`, so the widget refused to mint and every email attempt 403'd (`invalid-domain`).
Registering any hostname in the dashboard could not help on its own.

**Fix (user picked: serve from the API):** the widget page now lives server-side and the WebView
loads it by URL, giving the widget a real https origin that Cloudflare can bless.
- `server/.../turnstile.ts` — canonical `turnstilePageHtml(siteKey)` (self-executes on load with
  the bounded retry; same postMessage protocol). Site key injected from server env — no longer
  shipped in the app bundle at all.
- `server/.../routes.ts` — `GET /auth/turnstile` serves it as `text/html` (deliberately not the
  JSON envelope; declared before the `/:provider` catch-all).
- `apps/mobile` `TurnstileWidget.tsx` — loads `${API_URL}/auth/turnstile` instead of inline HTML;
  drops the `onLoad` kick (the page self-executes), keeps consume/foreground re-execute.
- `EXPO_PUBLIC_TURNSTILE_SITE_KEY` demoted to the client availability gate only.

**Required Cloudflare config:** add the API's bare FQDN to the widget's Hostname Management
(prod: `atsumaru-6i3n.onrender.com`). Then rebuild the APK (JS change) + redeploy the server.
Still unverified: real-device mint against the live hostname.

### 5o. Widget must be Managed + visible — the mode the dashboard, not the code, chose (2026-09-04)

Email login STILL failed after §5n with the page live on the real hostname. Root cause found at
last, and it was the one thing no amount of key/hostname code could fix: **widget mode is a
Cloudflare dashboard setting** (per-widget, chosen at creation / editable under Settings), not a
render option — and this widget was created **Invisible**. Invisible (and Non-Interactive) mode
never presents an interaction: if Cloudflare's background check does not pass the visitor
(emulator, VPN, datacenter, cross-border IP — exactly this user's setup), there is no checkbox
and no token, ever. The hidden 1×1 WebView + 5s timeout then silently delivered `undefined`, and
`verifyTurnstile` returned false **without logging** — so every attempt 403'd with no server-side
signal. This explains why the failure survived the site-key fix and the hostname fix intact.

- **Dashboard (user, done): widget mode → Managed.** Managed auto-passes a trusted session
  silently, and when Cloudflare wants more proof it shows a checkbox the visitor ticks — the
  only mode that can complete a challenged session. Invisible cannot, by design.
- `server/.../turnstile.ts` — `turnstilePageHtml` now renders a **visible** widget (Managed
  auto-runs on render; no `execute()` — that is Invisible-only and is what the old page did) with
  an on-page status line (`Verifying… / Verified / failed (code)`) that doubles as a browser
  self-test: opening `GET /auth/turnstile` in any browser should solve to "Verified".
  `window.__turnstileRefresh` (reset) replaces `__turnstileExecute`. api.js load failure now
  shows visible text instead of a silent no-token timeout.
- `verifyTurnstile` — the empty-token case now logs distinctly (previously silent), so a widget
  that fails to mint is visible in Render logs instead of a black-box 403.
- `apps/mobile` `TurnstileWidget.tsx` — the WebView is now a visible, tappable ~220px card in
  the email form (a Managed checkbox needs to be seen and clicked); zero-size + `pointerEvents
  none` gone. `EmailAuthScreen` mounts it between the error text and the submit button. Load
  errors (`onError`/`onHttpError`) log to console.

**Dashboard facts pinned:** mode + hostname list live on the widget's Settings; the hostname must
be the API's bare FQDN (`atsumaru-6i3n.onrender.com`), and the site key/secret pair only match
while the widget keeps its current keys. Pending: user to deploy the new page, rebuild the APK,
and confirm the browser self-test shows "Verified" before testing in-app.

### 5p. THE actual root cause — render() got a bare id, not a selector (2026-09-04)

§5o's invisible-mode theory was WRONG. The on-page instrumentation added there surfaced the real
error at last: `Widget failed to start: [Cloudflare Turnstile] Unable to find a container for
"container"`. Per the official client-side-rendering docs, `turnstile.render()` takes a **CSS
selector** (`"#container"`) or an **element** — passing the bare id `'container'` makes api.js
look for a `<container>` **tag** and throw. The page had called `render('container', …)` since the
FIRST version (§5k), with no try/catch, so the throw was silent: `widgetId` stayed null, no token
was ever minted, and the retry loops burned out quietly. Every earlier theory (about:blank
hostname §5n, Invisible-can't-challenge §5o) was never actually exercised — the widget never
rendered anywhere to reach those checks. §5l's `domStorageEnabled` was a genuine requirement and
§5o's Managed-mode dashboard change + visible widget are genuine prerequisites for what comes
next, but the mint-blocking bug was this one line, all along.

- `render(container, …)` now passes the element from `getElementById('container')` (null-checked).
- Also corrected a second param bug found against the docs: `appearance: 'light'` is invalid
  (appearance ∈ always/execute/interaction-only, and controls *when* the widget is visible);
  the theme option is `theme: 'light'`.

**Server-only fix** — the app fetches the widget page by URL, so no APK rebuild is needed: deploy
and the WebView gets the corrected page. Pending: confirm the browser self-test and an in-app
email login now mint + pass siteverify.

### 5q. Branded email-confirmation web page (2026-09-04)

Signup confirmed from the email link but the user then landed nowhere visible. Now the
signup `emailRedirectTo` points at a branded page instead of the app scheme:
- `email.ts signUp` — `emailRedirectTo` = `${APP_PUBLIC_URL}/api/auth/confirm` (falls back to
  `APP_AUTH_REDIRECT` when `APP_PUBLIC_URL` is unset). New env `APP_PUBLIC_URL` (defaults to
  the Render app URL) documented in `.env.example`.
- `routes.ts` — new public `GET /auth/confirm` renders the あつまる-branded page (wordmark,
  "Your email is confirmed — now sign in", a "Back to the app" button deep-linking to
  `APP_AUTH_REDIRECT`). Static HTML, no auth surface.

Key insight from the docs (and why there is no token handling on the page): GoTrue consumes
the confirmation token at `/auth/v1/verify` and then 302s the browser to `redirect_to` — the
page never sees the token; merely reaching it means the email is confirmed. An earlier draft
that called `verifyOtp` on `/auth/confirm` was removed for exactly that reason (the token never
arrives).

Verified locally: page serves with the brand, headline, and a working back-to-app href
(`exp://…/--/auth` in dev; `atsumaru://auth` in prod). Server typecheck + 100/100 tests pass.
Pending: deploy; **add `${APP_PUBLIC_URL}/api/auth/confirm` to Supabase → Auth → URL
Configuration → Redirect URLs** (else GoTrue falls back to Site URL); no email-template edit
needed (branding was explicitly out of scope — default Supabase email stays).

### 1g. Four new notification types, 2026-09-03 — logic verified live, delivery still unexercised

Push was one notification wide (the feedback reminder) and, more importantly, **had nowhere
to land**: nothing in `apps/mobile/src` registered a notification listener, and nothing
joined the push payload to `linking.ts`. A delivered notification would have sat in the tray
and opened whatever screen the user last had open. That is fixed first; the four new types
sit on top.

- [x] **Routing.** `features/notifications/notificationRouting.ts` — `setNotificationHandler`,
      `getLastNotificationResponseAsync`, a tap listener, and `urlFromNotificationData`.
      Loaded through the same deferred `require()` + `ExecutionEnvironment` gate as
      `usePushRegistration.ts`, because a module-scope import of `expo-notifications` kills
      the bundle in Expo Go. `linking.ts` now overrides `getInitialURL`/`subscribe`, so cold
      start, warm start and background all route the same way. `PushMessage` carries a `url`
      alongside the existing `data.type`
- [x] **One gate.** `services/notifications.ts` — every type goes through `notify()`, which
      applies quiet hours, then the opt-out, then the daily cap, in that order (the cap
      *spends* budget, so it must not be spent on something a cheaper check would drop).
      Caps are charged per person, not per device
- [x] **`meetup_soon`** — new sweep pass, forward-looking query of its own because the
      existing candidate select can only return events already past `start_time`. Stamps
      `start_reminder_sent_at` via `claim()` **before** sending. **Verified live**: rewound
      an event into the window, swept twice, one stamp, second sweep did not re-stamp
- [x] **`nearby`** — `events_nearby_users()` does radius, freshness, host/member exclusion
      and limit in one statement, triggered per created event. **Verified live**: 0 host
      leaks, 0 member leaks, 0 closed-event leaks across five events; returns nothing while
      `location_updated_at` is null, which is what the freshness guard is for
- [x] **`chat`** — `services/chatNotice.ts`, for recipients with no live socket. Debounced
      one per thread per 5 minutes by reusing the fixed-window limiter. Fired
      fire-and-forget from both the socket path and the REST fallback, so the two behave
      alike. No model touches a message (`docs/AI.md` §10 holds)
- [x] **`reengagement`** — `reengagement_candidates()` finds members dormant 7+ days and
      names a co-member from their most recent multi-member group. **Verified live**:
      returns nothing while `last_active_at` is null (so shipping it cannot nudge everyone
      at once), names a real co-member, never the recipient, and stamping
      `last_reengaged_at` removes them for 14 days
- [x] **Copy.** All five types in en/ja/zh, server-side next to `FEEDBACK_PROMPT`, truncated
      to what a tray shows. The re-engagement line states only what the query proves — a
      test asserts it never says "waiting", "misses" or "asked about you", and that a lone
      co-member does not read "and 0 others"
- [x] **Opt-out UI.** `GET`/`PATCH /users/me/notifications` plus a settings card; absent row
      means enabled, so shipping it mutes nobody. Mirrored in the demo layer
- [x] Migration `007_notifications.sql` + `schema.sql` mirror, applied live 2026-09-03 with
      `notify pgrst, 'reload schema'`. **006 had to be applied first — it never had been**,
      which means `enforceQuota` had been failing open on live all along
- [ ] Real delivery. Still needs `eas init`, FCM credentials and a dev build; nothing below
      `pushTargets` has ever run. `expo-notifications` is now in `app.json` plugins
- [ ] `@socket.io/redis-adapter` so presence is not per-process (see Known gaps)

Verification: `npm run typecheck` clean, `npm test` 95/95, API boots, both new routes
answer 401 rather than 404 (a deliberately missing route was checked as the control). All
live scratch state was reverted — the three new `users` columns are back to null and the
pre-existing `location` rows are untouched.

### 0. Mapbox wired behind a fallback, 2026-08-31 — code complete, unverified

`docs/TRD.md` §12 names `@rnmapbox/maps`, and the package plus its `app.json` plugin were
already installed — but nothing in `src/` imported it, so the plugin was injecting a Mapbox
maven repo and a native module into the Android build for a map that did not exist. Wiring
it also had to not break Expo Go, which cannot load the native module at all.

- [x] `components/map/mapbox.ts` — the single load point. `@rnmapbox/maps` throws from
      *module scope* when `NativeModules.RNMBXModule` is null, so a top-level `import`
      anywhere in `src/` would kill the bundle in Expo Go; it is a deferred `require()`
      behind a token check, and sets the access token + disables telemetry once
- [x] `components/map/MapSurface.tsx` — one branch, the same shape as the demo-mode switch
      in `services/api/client.ts`: Mapbox when available, the hand-authored vector city
      otherwise
- [x] `components/map/PinBody.tsx` — the pin extracted out of `MapPin`, so both renderers
      draw the identical annotation. `PIN_BOX` / `PIN_POINT_Y` let a `MarkerView` anchor
      the stem's point on the coordinate; the label lives inside the box because Android
      clips a `MarkerView` child drawn outside its bounds. Only the vector map passes
      `counterScale` — Mapbox sizes screen-space annotations itself
- [x] `components/map/framing.ts` — chrome height and sheet exposure shared by both, since
      Discover's visible band is neither the view's centre nor its full height. Mapbox
      feeds them to camera padding, the vector map clamps its pan against them
- [x] Refetch on settle for the Mapbox surface (docs/FRONTEND.md §9) — gesture-driven
      camera moves only, past a 400 m threshold, so framing pins cannot feed itself a
      fetch. `DiscoverScreen` holds the panned centre separately from the location fix, so
      the one-shot read stays one-shot (docs/RULES.md)
- [x] `app.json` pins `RNMapboxMapsVersion` to `11.23.1` (the version the package itself
      defaults to) rather than leaving the native SDK floating
- [x] `npm run typecheck` clean both packages, `npm test` 49/49, `npx expo export
      --platform android` bundles 1771 modules
- [ ] **Never seen on a screen.** No `pk.*` token has been issued and Expo Go has no native
      module, so every run so far took the vector-city branch. The tiles, `MarkerView`
      anchoring, camera padding and the settle-refetch all remain unverified
- [ ] Emulator re-check blocked on an unrelated failure: Expo Go SDK 57 redboxes at startup
      with `TurboModule method "installTurboModule" called with 0 arguments` out of
      `NativeWorklets` (react-native-worklets / Reanimated 4 against this Expo Go build).
      Reproduced on `main` with these changes stashed, so it predates them


### 0b. Explicit personality selection during onboarding — DONE 2026-09-01

Personality is already extracted *passively* — the AI host guesses 2–4 tags from whatever
the user volunteers, then embeds `interests + personality` → `preference_vector` → matching's
0.6 cosine term. The ask: make it *active* — host asks about personality with concrete
options, user multi-selects from a **fixed localized vocabulary** via **in-chat quick-reply
chips**. No schema/score/matching change; tags still flow into the same `preference_vector`.

- [x] `apps/mobile/src/onboardingPersonality.ts` — fixed localized vocab (en/ja/zh), ~10
      traits (bubbly, laid-back, self-contained, outgoing, curious, energetic, thoughtful,
      adventurous, creative, easygoing), labels double as canonical keys
- [x] i18n `onboarding.personalityPrompt` + `onboarding.traits.*` in en/ja/zh
- [x] `AIChatScreen` chip tray above the composer — multi-select `Chip`s, one localized
      user turn `"I'm {selected}"`, selection clears on send
- [x] `services/ai.ts` SYSTEM_PROMPT — host proactively asks the personality question and
      normalizes typed/tapped traits into 2–4 short `personality` tags (all existing hard
      boundaries kept)
- [x] Demo mirror: extend `PERSONALITY_VOCAB` in `demo/index.ts` with the new trait words so
      tapped chips extract correctly in demo mode
- [x] Verified: `npm run typecheck` both packages, `npm test` server
- [x] **Tray is gated on the host actually asking** — `showPersonality` bool rides in the
      chat JSON (schema + prompt in `ai.ts`, mirrored by the demo), so the tray appears only
      while the host poses the personality question, never preemptively
- [x] **Host asks language first** — first turn asks the chat/app language (ja/en/zh),
      returns it as `language` in the JSON; client applies it via `setLanguage`, flipping
      the whole app + transcript. Mirrored in the demo (turn 1 asks, echoes the choice)
- [x] **Language follows the user** — never guessed from name/handle/greeting; set only
      after an explicit answer OR when the user keeps writing substantive content in one
      of the three languages (then the host adopts it and converses directly). Verified
      against live Groq: no-guess + stated-answer + adopted-language paths all work.
- [x] **Interest ceiling 12 → 30** (`ai.ts`, `onboarding/routes.ts`, `users/routes.ts`) so
      the system accepts dramatically more interests
- [x] **Wider interest net** — prompt probes distinct activity categories across a 4-6
      exchange chat and extracts 8-15 diverse interests. Demo `INTEREST_VOCAB` grew
      10 → ~28 activity types; `FOLLOW_UPS` probe 7 categories. Live Groq returned
      9 diverse interests (prev ~3-4). Verified `npm run typecheck` + `npm test` 49/49.
- [x] **Meetup categories 4 → 9** — added music, wellness, travel, learning, sports to
      `CATEGORY_ORDER`/`CATEGORY_GLYPH` (categoryMeta.ts) with new WCAG-AA sticker
      `{bg,on}` pairs in `colors.sticker` (tokens.ts). New `discover.categories.*` labels
      in en/ja/zh. Demo world + server seed each gained 5 events (one per new category).
      Filter chips scroll horizontally so layout fits. Typecheck + 49/49 green.

### 0c. Hardware-backed device identity — [~] code complete 2026-09-01, needs dev build + live run

Chosen over Nitro Enclaves (server-side TEE): client-side **Android Keystore key**
(ECDSA P-256, non-exportable, StrongBox where available) proven to the server once at
sign-in by signing a challenge nonce — a real "same physical device" signal, not a
device id alone. Decision reasoning + the client+minimal-server scope locked with the
user in `context.md` §16. verify-at-login only (not per-request); no lock-screen/biometric
gate or Play Integrity attestation yet.

- [x] Native module `android/app/src/main/java/com/atsumaru/app/keystore/`
      (`AtsumaruKeystoreModule` + `AtsumaruKeystorePackage`) — generate/getPublicKeySPKI/
      sign/isHardwareBacked/delete over the Android Keystore; registered manually in
      `MainApplication.kt` (cannot be autolinked, lives in-app)
- [x] `src/services/deviceIdentity/keystore.ts` — gated wrapper (deferred read of
      `NativeModules`, Expo Go safe, mirrors the `mapbox.ts` convention) +
      `deviceIdentity.ts` — per-install device id in SecureStore, register → challenge →
      verify on the server; best-effort, never blocks or fails sign-in
- [x] Server: `migrations/005_device_keys.sql` + `schema.sql` mirror — `device_keys`
      (PK `(user_id, device_id)`, SPKI cert, `strongbox`, one pending `challenge_nonce`
      with expiry), RLS on. Query fns in `queries.ts`; routes
      `POST /users/me/device`, `GET /users/me/device/challenge` (32-byte nonce, ~2-min
      TTL, single-use), `POST /users/me/device/verify` (SHA256 with stored SPKI)
- [x] Client wiring: fire-and-forget after OAuth exchange and on session restore;
      interceptor sets `X-Device-Id` once resolved; demo mode returns a simulated
      `{ verified: true }` with no network call
- [x] Verified: `npm run typecheck` (server + mobile) clean; `npm test` 53/53 (new
      `deviceIdentity.test.ts` covers the SPKI/signature round-trip + tamper/expiry)
- [x] Migration `005_device_keys.sql` applied against live project 2026-09-02
      (`scripts/sql.mjs`); `select count(*) from device_keys` → 0 (no rows yet, expected)
- [ ] Native module actually runs (needs `expo run:android` dev build; Expo Go cannot
      load it) and a real register+verify round-trip lands a `device_keys` row

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
- [x] `@rnmapbox/maps` was imported nowhere in `src/` while its `app.json` plugin injected
      a Mapbox maven repo and a native module into the Android build. Resolved by using it:
      `components/map/mapbox.ts` loads it behind a deferred `require()` and `MapSurface`
      falls back to the vector city, so Expo Go still runs without a dev build
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

#### Render API re-verification, 2026-09-03

Full hardening branch re-tested against the live Render deployment
(`https://atsumaru-6i3n.onrender.com/api`). `npm test` 87/88 (1 skip: Turnstile
configured, degrade path not exercised), `npm run typecheck` clean (server + mobile).

| Assertion | Result |
|---|---|
| `/health` | `200 {success, data: {status:"ok"}}` |
| 404 envelope | `{success:false, error:{code:"NOT_FOUND", message:"That endpoint does not exist."}}` |
| `/auth/me` no token | `401 UNAUTHORIZED "Missing bearer token."` |
| `/auth/me` bad token | `401 UNAUTHORIZED "Invalid or expired token."` |
| `/auth/me` valid seed token | `200`, correct `PUBLIC_USER_COLUMNS` profile, no `real_name` |
| `GET /events/not-a-uuid` | `400 INVALID_ID "id must be a UUID."` |
| `GET /events/nearby` (PostGIS) | Events returned with correct envelope, `status` derived by `event_status()` |
| `GET /events/mine` | Completed + ongoing + upcoming returned with correct statuses |
| `POST /events` future `start_time` | `201`, `current_size: 1` — host membership in same transaction |
| `POST /events` past `start_time` | `400 INVALID_BODY "start_time must be in the future."` |
| `POST /events/:id/leave` ongoing | `409 MEETUP_ALREADY_STARTED` |
| `POST /events/:id/leave` host | `403 HOST_CANNOT_LEAVE` |
| `POST /events/:id/join` already-member | `200 {status:"matched"}` — no-op, idempotent |
| `POST /events/:id/join` full event | `409 EVENT_FULL` (via seed) |
| `GET /events/:id/messages` non-member | `403 NOT_A_MEMBER` |
| `POST /events/:id/messages` member | `200`, message persisted with correct envelope |
| `GET /events/:id/recap` (cached AI) | `200`, cached recap returned (cache-first wins) |
| `GET /events/:id/match-preview` | `200 {match_score, why[]}` |
| `POST /auth/refresh` bogus token | `401 REFRESH_REJECTED` |
| CORS preflight correct origin | `access-control-allow-origin` returned |
| CORS preflight wrong origin | `access-control-allow-origin` not returned (after Render env deploy) |

All error envelopes follow `{success, error: {code, message}}`. No raw Postgres text
ever leaks. Test rows created by this run (1 test event, 1 test chat message) were
cleaned up via service-role REST.

**Render env note:** `CORS_ORIGIN=https://atsumaru-6i3n.onrender.com` set in the Render
dashboard (2026-09-03). Env var changes on Render require a manual redeploy to take
effect — the running process still has the old value until the next deploy. The code
(`cors({ origin: env.CORS_ORIGIN })`) is correct; the env is set; a redeploy activates it.

**Migration 006 note:** `bump_quota` RPC not in PostgREST schema cache
(`PGRST202` on `rpc("bump_quota", ...)`). Migration `006_usage_quotas.sql` has not been
applied to the live project yet. `enforceQuota`/`tryQuota` fail open (return `true` on
RPC error), so no user-facing 429s or 500s — quotas simply don't enforce. Apply with
`node scripts/sql.mjs -f server/db/migrations/006_usage_quotas.sql` then
`notify pgrst, 'reload schema'` when ready.

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
- [~] Refetch on map region change (docs/FRONTEND.md §9) — written, **unexercised**. `MapboxMap` reports a settled camera (gesture-driven only, 400 m threshold) and `DiscoverScreen` queries the panned centre; the vector city raises no such event, so nothing has run this path yet
- [x] Venue place-search on create-event (Mapbox Search Box; `language=ja` is required or it
      returns wards instead of venues — measured against the live API, 2026-09-04)
- [x] Map controls: recentre on my location, via a `MapSurfaceHandle` both renderers implement
- [~] 5 km search-radius ring — Mapbox only, and unexercised until a dev build exists
- [ ] Deep-link the feedback notification — `linking.ts` is wired but `atsumaru://` does not route in Expo Go; needs a dev build

### 3. Mobile — P1 features

- [x] Create-event screen (FR-13) — posts a fixed Shibuya point; a venue picker is still to do
- [x] **Profile page (2026-09-01)** replaces the old Settings screen: hero (avatar/kicker/handle/name), stats row (rep/connections/meetups), numbered interests index, language override → `PATCH /users/me`, sign out. Editorial grammar (whitespace + hairline rules, no rounded settings cards). Old `SettingsScreen`/`Settings` route removed → `Profile`
- [x] "Your meetups" section on Discover — a completed meetup had no UI route at all, so feedback was reachable only via a push the device cannot receive
- [ ] Reusable components still inlined in screens: `Avatar`, `MemberRow`, `ChatBubble`, `ChatInput`, `RatingSelector`, `MatchScore`, `LoadingSkeleton` (docs/DESIGN.md §7)
- [ ] Infinite scroll on message history now that the paging envelope is returned
- [~] Mapbox **wired, never run** — `components/map/MapSurface.tsx` picks `MapboxMap` when `hasMapbox()`, else the vector city. Still needs a `pk.*` token *and* a dev build: no token has been issued, and Expo Go has no native module. Bundle builds and typechecks clean; the tiles, `MarkerView` anchoring and camera padding have not been seen on a screen

### 3b. Alphanumeric handle suggestions + bloom filter + Discover sheet scroll (2026-09-03)

- [x] **Handle suggestions, Instagram-style (server + mobile + demo).** `check-handle` now returns
  `{ available, suggestions }` live per keystroke; `suggestions` are up to 4 alphanumeric variants of
  the typed base (`drivinggames` → `drivinggames_chtau`), format `{base}_{5 alnum}` inside the existing
  `HANDLE_RE` (`/^[a-z0-9_]{3,20}$/`) — no DB/seed/regex change needed (user picked `_` over `-`).
  Generator is a pure unit: `server/src/modules/onboarding/suggest.ts` (`handleVariants`/`sanitizeBase`).
  Client: live chips under the field in `ProfileConfirmScreen`, replacing the interest chips once the
  user edits the handle; demo mirror returns the same shape (Set-based).
- [x] **Bloom filter over taken handles** (`server/src/utils/bloom.ts`, dependency-free sha256
  double-hash, pure + unit-tested). Loaded lazily from the `users` table; `takenHandles` uses it as a
  fast **negative** (a fresh suffixed handle usually misses → zero DB queries), with a DB confirm on a
  "maybe" — the `users.handle` unique constraint is always the source of truth, so a stale bloom can
  never admit a duplicate; `complete` inserts into it. DB-down degrades to the pure-DB path, matching
  the integration `has*` degrade convention.
- [x] **Discover sheet: draggable *and* scrollable.** `BottomSheet`'s single `Gesture.Pan()` swallowed
  every drag, so the list could never scroll. Now the sheet shares a `Gesture.Native()` + scroll offset
  through `useBottomSheetScrollable()` (context + `simultaneousWithExternalGesture`); the pan gate
  yields to the list on drag-up whenever it's scrolled or flush at the top detent
  (`BottomSheet.tsx:175`). Scrollable body extracted to a `SheetBody` child so the hook runs inside the
  provider (fixes the "useBottomSheetScrollable must be used inside <BottomSheet>" render error); also
  removes `BottomSheet` from the shared-component TODO above.
- Verification: `npm run typecheck` clean (server + mobile), `npm test` 75 pass / 1 skip / 0 fail (up
  from 68 → +8: 4 bloom + 4 suggest). Server boots clean; live `check-handle?handle=drivinggames` →
  `{ available: true, suggestions: [drivinggames_chtau, …4] }` against the restarted `:4000` API.
  Gesture feel + suggestion tap need a device/emulator confirmation (not exercised here).

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
      exposure was low, but it is pinned now rather than trusted. **Render dashboard env
      set to `https://atsumaru-6i3n.onrender.com` (2026-09-03); active after next deploy**
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
- [x] **Recap prompt made concrete, not vague (2026-08-31).** `recapPrompt` (moved to
      `modules/recap/vibe.ts`, `legend`→`text.clicked`), now declared type-safe via the
      `RecapPrompt` interface and called as `recapPrompt(language, event.category, summary)`
      (`routes.ts:190`) so the **category reaches Groq** — the one public, non-member field
      that lets a sparse recap anchor on something real. Wording live-validated and fixed
      2026-08-31 ("recap too vague"): 3 traits → names them all ("people who love hiking,
      coffee, and ramen"); 1 trait → category anchor ("people who love strategy at this
      board games meetup"); 0 traits → category-alone, Japanese ("料理のミートアップで良い
      雰囲気でした…"). Groq-path verdict: **good, live-validated**. Open: reword the
      deterministic `templateRecap` category-anchor path the same way, or leave the Groq
      path as the floor? (Groq path runs first; `templateRecap` is only the fallback)
- [x] **Onboarding SYSTEM_PROMPT tuned (2026-08-31).** Rich input draws more out of the
      user; "idk" → concrete Japanese draw-out; hostile redirect stays in character; still
      JSON-only. **Deployed `SYSTEM_PROMPT` matches `extractionSchema` (interests +
      personality, no `goals`)** — the pasted reference carrying a `goals` field was
      stale; no action needed. `groq/compound` tests pin the en/ja contract (context.md §11)
- [x] **`sanitizeRecap` collapses Unicode NEL (2026-08-31, `modules/recap/vibe.ts`).**
      Regex now `[\s\u0085]+` — `\s` misses the U+0085 NEL separator a model can emit
      around an em-dash, a latent line-break hole. `vibe.test.ts` pins it. (The earlier
      "newline in recap" was actually console text-wrapping of a wide CJK line — not a bug)
- [x] **`onboardingChat` graceful retry on Groq request failure (2026-08-31,
      `services/ai.ts:104-120`).** The existing JSON-mode protection only handled Groq
      returning *malformed* JSON, not *rejecting the request* (`invalid_request_error`,
      intermittent "Failed to generate JSON" in `json_object` mode) — that threw through
      the route to a 500. Root-cause fix: wrap `client().chat.completions.create()` in the
      same try/catch that already guards `JSON.parse`, returning `RETRY_REPLY` on throw.
      One guard in the shared function covers every caller
- [x] **E2E report (2026-08-31, live project) — 44 checks, 43 PASS / 1 FAIL.** The single
      FAIL was Finding 1 (multi-turn onboarding chat → intermittent 500, ~3 of 4 calls),
      root-caused and fixed by the try/catch above; retested 8/8 multi-turn calls → 200
      with real replies. All AI features (onboarding chat, vibe recap source=ai, MiniLM
      embedding 384-dim) + full authenticated API + frontend wiring verified. Group
      chat/DMs model-free by design (no regression). Two earlier "failures" were test
      bugs, not app bugs (pgvector string-vs-array read; wrong harness response field)

- [x] `connections/routes.ts:32` interpolates `userId` into a PostgREST `.or()` filter.
      Safe today (it is a UUID off the verified JWT); defence-in-depth only
- [x] **AI surface, stated exactly.** GROQ has two jobs — the onboarding chat and the
      post-meetup vibe recap (`docs/AI.md` §6a). HuggingFace has one: MiniLM preference
      vectors at onboarding. Matching and feedback consume/update the stored vector with
      plain arithmetic, no service call. **Group chat and DMs remain pure text plumbing** —
      no summarization, sentiment, smart replies, or message embedding, and message content
      is not a matching signal. Adding AI there is a product change (`docs/RULES.md` §10),
      needing new routes plus a socket hook

### 5b. Warm Japanese Editorial mobile overhaul (2026-09-01)

The app was brought into the marketing site's visual language (`docs/DESIGN.md` §1b,
`docs/VISUAL_OVERHAUL.md`). User-mandated grammar: **fewer pills**, replaced visual
grammar — pills only for compact metadata; primary CTA = substantial rectangular
(`radius.xs`), never capsule; cards = composition (thin rules / edge-to-edge / rounded
tiles), not floating rects; settings = whitespace + hairline rules.

- [x] **Tokens** — `primary` stays site coral `#FF432A`; `neon` folds INTO coral
      (lime gone as a general accent), `neonText`→cream `#F7F4EE`; `accent`→sage
      `#719B86`; bg→cream `#F7F4EE`; night→warm ink `#171717`; food sticker lime→warm
      amber `#D9A441`; added `nightRaisedSoft` `#2C2925`
- [x] **SVG icon set** — `components/ui/Icons.tsx` (new): `IconConnections`, `IconProfile`,
      `IconGear`, `IconChevronRight`, `IconSparkle`, `IconMap`, `IconWarning`, `IconSend`,
      `IconWave`. Stroke-based 24×24 `currentColor`; `react-native-svg` 15.15.4
- [x] **Discover nav** — username removed from the map band; top-left = connections SVG
      circle, top-right = profile avatar circle (`circleButton`), filter rail anchored by
      `bandBottom` onLayout
- [x] **Profile page** replaces old Settings screen (see §3) — `Profile` route wired,
      `SettingsScreen.tsx`/`Settings` deleted from types/linking/RootNavigator
- [x] **Button** — rectangular across all variants (`radius.pill` → `radius.xs`)
- [x] **EventCard** — floating rect → rounded editorial tile (`nightRaised` bg,
      `radius.lg`, hairline border), score as coral numeric mark (not a soft pill),
      trail `→` affordance
- [x] **Discover rows** — feedback/location rows from floating rects → editorial
      transparent + hairline rule
- [x] **Emoji→SVG chrome swap** — ScreenState ⚠️→`IconWarning` / 🗺️→`IconMap`; celebration
      🎉→`IconSparkle` (Meetup + Feedback); chat empty 👋→`IconWave`; AIChat send ↑→
      `IconSend`, opener 👋→`IconWave`. Dead glyph styles stripped. Category emoji
      (🍜🎮🎨⛰), rating faces (😐🙂🔥), and greet-emoji inside i18n copy **stay** — they are
      data marks or content, not chrome
- [x] **i18n** — `profile.*` keys added to en/ja/zh
- [x] **User follow-ups** — upcoming tiles greyer (`nightRaised`), completed tiles lighter
      (`nightRaisedSoft`), both `radius.lg` rounded (fixes the "same background + sharp
      vertices" regression from the first pass), selected = thicker coral border; LINE login
      button lime-green `#06C755`
- [x] `npm run typecheck` green (server + mobile) after every batch
- [ ] **      Visual QA is a human-eye job on the emulator** — the model cannot read screenshots.
      Discovery band, tile contrast, Profile hero and the empty/selection states were the
      handoff points

### 5c. Security hardening vs ATSUMARU_SECURITY_COMPLETE.md (2026-09-02)

Full audit recorded in `docs/SECURITY_AUDIT.md`. Baseline was already strong (requireAuth /
requireMembership / requireConnection everywhere sensitive, RLS deny-all default, service-role
server-only, signed-state + PKCE + single-use OAuth, AI gated to three jobs, no AI in chat).
Closed the two exposed §19.1 "Very strict" rate-limit holes and added the first negative tests
(the standard's §75 DoD had **zero**). A second line-by-line pass closed six more.

- [x] **Auth rate limits** (`modules/auth/routes.ts`) — IP-keyed `AUTH_RATE_LIMITS`:
      handoff-code `/session` 20/min (tightest, §19.1 "Very strict"), `/callback` + `/:provider`
      30/min; `enforceLimit` → 429 + `Retry-After`
- [x] **Feedback rate limit** (`modules/feedback/routes.ts`) — `feedbackLimiter` 10/hr keyed by
      user (not IP, per §19.2 shared-network warning), on `POST /:id/feedback`
- [x] **Negative authorization tests** — `canAccessConnection` extracted as a pure predicate
      (shared REST + socket DM gate: mutual AND participant); `db/authorization.test.ts` covers
      non-participant / non-mutual / missing
- [x] **Auth rate-limit tests** — `modules/auth/authRateLimit.test.ts` pins the §19.1 budget
      ordering and that the session limiter actually blocks
- [x] **Rate-limit keying fixed** (`modules/auth/routes.ts` `clientIp`) — `X-Forwarded-For` is
      attacker-controlled; now trusted only when `TRUST_PROXY=true`, else the socket address
- [x] **Limiter map pruned** (`utils/rateLimit.ts`) — `prune()` was unreachable in prod; each
      limiter now `setInterval`s an unref'd prune on its own window (no unbounded memory grow)
- [x] **OAuth secret fails closed** (`config/env.ts`) — production refuses to boot with a dev
      `AUTH_STATE_SECRET` instead of warning (§5.4/§41)
- [x] **`/health` trimmed** (`index.ts`) — integration/OAuth config booleans removed; liveness
      only (§20)
- [x] **Malformed JSON → 400** (`middleware/errorHandler.ts`) — body-parser `entity.parse.failed`
      mapped to 400 `INVALID_JSON` instead of a 500 (§43/§62)
- [x] **Send/creation limits** — per-user budgets on REST + socket: group chat 300/hr, DM
      120/hr, event-create 30/day (§19.1)
- [x] **New tests** — `middleware/errorHandler.test.ts` (JSON→400 / 403 passthrough / generic
      500 no-leak), auth `TRUST_PROXY` default + limiter spacing; `npm test` 59 → 64; typecheck
      clean (server + mobile)

Third pass (rate limiting everywhere, quotas, throttling, CAPTCHA; cost-controls skipped per
user decision):

- [x] **Read throttling everywhere** (`utils/readLimit.ts` + all GET handlers) — one shared
      per-user budget (240/min, `READ_RATE_LIMIT`) on every discovery/profiling read: events
      nearby/mine/id/members/match-preview, connections + history, chat + DM history,
      `/users/:id`, onboarding handle probes, recap
- [x] **Persisted usage quotas** (migration `006_usage_quotas.sql`, `utils/quota.ts`) — daily,
      cross-restart caps via atomic `bump_quota` RPC: events-created 30/day, feedback-submitted
      200/day, groq-turns 500/day; recap fails open to its template on quota (a passive card is
      never 429'd). **Not yet applied to the live project** (`PGRST202` on `bump_quota` RPC);
      fail-open means no user impact, but quotas don't enforce until migration 006 is applied
      + `reload schema`
- [x] **Turnstile auth gate** (`modules/auth/turnstile.ts`, gated server-side) — when
      `TURNSTILE_SECRET_KEY` is set, `POST /auth/session` requires a valid widget token
      (`CAPTCHA_FAILED` 403); off by default (no keys → no challenge); degate path unit-tested
- [x] **Client Turnstile hook** (`apps/mobile/src/services/auth/turnstile.ts`) — gated like
      Mapbox/Keystore; `acquireTurnstileToken()` returns undefined until a site key AND
      `react-native-webview` + dev build; wired into `useOAuthLogin` session exchange
- [x] **Cost controls** — **skipped** (user decision): rate limits + quotas already cap the only
      paid integrations (Groq/HF); revisit if spend grows
- [x] **Tests** — `turnstile.test.ts` (degrade pass when unconfigured); `npm test` 64 → 65;
      typecheck clean (server + mobile)
- [ ] **Open** (see SECURITY_AUDIT.md): non-member reads any event's member list (product
      tradeoff — read volume now capped by the shared §19 browse limiter); route-level `User A
      cannot X` tests blocked on a `db()` injection seam (`mock.module` unavailable on installed
      `node:test`); the §22 sweep-atomicity fix (stamp after side effect) before `REDIS_URL`;
      Turnstile client widget needs `react-native-webview` + keys + dev build to actually run

#### Email/password auth (docs/TRD.md §17 — server + client done)

- [x] **Server** (`modules/auth/email.ts` + `routes.ts`) — `passwordSchema` (min 8 + upper/lower/
      digit) + `emailSchema`; `signUp` (confirmation email, no pre-confirmation tokens, 409
      `EMAIL_TAKEN`), `logIn` → single-use handoff `{ code }` redeemed via the shared
      `POST /auth/session`, `requestPasswordReset` (anti-enumeration), `completePasswordReset`
      (one throwaway `authDb()` client for `verifyOtp` + `updateUser` — fixes the two-client bug)
- [x] **Turnstile fail-closed on email surfaces** — `signUp` / `requestPasswordReset` return
      503 `CAPTCHA_REQUIRED` when no `TURNSTILE_SECRET_KEY` is set (direct-hit surfaces must not
      default open) — distinct from `/auth/session`, which *skips* when unconfigured
- [x] **Limiters** — signup 10/hr, login 20/min, reset 10/hr, reset-complete 10/min; routes
      registered before the `/:provider` catch-all
- [x] **Client** — `authApi` `signup/login/requestPasswordReset/completePasswordReset` +
      `useEmailAuth` hook (login redeems code → `signIn`; signup reports "confirm email");
      `EmailAuthScreen` (login/signup/reset modes, theme tokens, Button/TextInput); wired into
      `AuthStack`; "Continue with email" entry on `LoginScreen`; i18n en/ja/zh
- [x] **Tests** — `email.test.ts` (password policy + email schema, pure only — supabase paths
      not unit-testable with real keys); `npm test` 65 → 68; typecheck clean (server + mobile)
- [ ] **Open** — recovery deep-link (`atsumaru://auth?action=recovery`) routing to a
      reset-complete surface is unexercised (same dev-build/linking constraint as OAuth;
      `completePasswordReset` API + hook exist); confirm/SMTP/redirect must be configured in the
      Supabase dashboard (see `server/.env.example`)

### 5d. Mobile UI standardisation pass (2026-09-03)

Full visual audit of `apps/mobile` against the token/type/component systems built in
§5b. The primitives were sound; the drift was in the screens that restated them. All
changes app-only (`site/` untouched), `tsc --noEmit` clean.

- [x] **`components/ui/Card.tsx` (new)** — the grouped-card chrome (white paper, hairline
      border, `radius.lg`, `elevation.low`, `padding md`) restated in 4 components with
      drifting details; now one surface. Used by Meetup group card, CreateEvent's three
      cards, FeedbackPanel
- [x] **`components/common/TextField.tsx` (new)** — the form-input surface restated 5+
      times with drifting height (46/48/52), border width (1 vs hairline), radius (md/lg)
      and background (surface vs background); now one 48pt/hairline/`radius.md` field with
      an optional `@` prefix. Used by EmailAuth, ProfileConfirm (handle + display name),
      CreateEvent. Chat composers deliberately stay their own rounder register — they
      already matched each other
- [x] **Typography roles enforced** — killed the per-screen `fontSize`/`lineHeight`/
      `letterSpacing` overrides on the mono labels that made kicker/overline/sectionHeader
      interchangeable. Roles are now: screen kicker = `type.overline`, section/group/card
      label = `sectionHeader`, tiny data labels (category kickers, status tape, stat
      labels) = `type.overline`. Touched Discover, Meetup, Profile, EventCard,
      FeedbackPanel, VibeRecapCard, CreateEvent
- [x] **Chevrons standardised on `IconChevronRight`** — text `›` (Discover rows,
      Connections) and `→` (EventCard) replaced with the SVG icon the Profile screen
      already used; dead glyph styles stripped
- [x] **Tokens over raw values** — LINE `#06C755` now `colors.brandLine` (login button +
      `BrandLogos` share it); `borderRadius: 22`/`4`/`999` → `radius.pill` (Discover
      circle buttons, Profile language dot, login floaters); chat timestamp
      `rgba(255,255,255,0.7)` → `colors.nightMuted`
- [x] **Group chat sender labels are handles, not raw ids** — `ChatThread` takes a
      `members` (user_id → handle) map; MeetupScreen passes it, so bubbles read
      `@handle` instead of an 8-char UUID fragment (id fragment kept only as the
      no-data fallback)
- [x] **Form padding unified** — EmailAuth was the only form screen on `spacing.lg`
      horizontal; now `spacing.md` like ProfileConfirm/CreateEvent. Its in-content title
      bumped `title2` → `title1` to match the other editorial headers
- [x] **Dead code removed** — CreateEvent's always-true `●` marker row (`cardSticker`),
      unused `sticker` const, FeedbackPanel's unused `title` style

### 5e. Modernisation + emoji→SVG pass (2026-09-03)

Second visual pass on top of §5d — same boundaries: app-only, no core-page
restructure, `tsc --noEmit` clean after every batch.

**Modernisation (moderate):**

- [x] `spacing.page` (20) token — screen-level containers now breathe at 20pt
      (ProfileConfirm, CreateEvent, EmailAuth, Connections, Meetup, Dm, Discover
      sheet/filter rail, AI chat head/list/composer/trait tray); components keep
      `spacing.md`
- [x] `elevation.card` — cards got their own depth level (softer, slightly
      stronger than `low`), so a grouped card lifts off the page while buttons
      stay flat; `Card` uses it
- [x] Type scale bumps — `headline` 17→18 (button labels), `title1` 28→30,
      `display` 34→36 (meetup hero, profile handle)
- [x] **TextField focus ring** — the field borders coral while focused, so the
      active field is always visible (forms were dead until you typed)
- [x] **ScreenState** — loading/error/empty icons now sit in a tinted rounded
      badge with the accent colour instead of floating grey glyphs (dark variant
      included)
- [x] **Status bar correctness** — `RootNavigator` now renders `expo-status-bar`
      per stage: light icons on the night login ground, dark everywhere else
      (before this the login screen showed dark icons on dark)
- [x] **Headers** — left-aligned titles (iOS-only flag, Android already does it)
      with the bumped headline weight; no divider
- [x] `IconMail` added; the email login button's ✉️ emoji → SVG

**Emoji → SVG (chrome marks only; copy/data content keeps its emoji):**

- [x] **Category system is now SVG** — 9 new stroke icons in `Icons.tsx` (bowl,
      gamepad, palette, mountain, note, leaf, compass, book, dumbbell);
      `categoryMeta.ts` maps category → icon component (replacing the emoji
      glyph map), applied on the meetup hero sticker, event cards, map pins,
      filter chips, create-event chips and the login floaters — every surface
      draws the same mark in the sticker's ink
- [x] **`Chip.icon` takes an SVG element** — the chip tints it to match the label
      (sticker ink / selected white / secondary), so a hot-pink sticker still
      gets legible ink marks
- [x] **Feedback ratings** — 😐🙂🔥 → stroke face/flame icons (`IconFaceMeh`,
      `IconFaceGood`, `IconFire`), keeping the text label; colour-blind safe
      (shape + label)
- [x] `Button.icon` string prop deleted (dead once the last ✉️ went); 👋 dropped
      from `chatEmpty` copy (the `IconWave` already greets)

### 5f. Gen-Z register pass (2026-09-03) — the site's vocabulary, applied

User direction: the design language read "plain old boring"; bring the whole
app onto a modern, clean, Gen-Z register without looking AI-generated. The
reference was already in the repo — the marketing site's pop pass (§4). Mobile
had drifted away from it (§5b's "rectangular slab, no pills, no cards"
grammar diverged from the site's own pill CTA + sticker/tape/marker system).
This pass re-anchors mobile to the site vocabulary, structurally untouched.
`tsc --noEmit` clean; `docs/VISUAL_OVERHAUL.md` updated so docs and code agree.

- [x] **Electric band returns** — `colors.lime` (`#C8FF00`, site `--color-neon`)
      + `colors.limeInk`. Coral stays THE action colour; lime only where the
      site wears it: highlighter marks, tape badges, sticker highlights
- [x] **`Tape` badge** (new, site `.tape-badge`) — mono uppercase, hard offset
      shadow, -2° tilt; lime/coral/night tones. Meetup status tape now wears it
      (open=lime, ongoing=coral, finished=ink) instead of a flat sticker
- [x] **`Marker` highlighter** (new, site `.marker`) — lime band behind short
      display text with ink flip. Worn by the 集まる wordmark on Login and the
      @handle on Profile — the two loudest identity moments, nowhere else
- [x] **Buttons are pills again** (site CTA `rounded-full` + `shadow-accent/20`):
      `primary` = coral pill with coral glow; `neon` = coral pill on a hard
      offset vinyl underlay (site `.sticker-badge`); secondary/tinted follow
      suit. Pills reserved for CTAs — "no pills-everywhere" still holds
- [x] **Profile menus redesigned** — stats row is now one lime vinyl strip with
      hard shadow + ink figures; interests/prefs/account blocks are cards with
      hairline rows; language is a segmented pill control (selected segment
      lime); prefs header gets `IconGlobe`
- [x] **Match score wears the sticker** — Meetup's group-fit % sits on a lime
      sticker with hard shadow instead of plain sage text
- [x] **Discover host CTA** — `+ Host` is a lime vinyl pill (hard shadow)
      popping on the dark sheet
- [x] **Feedback ratings are data stickers** — meh/good/fire chips wear their
      own `{ bg, on }` sticker colour when selected (`colors.rating`), ink
      chosen per colour

### 5g. Editable profile + photos + better group-fit scoring (2026-09-03)

The onboarding confirm page showed the AI's extraction but made it read-only
(only handle/display name were editable), the profile page had no editing at
all, there was no photo upload anywhere, and match scoring used a centroid that
washed out outliers and hard-capped cold-start users. All four closed in one
pass; docs/AI.md §5 and docs/RULES.md §7 stay in force (scoring is
backend-authoritative, demo mirror updated in the same change).

- [x] **Onboarding confirm: interests & personality editable.** New shared
      `components/profile/TagEditor.tsx` — `InterestEditor` (removable chips +
      free-text add field) and `PersonalityEditor` (fixed-vocab toggle chips;
      a stored tag is matched against **all three** locale labels + the canonical
      key, because the AI returns it in the user's chat language; stray
      out-of-vocab tags render as removable chips so nothing is silently
      dropped). Used by both the confirm screen and the profile edit modal so
      the two surfaces behave identically
- [x] **Profile page: same editing.** `ProfileEditModal.tsx` (full-screen
      modal) — display name, handle with the same live availability check as
      onboarding (skipped for the owner's own handle), the two tag editors, and
      a photo button. Saves through `PATCH /users/me`; profile now also
      *displays* personality (tags localised via `traitLabel`, raw when
      out-of-vocab)
- [x] **`PATCH /users/me` accepts `handle` + `personality`** (was display_name/
      avatar_url/interests/language/location only), maps the 23505
      unique-violation to `409 HANDLE_TAKEN`, and **re-embeds the preference
      vector** when interests/personality change (best-effort, same as
      onboarding — matching's tag fallback covers a failed embed). Shared
      `HANDLE_RE` moved to `utils/handle.ts` so onboarding and profile edits
      cannot drift
- [x] **Photo uploads.** `expo-image-picker` installed (plugin + permission
      string in `app.json`); new `POST /users/me/avatar` accepts a base64
      jpeg/png/webp data URL (`modules/users/avatar.ts` — pure `parseDataUrl`,
      5 MB cap, unit-tested), stores it in a public Supabase Storage `avatars`
      bucket (created lazily, one object per user, upsert) and points
      `users.avatar_url` at it. Storage failure → `503 STORAGE_UNAVAILABLE`
      (the `has*` degrade convention). Global `express.json` limit 1mb → 8mb
      so the base64 fits. `Avatar` now renders the photo when `avatar_url` is
      set, everywhere (Discover, Profile, Connections, Meetup); demo mode
      stores the data URL directly
- [x] **Better group-fit scoring** (`modules/matching/score.ts`, docs/AI.md §5):
      the 0.6 cosine term is now a **pairwise mean** against each current member
      (outliers score honestly lower than the centroid did; the caller's own
      vector is excluded), and when either side has no preference vector it
      falls back to set-overlap tag similarity (`tagFit`) — a fresh user is no
      longer hard-capped at 0.40. Weights unchanged (0.6/0.2/0.2). Match-preview
      route fetches per-member vectors + tags and composes via the new
      `matchScore` input; demo mirror updated to pairwise `tagFit`
- [x] i18n `profile.*` (edit/save/changePhoto/uploading/photoError/
      noInterests/addInterest/personalityCap) added in en/ja/zh
- [x] Verified: `npm run typecheck` clean (server + mobile), `npm test` 82 pass
      / 1 skip / 0 fail (new: pairwise fit, tag similarity/fallback, cold-start
      score above 0.40, avatar data-URL validation)
- [ ] **Avatar upload is code-complete, not yet run against live Supabase
      Storage** (same standing as the Mapbox path) — no storage round-trip has
      been exercised. The `avatars` bucket, public URL, and the picker→upload
      flow in Expo Go all need a live run; `exp://10.0.2.2:8081` demo/real
      walkthrough still open

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
| Mapbox token | **Issued 2026-09-04** and written to `apps/mobile/.env` (gitignored). Verified live: the styles endpoint answers 200, and Search Box suggest→retrieve resolves real Shibuya POIs to coordinates. The *renderer* still needs `expo run:android`, because Expo Go can never load the native module — so the radius ring is written and unexercised for that reason, not for want of a credential |
| Venue picker | **Closed 2026-09-04.** Hosting used to post a fixed Shibuya point whatever venue name was typed. `VenuePicker` searches Mapbox Search Box, and the picked place's coordinates go on the meetup. Falls back to the old fixed point, and says so on screen, when no token is configured |
| Push receipts | **Collected since 2026-09-03.** Accepted tickets land in `push_receipts`, and `collectPushReceipts()` reads them back on a later sweep pass (Expo needs ~15 minutes to produce one), retiring a `DeviceNotRegistered` token and discarding a ticket Expo never answers within 24h. Isolated from the rest of the sweep, so a receipt problem cannot fail the stamped work. Unexercised for the same reason as the row below |
| Push in Expo Go | `sendPush` has never delivered: Expo Go dropped Android remote push, and `app.json` has no `extra.eas.projectId`, so no token can be minted. Every notification path is verified up to `pushTargets` returning zero devices, and no further. Real delivery needs `eas init`, FCM credentials and a dev build (§1g) |
| Notification routing | **Fixed 2026-09-03.** The app had no notification listeners at all and nothing joined the payload to `linking.ts`, so a delivered notification would have sat in the tray and opened the last screen. `features/notifications/notificationRouting.ts` + a `getInitialURL`/`subscribe` override now route it. Verifiable today with `scheduleNotificationAsync`; unverified against a real remote push for the row above |
| Socket presence | The chat notice asks `fetchSockets()` whether a member is connected, which sees **this process only**. With two API instances a member connected to the other one reads as offline and gets a redundant push. Needs `@socket.io/redis-adapter` behind `REDIS_URL`, the same way the job queue degrades — the one piece of per-instance state the ephemeral store does not cover |
| Notification caps | The chat debounce and the `last_active_at` throttle run through `services/ephemeral.ts`, so two instances share one window once `REDIS_URL` is set. The persisted daily caps (`bump_quota`) are the backstop either way, and they are per-person, not per-device |
| Migration 006 | `usage_quotas` + `bump_quota` were in the repo but **had never been applied to the live project**, so every `enforceQuota`/`tryQuota` call was silently failing open. Applied 2026-09-03 alongside 007 |
| Single instance | **Addressed 2026-09-03.** Handoff codes, PKCE verifiers, rate-limit counters and the notification debounces moved to `services/ephemeral.ts`, which uses Redis when `REDIS_URL` is set and process memory otherwise, so a second instance is now possible. Untested against a real Redis — `REDIS_URL` is still empty, and the BullMQ sweep driver is unexercised for the same reason |
| Push in Expo Go | `sendPush` has never delivered: Expo Go dropped Android remote push, and `app.json` has no `extra.eas.projectId`, so no token can be minted. The sweep's reminder branch is verified only up to `pushTargets` returning zero devices |
| Single instance | **Addressed 2026-09-03.** Handoff codes, PKCE verifiers and rate-limit counters moved to `services/ephemeral.ts`, which uses Redis when `REDIS_URL` is set and process memory otherwise, so a second instance is now possible. Untested against a real Redis — `REDIS_URL` is still empty, and the BullMQ sweep driver is unexercised for the same reason |
| CORS on Render | **Env var set 2026-09-03** (`CORS_ORIGIN=https://atsumaru-6i3n.onrender.com` in Render dashboard). Active after next manual deploy — the running process still has the old value until then |
| Migration 006 (quotas) | **Not applied to live DB.** `bump_quota` RPC returns `PGRST202`; quotas fail open (no user impact). Apply `006_usage_quotas.sql` via `scripts/sql.mjs` + `notify pgrst, 'reload schema'` when ready |
| `docs/API_STRUCTURE.md` §5–6 | Still references the old OTP screens; `TRD.md` §17 says OAuth is canonical, and the code follows TRD |
| Two extra endpoints | `POST /auth/session` and `POST /users/me/push-token` are not in the contract; both are documented in README and CLAUDE.md |
| Demo mode | `EXPO_PUBLIC_DEMO_MODE=1` runs the app against an in-app stand-in for the API (`src/services/api/demo/`). It duplicates the match formula from `server/src/modules/matching/score.ts` — the two must not drift. `apps/mobile/.env` now ships with `0`, so the app talks to the real API |
| Demo layer gaps | `demo/index.ts` has no `/users/:id` handler, so the Connections list shows `@…` forever in demo mode (confirmed on device, §1d); and connect-picks for unrated members are dropped. Real API mode is unaffected |
| Route-level auth tests | `requireAuth` / `requireMembership` / `requireConnection` throw the right 401/403/404/409 every place they run, but only the pure `canAccessConnection` predicate + auth limiters are under automation. Route-level `User A cannot X` tests need a `db()` injection seam — `mock.module` is unavailable on the installed `node:test`, so a handle in `db/queries.ts` is the next step |
| Event member list | `GET /events/:id(/members)` returns the full member list + public profiles to any authenticated user (member or not). Required for discovery/match-preview pre-join; the tradeoff is an authenticated attacker can map attendance by iterating event ids. Add a §19 browse limiter if scraping appears |
| Chat/DM send limits | **Closed 2026-09-02** — per-user budgets on REST + socket (chat 300/hr, DM 120/hr) and event-create 30/day. `/nearby` read-volume limiter still optional (§19.1 altitude methods) |
| Expo Go vs the header | Expo Go's dev-launcher floating button covers the app's top-right profile avatar circle, so the Profile page cannot be reached in Expo Go at all — the app's own screen is fine, the launcher just wins the tap |
| Mobile loop against the real API | **Closed 2026-08-30** — Google sign-in, onboarding (Groq), discovery, feedback submit, mutual unlock, and the DM thread were all driven live against `:4000`/Supabase with `DEMO_MODE=0` (Pixel emulator, Expo Go, ngrok tunnel; `context.md` §8). Only the DM *send* and the `atsumaru://` deep-link variant remain |
| `schema.sql` drift | It is behind `migrations/001–003`, so a fresh project is missing the `event_sizes` RLS fix and the rest. `004` is **not** part of this drift — it was written into `schema.sql` at the same time. See §5 |
| Vibe recap in demo mode | `EXPO_PUBLIC_DEMO_MODE=1` always takes the `source: "template"` path — there is no Groq offline. The card, traits and privacy line are real; nothing pretends a model ran |
| Avatar upload | Code-complete (base64 → Supabase Storage `avatars` bucket → `avatar_url`), **never run against live Storage** — bucket creation, public URL and the Expo Go picker flow need a live round-trip |

