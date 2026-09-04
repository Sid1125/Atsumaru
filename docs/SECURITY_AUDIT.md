# Atsumaru Security Audit

Source of truth: `ATSUMARU_SECURITY_COMPLETE.md` (84-section security engineering standard).
This report maps the Atsumaru codebase to that standard, records what is verified compliant,
what was fixed during this audit, and what remains open. Line references are as of 2026-09-02.

Run the suite:

```bash
npm test            # 65 unit tests (negative authz, auth/send/event rate limits, JSON-400, turnstile)
npm run typecheck   # server + mobile
```

## Verdict

Strong baseline. The defense-in-depth posture the standard demands is mostly present and
correct: authenticated routes are all behind `requireAuth`; every ID-scoped write is gated by
`requireMembership` / `requireConnection`; `real_name` never leaves the server; RLS is on with
a deny-all default; service-role key stays server-side; OAuth uses signed state + PKCE + one-
time single-use handoff codes; AI is gated to three jobs and never authorizes or unlocks.

Biggest genuine gap was not a live vulnerability but **process**: the standard's §75 Definition
of Done and §62 Required Test Matrix mandate negative/authorization tests, and **none existed**
(11 files, all pure unit tests). This audit added the first negative-authorization tests and
closed the two most exposed §19.1 "Very strict" rate-limit holes, then a second line-by-line
pass added five more findings (rate-limit keying, unbounded limiter map, hardcoded OAuth secret,
`/health` disclosure, malformed-JSON status) and broadcast send/creation limits across chat, DM
and event creation. A third pass then extended the hardening the spec's §19/§22 demand: read
surfaces throttled, persisted per-user usage quotas, and an optional Turnstile auth gate.

> **Deployment note:** production now **fails to boot** unless `AUTH_STATE_SECRET` is a real
> (non-dev-default) value, and `/health` no longer reports which integrations are enabled. Set a
> real `AUTH_STATE_SECRET` before deploying.
>
> **Quotas:** the new `usage_quotas` table + `bump_quota` RPC (migration 006) must be applied to
> the live project, then `notify pgrst, 'reload schema'` — until then the quota call fails open
> and the in-process rate limiters remain the only layer.
>
> **Turnstile:** gated and off by default. Set server `TURNSTILE_SECRET_KEY` + mobile
> `EXPO_PUBLIC_TURNSTILE_SITE_KEY` to enforce; the mobile widget still needs `react-native-webview`
> + a dev build (see Open findings).

## Findings fixed during this audit

| # | Severity | Standard | Finding | Location | Fix |
|---|----------|----------|---------|----------|-----|
| 1 | Medium | §19.1 | Handoff-code exchange, OAuth callback, and OAuth initiation had **no rate limit** — an unauthenticated brute-force/credential-view surface for the 1-minute single-use session codes. | `modules/auth/routes.ts` | IP-keyed limiters: session 20/min (`AUTH_RATE_LIMITS.session`), callback 30/min, provider 30/min; `enforceLimit` throws 429 + `Retry-After`. |
| 2 | Medium | §19.1 | Feedback submission had **no rate limit** — it re-runs connection-unlock processing and drives reputation on every call. | `modules/feedback/routes.ts` | `feedbackLimiter` 10/hr keyed by user (not IP, per §19.2 shared-network warning). |
| 3 | High (process) | §61.4, §62, §75 | **No negative/authorization tests existed.** | — | Extracted `canAccessConnection` as a pure predicate shared by REST + socket; added `db/authorization.test.ts` and `modules/auth/authRateLimit.test.ts`. |
| 4 | Medium | §19.3 | Auth rate limits were keyed on `X-Forwarded-For`, an attacker-controlled header — anyone could rotate it to reset budgets, or point it at a victim to burn theirs. | `modules/auth/routes.ts` `clientIp` | `X-Forwarded-For` trusted only when `TRUST_PROXY=true` is set; otherwise keyed on the socket's `remoteAddress`. |
| 5 | Low | §7, §19 | The in-memory limiter's counter map was **never pruned** (the `prune()` method was unreachable in production) — a rotating-IP attacker grows memory without bound. | `utils/rateLimit.ts` | Each limiter registers an `unref`'d `setInterval` that prunes expired keys on its own window. |
| 6 | Medium | §5.4, §41 | `AUTH_STATE_SECRET` had a hardcoded dev default and production only **warned** — a forgotten default would ship, signing OAuth state with a known key. | `config/env.ts` | Production now **fails to boot** when the secret is still the dev default. |
| 7 | Low | §20 | `/health` disclosed integration + OAuth provider config booleans to any unauthenticated caller. | `index.ts` | `/health` now returns liveness (`{status:"ok"}`) only; ops state lives in startup logs. |
| 8 | Low | §43, §62 | Malformed JSON (body-parser error) fell through to a 500 `INTERNAL_ERROR` — a client mistake read as a server fault. | `middleware/errorHandler.ts` | Body-parser `entity.parse.failed` mapped to 400 `INVALID_JSON`; unknown errors still degrade to a generic 500. |
| 9 | Medium | §19.1 | Group chat, DM, and event creation had **no send/creation rate limit** — a member could flood a room/DM or fill the map with event noise. | `modules/chat/routes.ts`, `modules/connections/routes.ts`, `modules/events/routes.ts`, `socket/index.ts` | Per-user budgets: chat 300/hr (REST + socket), DM 120/hr (REST + socket), event-create 30/day. |
| 10 | Low | §19 | Read surfaces were unthrottled — any authenticated user could page the whole event/roster/profile table in seconds, bypassing per-write limits. | `utils/readLimit.ts` + all GET handlers | One shared per-user read budget (240/min, `READ_RATE_LIMIT`) applied to every discovery/profiling read: `/events` (nearby, mine, id, members, match-preview), `/connections`, chat + DM history, `/users/:id`, onboarding handle probes, recap. |
| 11 | Medium | §19.1 | Rate limits were in-memory only — recycling the process reset every budget, and there was no cumulative per-user allowance for the write/cost surfaces. | migration `006_usage_quotas.sql`, `utils/quota.ts` | Persisted `usage_quotas` table + atomic `bump_quota` RPC (daily, survives restart): events-created 30/day, feedback-submitted 200/day, groq-turns 500/day. Recap fails **open** to its template on quota (never 429s a passive card). |
| 12 | Medium | §22 | The auth handoff had no human-vs-bot gate; only IP + single-use-code limits. | `modules/auth/turnstile.ts`, `auth/routes.ts` | Optional Cloudflare Turnstile. When `TURNSTILE_SECRET_KEY` is set, `POST /auth/session` requires a valid widget token for **email-origin codes** (`CAPTCHA_FAILED` 403 otherwise); OAuth codes are exempt — they only exist after a provider round trip (PKCE + signed state + binding cookie), so the deep-link handoff needs no widget. Signup/password-reset also gate (fail closed, `503 CAPTCHA_REQUIRED` unconfigured); server-side `siteverify` only. Off by default (no keys → no challenge). |
| 13 | Info | §22 | The Turnstile *client* is wired but the widget module cannot run in Expo Go. | `apps/mobile/src/services/auth/turnstile.ts` | Gated exactly like Mapbox/Keystore: `acquireTurnstileToken()` returns undefined until a site key AND `react-native-webview` + dev build are present. Widget implemented (2026-09-04, TRACKER §5k) and mounted on the email auth screen only — OAuth needs no token. |

