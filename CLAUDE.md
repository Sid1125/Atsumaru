# CLAUDE.md

Atsumaru (集まる) — friendship-first social discovery for Japan. Docs in `docs/` are
the spec; when code and docs disagree, docs win (`TRD.md` is canonical for auth).
`TRACKER.md` holds what is built, what is unverified, and what is next — update it when
you finish or start a piece of work.

## Layout

```text
apps/mobile/   Expo SDK 57 / RN 0.86 / React 19 client (TypeScript)
server/        Node 25 + Express 5 + Socket.io API (NodeNext ESM)
server/db/      schema.sql — Postgres + PostGIS + pgvector, paste into Supabase
docs/          PRD, TRD, RULES, API_STRUCTURE, AI, DESIGN, FRONTEND
```

## Commands

```bash
npm run server      # API on :4000  (health: /health)
npm run mobile      # Expo dev server
npm test            # node --import tsx --test on server/src/**/*.test.ts
npm run typecheck   # both packages (incl. tests + scripts) — run before calling work done
npm run seed        # demo users/meetups; -- --tokens prints access tokens, -- --reset clears
```

On Windows use `http://127.0.0.1:4000`, not `localhost`, when curling the API.

## Conventions

- Server imports use the `.js` extension (NodeNext ESM), even from `.ts` files.
- Every response goes through `ok()` / `HttpError` in `utils/response.ts`:
  `{ success, data }` or `{ success, error: { code, message } }`. Supabase failures
  use `throw dbError(error)` — Postgres text is logged, never returned.
- Route handlers wrap in `asyncRoute`; read path params via `param(req, "id")` and
  paging via `pageParams(req.query)` (`utils/request.ts`). Message lists return
  `{ messages, page, limit, total }`.
- All shared data access lives in `server/src/db/queries.ts`. Reuse `findEvent`,
  `findMembers`, `publicUser`, `requireMembership`, `requireConnection`,
  `listMessages`, `insertMessage` rather than querying tables from a route.
- Validate every request body with zod. Geo goes in and out as `{ lat, lng }`;
  in SQL it is `SRID=4326;POINT(lng lat)`.
- PostGIS/pgvector and anything needing a transaction go in `schema.sql` as a
  function called through `rpc()` (`events_nearby`, `event_detail`,
  `events_for_user`, `join_event` — joining is atomic, never read-then-insert).
  `event_status()` derives `ongoing`/`completed` from `start_time`; never recompute a
  meetup's status in TypeScript.
- Vectors are pgvector `vector(384)` (MiniLM); round-trip with `parseVector` /
  `serializeVector`.
- Matching is backend-authoritative in `modules/matching/score.ts`:
  `0.6*cosine + 0.2*group_balance + 0.2*normalized_reputation`. The app displays the
  score, never computes it. Reason strings come from `modules/matching/reasons.ts`
  in the member's own language.
- Shared unions live in `server/src/types.ts` (`Language`, `LANGUAGES` for zod).
- Auth is an OAuth bridge, not Supabase's client flow: `modules/auth/oauth.ts` holds the
  provider table and the HMAC-signed `state`, `modules/auth/session.ts` maps a provider
  subject to a Supabase session. Add a provider there, not in a route.
- Post-meetup work lives in one idempotent `runSweep()` (`jobs/sweep.ts`); `jobs/index.ts`
  drives it with BullMQ when `REDIS_URL` is set and a timer otherwise.
- Client state: TanStack Query for server data, Zustand for local UI state.

## Non-negotiables (docs/RULES.md)

- `real_name` never leaves the server. Select users via `PUBLIC_USER_COLUMNS`.
- Access tokens live in SecureStore only — never AsyncStorage, never logged.
- Feedback is private. Only mutual picks create a connection; never reveal who rated
  whom or who did not pick someone.
- Location is one-shot, for nearby discovery only. No background tracking.
- AI output is untrusted input: validate extraction, and never let it authorize,
  unlock connections, or write records without backend checks.
- Never commit `.env`, Supabase service-role keys, OAuth secrets, or Mapbox tokens.

## Beyond the contract

Two endpoints are not in `docs/API_STRUCTURE.md` but are required by flows it
describes: `POST /api/auth/session` (one-time code handoff, so OAuth tokens never sit in
a redirect URL) and `POST /api/users/me/push-token` (device registration for the
feedback reminder). Keep both documented in README when they change.

## Not implemented

Mobile: OAuth login wiring, DM/connections screens, push registration, create-event UI,
settings. `@rnmapbox/maps` needs a native dev build plus a token; without both,
`EventMap` renders a placeholder on purpose.



## Codex Review

All work produced, will be thoroughly reviewed by **Codex**.

Codex will review the implementation for correctness, code quality, architecture, security, UI/UX consistency, adherence to the project documentation, and potential bugs or regressions.

Any issues identified during the review will be addressed before the implementation is considered finalized.