## Standard-map (verified compliant)

### §6-7 Authentication & session
- OAuth state is HMAC-signed with TTL and verified before exchange (`oauth.ts` `signState`/`verifyState`), real-callback expiry enforced.
- PKCE: verifier stashed, challenge sent, verifier claimed **once** (`claimVerifier`) — a replayed callback cannot redeem twice. `stashVerifier`/`claimVerifier`.
- Handoff codes are one-time (`claimSession`) with a 60s window; tokens never travel in a redirect URL — the app trades `code` for the session.
- Provider linking, never twinning: `isEmailTaken` + `sessionForIdentity` (synthetic `@oauth.atsumaru.invalid` never links).
- Session-minting never runs on the shared `db()` client; `authDb()`/`authClient()` is a throwaway client (§7).
- Client: access token in SecureStore only (`services/storage/session.ts`), Bearer injected by one interceptor, never logged.

### §8-10 Authorization, matrix, user/profile
- `requireAuth` on every protected route; `requireConnection` guards DMs (mutual + participant) in both REST and socket; `requireMembership` guards chat + feedback.
- No mass assignment: create-event binds `host_id: req.userId!` from JWT, never the body; users PATCH uses an allowlist schema (can't set `reputation_score`/`handle`/`real_name`); onboarding `complete` allowlisted.
- `real_name` never leaves: every user read via `PUBLIC_USER_COLUMNS`; `CONNECTION_COLUMNS` explicit.

### §11-15 Events, chat, connections, feedback, reputation
- Event creation schema-validated; capacity enforced atomically server-side (`join_event` RPC, migration 002 capacity-before-status), never read-then-insert.
- Chat: membership-gated REST + socket; persist-then-broadcast so history and stream agree.
- Feedback: membership + completed-status gate; `firstSubmission` gates reputation + preference learning so resubmission cannot farm or tank; ratings validated to group members only; picks require a matching rating; non-mutual picks never revealed; unlock only where both sides picked.
- `sanitizeRecap` rejects model-invented handles (§14, §26).

### §16-18 Input validation, injection, SSRF
- zod on every body/query; geo as `{lat,lng}` numbers, injected into `SRID=4326;POINT(lng lat)` only after validation. No dynamic SQL with user input; no `SELECT *`; explicit projections.
- Socket messages length-gated (1–2000) before any DB work; `typing` room spoofing prevented by `socket.rooms.has(room)`.
- No server-side URL fetch of user input on the SSRF surface (the only fetch targets are fixed third-party AI endpoints).

### §21 Database
- RLS **on with zero policies** = deny-all for anon/authenticated keys; API works under service-role only.
- service-role key is server-side only, never in the mobile bundle, gitignored, absent from `git ls-files`.
- Constraints: `events.max_size 4–6`, `connections.user_a < user_b`, PKs, FKs (messages→connections FK cascade, migration 001).

### §26-30 AI
- Groq exactly two jobs (`onboardingChat`, `vibeRecap`), HF one (`embed`). **No AI in chat** — chat/DM/sweep are validate-persist-broadcast only (§10 of docs/AI.md).
- AI never authorizes/unlocks; matching is backend-authoritative in `score.ts`; the app displays a score it never computes.
- Recap is per-user from the caller's own feedback; `RecapPrompt` is the privacy boundary; `templateRecap()` floor on Groq failure.

### §32, §41 Mobile + secrets
- No secrets in the bundle: only `EXPO_PUBLIC_*` public config; `SUPABASE_URL`/`SUPABASE_ANON_KEY` are the **public** anon values (and are currently unused dead exports).
- `.env` files gitignored; no secret in `git ls-files`; tokens SecureStore-only; `real_name` never present client-side at all.

### §42-43 Errors & logging
- `ok()`/`HttpError` envelope; `dbError` logs Postgres text and never returns it; OAuth failure logs message-only (tokens never logged); generic 500 otherwise.

## Open findings

| # | Severity | Standard | Finding | Notes |
|---|----------|----------|---------|-------|
| 4 | Low/Product | §9, §20, §46 | `GET /events/:id`, `/events/:id/members`, and `/:id/match-preview` return the full member list + public profiles (and pre-join score) to **any authenticated user**, member or not. | Required for discovery + match-preview pre-join. Tradeoff: lets an authenticated attacker enumerate event IDs → map attendance. Read volume is now capped by the shared per-user read limiter (finding 10); per-endpoint browse budgets can be added if scraping appears. |
| 5 | Low | §20 | Handle/profiles reveal account existence; the pre-onboarding handle check is behind auth (good). | Acceptable; matches public-profile product model. |
| 6 | Low | §12 | Failed socket room joins echo `{ code, event_id | connection_id }`, confirming resource existence. | Guard is correct; only existence leaks via error payload. |
| 7 | Resolved | §19.3 | Chat/DM send rate limiting (spam) not implemented. | Resolved in this pass — per-user budgets on REST + socket (chat 300/hr, DM 120/hr). Read-volume/scraping now also capped by the shared per-user read limiter (finding 10). |
| 8 | Low | §43.2 | No correlation ID on log lines. | Add when observability is built (§71). |
| 9 | Info | §22 | Sweep stamps idempotency columns **after** the side effect (not atomically); a second driver (BullMQ) can double-notify. | Documented in CLAUDE.md. Fix before setting `REDIS_URL`. Feedback unlock read→insert / `firstSubmission` count→upsert have benign TOCTOU races protected by `onConflict`. |
| 10 | Info | — | `SUPABASE_URL`/`SUPABASE_ANON_KEY` exported in `apps/mobile/src/config/env.ts` are dead (no importers). | Not a secret leak (anon is public); delete or wire up. |
| 11 | Info | §22 | Turnstile client widget needs `react-native-webview` + a dev build (Expo Go can't load it). | Widget implemented 2026-09-04 (`TurnstileWidget.tsx` + `turnstileToken.ts`, TRACKER §5k) and mounted on the email auth screen; OAuth codes are exempt server-side so the OAuth path never needs it. Server-side verification is complete and unit-tested for the degrade path; real-device mint still unexercised. |

## §62 test-matrix coverage today

Automated (this audit): missing-token → 401, negative authz (DM non-participant / non-mutual / missing),
auth rate-limits enforced with the tightest budget on session exchange, X-Forwarded-For not trusted by
default, malformed-JSON → 400, per-user limiter spacing, Turnstile-degrade pass when unconfigured.

Still manual / not covered (all the ordinary-user-vs-B failures below are **already coded** but
not under automation):
- Authorization: `User A cannot edit User B`, `client cannot modify reputation/match score`,
  `non-member cannot read/send group chat` (logic present; needs route-level harness).
- Socket: unauthorized room join / cross-event / cross-DM rejection (code present in `socket/index.ts`).
- API: SQL-injection / invalid-UUID fuzz cases (zod covers, no negative tests).
- Database: RLS anonymous/User A/User B, service-role isolation (needs live Supabase + `seed`).

Setting up route-level negative tests (`User A cannot X`) requires a test seam on the `db()`
singleton (`mock.module` is unavailable on the installed `node:test`). Recommend introducing an
injectable db handle in `db/queries.ts` when integration tests are wired.

## Secured-in-code invariants worth locking with tests later

- Only mutual pairs create a connection and are ever revealed (REST + socket + recap).
- Reputation moves only via server `applyReputation`, gated to first feedback submission.
- Match score computed server-side only; client displays, never computes.
- Location is one-shot for nearby discovery; no background tracking; `join_event` is atomic.
