# CLAUDE.md

Atsumaru (集まる) — friendship-first social discovery for Japan. Docs in `docs/` are
the spec; when code and docs disagree, docs win (`TRD.md` is canonical for auth).
`TRACKER.md` holds what is built, what is unverified, and what is next — update it when
you finish or start a piece of work. `context.md` carries the live state of whatever
task is in flight; read it first if one is.

Product loop: AI onboarding → nearby meetup on a map → 4–6 person group → group chat →
private post-meetup feedback → mutual-only 1:1 unlock → better future matching.

## Layout

```text
apps/mobile/   Expo SDK 57 / RN 0.86 / React 19 client (TypeScript) — the product
server/        Node 25 + Express 5 + Socket.io API (NodeNext ESM) — authoritative
server/db/     schema.sql — Postgres + PostGIS + pgvector, paste into Supabase
site/          Next.js 16 + Tailwind v4 marketing site (separate app, own deps)
docs/          IDEA, PRD, DESIGN, TRD, FRONTEND, RULES, API_STRUCTURE, AI, PROJECT_STRUCTURE
graphify-out/  Generated code-graph artifact. Never hand-edit; regenerate or ignore.
```

WIRING.md is the how-it's-wired + boot map; README.md is marketing. Docs in `docs/`
still rule on disagreements.

Three npm packages, no workspaces: `server`, `apps/mobile`, and `site` each install
separately. `npm run setup` installs the first two only — `site` needs its own
`npm install` inside `site/`.

## Commands

```bash
npm run server      # API on :4000  (health: /health)
npm run mobile      # Expo dev server
npm test            # node --import tsx --test on server/src/**/*.test.ts
npm run typecheck   # server + mobile (incl. tests + scripts) — run before calling work done
npm run seed        # demo users/meetups; -- --tokens prints access tokens, -- --reset clears

cd site && npm run dev     # marketing site on :3000
cd site && npm run build   # also type-checks the site; there is no separate typecheck script
cd site && npm run lint

# DDL against the live project, without the dashboard. Needs SUPABASE_ACCESS_TOKEN and
# SUPABASE_PROJECT_REF in the environment (values in access_token.txt, gitignored).
node scripts/sql.mjs -f server/db/migrations/001_hardening.sql
node scripts/sql.mjs -c "select count(*) from events"
```

`npm run typecheck` does **not** cover `site/` — type-check it with `next build`.
On Windows use `http://127.0.0.1:4000`, not `localhost`, when curling the API.
The root `server` script proxies `npm run dev --prefix server`; there is no
`server/package.json` script literally named `server`.

## Database

Live project `ucxgvtcqoeazuhsgwbhf` (`ap-northeast-1`). `schema.sql` is the base; each
change after it is a numbered file in `server/db/migrations/` **and** a corresponding
edit to `schema.sql`, so a fresh project gets the same result in one paste. PostGIS and
pgvector live in the `extensions` schema, not `public` — `search_path` already covers it,
so unqualified `st_dwithin` resolves, but an explicit cast needs `extensions.vector`.

New functions are invisible to PostgREST until its schema cache reloads. After a
migration that adds one, run `notify pgrst, 'reload schema'` or the REST call 404s with
`PGRST202` while the function plainly exists in Postgres.

A free project pauses after ~7 days idle, so `.github/workflows/keepalive.yml` pings
`ping_keepalive()` once a day with the anon key. Keep the service-role key out of CI.

## Server conventions

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
  `events_for_user`, `join_event`, `create_event` — joining and hosting are both
  atomic, never read-then-insert, and hosting writes the event plus the host's
  membership together).
  `event_status()` derives `ongoing`/`completed` from `start_time`; never recompute a
  meetup's status in TypeScript.
- Vectors are pgvector `vector(384)` (MiniLM); round-trip with `parseVector` /
  `serializeVector`.
- **Groq has exactly two jobs and HuggingFace one**, all in `services/ai.ts`:
  `onboardingChat` (the conversational host), `vibeRecap` (the post-meetup recap), and
  `embed` (interests + personality → `preference_vector`). Matching and feedback *consume
  and update* that stored vector arithmetically — no service call. **Group chat, DMs, and
  the sweep touch no model at all**: `modules/chat/routes.ts`,
  `modules/connections/routes.ts` and `socket/index.ts` validate, persist, broadcast, fire
  a push notice at recipients with no live socket, and nothing else — no summarisation,
  sentiment, smart replies, or embedding of messages (`docs/AI.md` §10). The notice sends
  the sender's own text, truncated; putting AI in chat is a product change, not a refactor.
- The vibe recap (`modules/recap/`, `docs/AI.md` §6a) is **per-user, not per-meetup**: it
  is built from the caller's own feedback rows, so two members see different text and
  neither can infer the other's picks. `RecapPrompt` is the privacy boundary — anonymised
  traits, a count, and the category, with no field a handle could occupy — and
  `sanitizeRecap` rejects a model answer that invents one. Groq failing is **not** an
  error here: `templateRecap()` is the floor, because a recap is passive and an empty card
  reads as a bug. `meetup_recaps.source` records which path ran.
- Matching is backend-authoritative in `modules/matching/score.ts`:
  `0.6*cosine + 0.2*group_balance + 0.2*normalized_reputation`. The app displays the
  score, never computes it. Reason strings come from `modules/matching/reasons.ts`
  in the member's own language.
- Shared unions live in `server/src/types.ts` (`Language`, `LANGUAGES` for zod).
- Auth is a hybrid, not one flow: **Google is brokered by Supabase Auth over PKCE** (client
  id/secret in the Supabase dashboard, `pkcePair` + `supabaseAuthorizeUrl` in
  `modules/auth/oauth.ts`, redeemed by `sessionFromSupabaseCode` in `session.ts`), while
  **LINE is exchanged by the API** because Supabase has no LINE provider. Both end at the
  same one-time handoff code, so the app has a single code path. Add a provider in
  `oauth.ts`/`session.ts`, not in a route.
- Three redirect URLs must agree, and they live in three different places: the Google
  console holds Supabase's `/auth/v1/callback`, `OAUTH_CALLBACK_URL` holds *our* callback,
  and Supabase → Auth → URL Configuration → Redirect URLs must list that callback.
  Miss the last one and GoTrue redirects to **Site URL** instead — the browser lands on the
  wrong host with a perfectly valid `?code=`, which looks exactly like an app bug.
- A provider address that already has an account is **linked**, never twinned
  (`isEmailTaken` in `session.ts`). Only real provider-supplied addresses link; a synthetic
  `@oauth.atsumaru.invalid` one never does. `is_new` means "no profile row yet" on both
  providers.
- Socket handlers check membership/connection and persist **before** broadcasting, so
  REST history and the live stream never disagree. Rooms: `group:{event_id}`,
  `dm:{connection_id}`, `user:{user_id}` (the last for server pushes such as
  `match:unlocked`, sent through `emitToUser`).
- Meetup-cycle work lives in one idempotent `runSweep()` (`jobs/sweep.ts`); `jobs/index.ts`
  drives it with BullMQ when `REDIS_URL` is set and a timer otherwise. Both drivers run
  the same body — if Redis is unreachable the API logs it and degrades to the timer. Each
  side effect **claims** its idempotency stamp (`claim()`) before running, so two drivers
  cannot double-notify; never stamp after the effect. A new pass goes *inside* `runSweep()`
  with its own stamp, never on a second queue: the BullMQ worker ignores `job.name`, so a
  second scheduler would just re-run the same body.
- Anything short-lived and keyed goes through `services/ephemeral.ts` — OAuth handoff codes,
  PKCE verifiers, rate-limit counters, notification debounces. Same two-backend shape as the
  sweep: process memory by default, Redis when `REDIS_URL` is set, degrading to memory on a
  Redis error. Never add a new module-level `Map` for this kind of state; that is what kept
  the API to one instance.
- **Notifications all go through `notify()` in `services/notifications.ts`** — five types
  (`feedback`, `meetup_soon`, `chat`, `nearby`, `reengagement`), and the gate applies quiet
  hours, then the per-type opt-out, then the persisted daily cap, in that order (the cap
  spends budget, so it must not be spent on something a cheaper check would drop). Copy is
  server-side in `push.ts`, in all three languages. Every payload carries a `url`, because
  React Navigation's linking reads URLs and never a notification's `data`.
  `docs/TRD.md` §14 is the spec.
- A notification may name a co-member (they already share a group chat) using
  `display_name`, and may state only what the query proves. Never from `feedback` or
  `connections`, and never a claim that someone is waiting for or missing anybody.
- Every integration degrades to a 503 instead of crashing: no Supabase →
  `DB_UNAVAILABLE`, no `GROQ_API_KEY` → `AI_UNAVAILABLE`, no `HUGGINGFACE_API_KEY` →
  `EMBEDDING_UNAVAILABLE`, no provider credentials → `AUTH_PROVIDER_UNAVAILABLE`. Keep
  new ones behind a `has*` flag in `config/env.ts`.
- **Never call `auth.verifyOtp` / `auth.signIn*` on the `db()` client.** supabase-js
  resolves PostgREST's `Authorization` header through `auth.getSession()`, so minting a
  session on the shared singleton demotes every later query in the process to that user
  and hits the deny-all RLS. Use `authDb()` (`db/queries.ts`), which hands back a
  throwaway client.
- Third-party endpoints and model ids drift and fail silently. `api-inference.huggingface.co`
  was retired, and `llama-3.3-70b-versatile` was decommissioned — both looked like working
  code. Verify against the live service, not the docs.

## Demo mode (mobile)

`EXPO_PUBLIC_DEMO_MODE=1` in `apps/mobile/.env` runs the whole app against
`src/services/api/demo/` instead of the API — no server, database, or credentials. It
exists so the meetup loop is demonstrable before Supabase is provisioned.

- The switch is **one branch in `services/api/client.ts`** and a matching one in
  `services/socket/index.ts`. Screens, hooks, and query keys are identical in both
  modes; setting the flag to `0` removes the demo layer from the call path entirely.
- `demo/index.ts` stands in for the *server*, so it legitimately holds server-side
  logic (match scoring, mutual unlock). It mirrors
  `server/src/modules/matching/score.ts` — change the formula in both places, and never
  move scoring into a component (`docs/RULES.md` §7).
- `demo/world.ts` mirrors `server/scripts/seed.ts` and lives on `globalThis` so Fast
  Refresh cannot desync it from the Zustand auth store.
- Completing onboarding adopts the new user into one upcoming and one completed meetup
  and pre-seeds `@harucafe`'s reciprocal pick, so the first feedback submission produces
  a genuine mutual unlock.
- Product rules hold inside the demo layer too: no `real_name` exists in that world at
  all, and only reciprocated picks ever surface.

## Running on an Android emulator

- `config/env.ts` defaults the API host to `10.0.2.2` on Android — an emulator resolves
  `localhost` to itself. A physical device needs the LAN IP in `EXPO_PUBLIC_API_URL`.
- `adb` is not on PATH here: `~/AppData/Local/Android/Sdk/platform-tools/adb.exe`.
- **A redbox is not a logcat `FATAL`.** Grepping logcat for crashes returns clean while
  the app is dead on a redbox — screenshot (`adb exec-out screencap -p`) to confirm what
  is actually on screen.
- `expo-notifications` must never be imported at module scope: Expo Go dropped Android
  remote push in SDK 53 and the failure escapes `try/catch`. Gate on
  `Constants.executionEnvironment` (see `usePushRegistration.ts`).
- `atsumaru://` deep links do not route in Expo Go; they need a dev build. In Expo Go the
  OAuth handoff goes to `exp://<host>:8081/--/auth`, and **that host must be the one Expo Go
  loaded the bundle from** — `APP_AUTH_REDIRECT` has to match or the redirect lands nowhere
  and the app silently keeps its old session.
- **Open the project as `exp://10.0.2.2:8081`.** Metro mirrors whichever host it was asked
  on into `hostUri`, so launching from a virtual-adapter IP (Hyper-V/WSL, e.g.
  `192.168.236.1`) yields a bundle URL the emulator cannot route: Expo Go spins on its own
  blue loader forever and logcat says `Cannot connect to Expo CLI`. That spinner is Expo
  Go's, not `ScreenState` — the app never started.

## Design system (mobile)

The UI follows Apple's fluid-interface and typography guidance. Import tokens from
`src/theme` — never a raw hex, spacing number, or ad-hoc animation constant.

- **Type** (`theme/typography.ts`): use the `type` roles. Tracking and leading are
  **size-specific** — display sizes carry negative tracking, caption sizes positive.
  Never reuse one letterSpacing across sizes. `typography` is the deprecated old scale,
  kept only until the last caller migrates. `type.kicker` / `sectionHeader` are the
  site's mono editorial labels (system fixed face, uppercase, wide-tracked).
- **Sticker palette** (`theme/colors.sticker`): category colours are **data-encoded** —
  one `{ bg, on }` per category, keyed to the site's electric band, shared by card, map
  pin, filter chip and meetup hero via `src/categoryMeta.ts` (the single glyph/colour
  source — never add a per-screen category map). Colour always pairs with glyph + label
  text. `components/ui/Sticker` renders the site's hard offset vinyl shadow as a plain
  offset underlay (cross-platform; RN `elevation` cannot).
- **Motion** (`theme/motion.ts`): specify springs as Apple's **damping + response**
  (`springs.standard/snappy/sheet/momentum/celebrate`), not raw stiffness. Default to
  critically damped (no overshoot); add bounce **only** where the gesture carried
  momentum. Timed curves are for non-gesture fades only.
- **Gestures**: track 1:1 from the live (presentation) value so a moving element can be
  grabbed and reversed mid-flight; on release, project momentum with `projectDecay`,
  pick the target with `nearestSnap`, then hand the release velocity to the spring.
  Resist at edges with `rubberband` — never a hard stop. Animate X and Y as independent
  springs.
- **Press feedback lands on press-*down*** — `PressableScale` is the primitive for every
  tappable surface. It does not emit `opacity` unless it owns it, so callers can style
  their own states; express disabled with colour, not opacity.
- **Reduced motion** (`useReducedMotion`) means a gentler equivalent, not no feedback.
  Note the Android emulator usually reports it **on**.
- **Materials**: `components/ui/Material` for translucent chrome with content passing
  underneath. Blur is iOS-only by design; Android and reduced-transparency get a tinted
  solid, which reads better than weak fake glass.
- Every user-facing state must survive colour-blindness: emoji and colour always pair
  with text (`docs/DESIGN.md` §10).

## The map

Two renderers, one branch: `MapSurface.tsx` picks Mapbox when `hasMapbox()` and the
hand-authored vector city otherwise. Both take the same props and draw the same
`PinBody`, so pins, selection and opening a meetup are identical — only the ground
changes. Framing numbers shared by both live in `framing.ts`.

- **`mapbox.ts` is the only file allowed to touch `@rnmapbox/maps`.** It throws from
  module scope when the native module is missing, so a top-level `import` anywhere in
  `src/` kills the bundle in Expo Go; it is loaded through a deferred `require()` there
  instead. Same shape as `usePushRegistration.ts`, and mandatory for the same reason.
- Mapbox needs **both** a `pk.*` token and a dev build. Expo Go can never have the native
  module, so it always gets the vector city — which is a complete map, not a placeholder,
  and is why a missing token is a change of renderer rather than a broken screen.
- Mapbox positions annotations in screen space itself, so **only the vector map
  counter-scales its pins** against zoom (`counterScale` on `PinBody`). `PIN_BOX` /
  `PIN_POINT_Y` are what let a `MarkerView` anchor the stem's point on the coordinate;
  the label is inside the box because Android clips a `MarkerView` child drawn outside it.
- Discover floats chrome over the top of the map and rests a sheet on the bottom, so the
  visible band is neither the view's centre nor its full height. Mapbox feeds `framing.ts`
  to camera padding; the vector map clamps its pan against it — using the full view height
  silently clamps away any attempt to frame content.
- The 5 km search radius is drawn **only on Mapbox** (`radius.ts` → `ShapeSource`, a real
  coordinate polygon, never a `CircleLayer` — its radius is screen pixels, so it would hold
  its size while the ground moved). The vector city models a 3.35 x 3.33 km slice, so a 5 km
  radius wants 10 km across, three times its whole world: the ring's edge is unreachable at
  any zoom and only a flat tint would render. That difference is measured, not an oversight.
- **Mapbox Search Box, not the Geocoding API**, powers the venue picker
  (`services/places.ts`, the single gate). And it must send `language=ja`: with `en` or `zh`
  the same query returns wards instead of venues, because Japan's POI index is
  Japanese-language. Threading `i18n.language` through is the change that silently turns a
  venue picker into an administrative-area picker.
- Panning the Mapbox map refetches nearby meetups on settle (`docs/FRONTEND.md` §9):
  gesture-driven moves only, past a 400 m threshold, so framing cannot feed itself a
  fetch. The panned centre is held separately from the location fix — panning changes what
  is queried, never the one-shot read (`docs/RULES.md`).
- Vector city internals: `geo.ts` holds the projection and generated street network,
  `MapCanvas.tsx` is the memoised static SVG. **Never re-render the canvas during a
  gesture** — the gesture layer transforms the container so panning stays on the
  compositor.

## Hardware-backed device identity

A per-install ECDSA P-256 key generated inside the Android Keystore (private key
non-exportable, StrongBox where the hardware exists), proven to the server **once at
sign-in** by signing a challenge nonce — verify-at-login, not per-request (`context.md`
§16 for the TEE decision vs Nitro Enclaves). The client is the TEE; the server stores the
uploaded SPKI and verifies the signature, so the key is not theater.

- **Native module**: `android/app/src/main/java/com/atsumaru/app/keystore/`
  (`AtsumaruKeystoreModule` + `AtsumaruKeystorePackage`), hand-registered in
  `MainApplication.kt` — it lives in-app so it cannot be autolinked. **Needs an
  `expo run:android` dev build to run; Expo Go never has it.**
- **One TS gate**: `services/deviceIdentity/keystore.ts` is the only file that reads
  `NativeModules.AtsumaruKeystore`, and the only place that decides availability —
  exactly the `mapbox.ts` deferred-require / Expo Go-safe convention. Every caller treats
  a missing module as "unavailable" and degrades silently; never import the native module
  anywhere else.
- **Orchestrator**: `services/deviceIdentity/deviceIdentity.ts` — SecureStore
  per-install id, `registerDeviceIdentity()` = register SPKI → GET challenge (32-byte
  hex nonce, ~2-min TTL, single-use) → sign raw bytes → verify. `hexToBase64` converts
  the hex nonce to base64 **raw bytes**, matching the server's
  `Buffer.from(nonceHex, "hex")`. Best-effort: **never throws, never blocks sign-in**;
  `DEMO_MODE` short-circuits to `{ verified: true }`.
- **Server**: `verifyDeviceSignature(spki, nonceHex, sig)` in
  `modules/users/deviceIdentity.ts` uses `node:crypto` SHA256 with the stored SPKI —
  pure, unit-tested. Routes `POST /users/me/device`, `GET /users/me/device/challenge`,
  `POST /users/me/device/verify` in `modules/users/routes.ts`. Table `device_keys`
  (migration `005_device_keys.sql` + schema mirror), RLS on, one pending challenge per
  device so a stale signature cannot be replayed.
- **Deliberate scope**: no per-request signing, no lock-screen/biometric gate
  (`setUserAuthenticationRequired(false)`), no Play Integrity attestation — each is a
  named follow-up, not a regression.

## Mobile conventions

- Client state: TanStack Query for server data, Zustand for local UI state
  (`useAuthStore`, `useUiStore`, `useOnboardingDraft`). Do not mirror the server in Zustand.
- Screens never call `fetch`/`axios`: everything goes through `services/api/client.ts`,
  which injects the Bearer token and unwraps the envelope into `ApiError`.
- One shared socket in `services/socket/index.ts` — `connectSocket`, `onServerEvent`
  (returns an unsubscribe), `socketActions`. Never open a second connection.
- Every network-backed view renders `ScreenState` for loading/error/empty; no blank screens.
- All user-facing strings come from `src/i18n/locales/{en,ja,zh}.json`. Adding a string
  means adding all three.
- Theme tokens (`colors`, `spacing`, `radius`, `typography`) live in `src/theme/index.ts`.

## Non-negotiables (docs/RULES.md)

- `real_name` never leaves the server. Select users via `PUBLIC_USER_COLUMNS`.
- Access tokens live in SecureStore only — never AsyncStorage, never logged.
- Feedback is private. Only mutual picks create a connection; never reveal who rated
  whom or who did not pick someone.
- Location is one-shot, for nearby discovery only. No background tracking.
- AI output is untrusted input: validate extraction, and never let it authorize,
  unlock connections, or write records without backend checks.
- Never commit `.env`, Supabase service-role keys, OAuth secrets, or Mapbox tokens.

## Marketing site (site/)

Separate Next.js 16 App Router app; it does **not** talk to the API and shares no code
with `apps/mobile`. It is brand surface, so its copy must match the product positioning
("Not a dating app — friendship first") and must never claim a feature that does not exist.

- `site/CLAUDE.md` is a one-line `@AGENTS.md` include; `site/AGENTS.md` is regenerated by
  `next dev` and warns that this Next.js version differs from training data — read
  `node_modules/next/dist/docs/` before writing Next-specific code. Commit that block if
  it reappears in a diff rather than stripping it.
- Design tokens are CSS-first Tailwind v4: the `@theme inline` block in
  `src/app/globals.css` defines the `--color-*` / `--font-*` variables, so classes read
  `bg-bg`, `text-text-muted`, `text-accent`. There is no `tailwind.config`. Bespoke
  effects (phone mockup, noise, grid, score ring) are hand-written CSS in the same file.
- All page copy and imagery live in `src/lib/constants.ts` (`SITE`, `NAV_LINKS`, `PHOTOS`,
  `ACTIVITIES`, `HOW_STEPS`, `AI_FLOW`, `LANGUAGES`). Edit content there, not in JSX.
- `src/app/page.tsx` composes one section component per fold from `src/components/`;
  shared primitives sit in `src/components/ui/`. Imports use the `@/` alias.
- Motion: GSAP + ScrollTrigger is the default (`GSAPProvider` for global setup, `Reveal`
  for scroll-in). framer-motion is used only by `ui/container-scroll-animation.tsx`.
  Prefer `Reveal` over a new bespoke timeline.
- Images are remote Unsplash URLs rendered with plain `<img>`. `next.config.ts` has no
  `remotePatterns`, so moving a component to `next/image` means configuring that first.

## Beyond the contract

Two endpoints are not in `docs/API_STRUCTURE.md` but are required by flows it
describes: `POST /api/auth/session` (one-time code handoff, so OAuth tokens never sit in
a redirect URL) and `POST /api/users/me/push-token` (device registration for the
feedback reminder). A third, `POST /api/auth/refresh`, trades a refresh token for a fresh
session — unauthenticated by necessity, since the expired access token is exactly what the
caller cannot present. Keep all three documented in README when they change.

`GET`/`PATCH /api/users/me/notifications` are likewise outside the contract — the per-type
opt-out `docs/TRD.md` §14.2 requires. An absent `notification_prefs` row means enabled, so
the endpoint reports every type as on until a member turns one off.

`docs/API_STRUCTURE.md` §5–6 still reference the old OTP screens; `TRD.md` §17 declares
OAuth canonical and the code follows TRD. Do not implement phone OTP.

## Not implemented

Mobile: infinite scroll on message history. Create-event now takes its coordinates from a
picked place (`VenuePicker`); the fixed Shibuya point survives only as the fallback for when
no Mapbox token is configured, and the screen says when that is what happened. There is still
no drag-a-pin fine-tune — the picked place's coordinates are taken as-is.

**No push notification has ever been delivered.** `push_tokens` is empty, `app.json` has no
`extra.eas.projectId`, and there are no FCM credentials, so `getExpoPushTokenAsync()` throws
and `usePushRegistration` swallows it — by design. Everything from the trigger down to
`pushTargets` is verified live; nothing below `sendPush` has run. The *routing* half
(`notificationRouting.ts` + the `linking.ts` override) is testable today with
`scheduleNotificationAsync` without any of that. Getting real delivery needs `eas init`, a
Firebase project, and a dev build on a device with Google Play services.

**Chat presence is per-process.** `onlineUserIds` (`socket/presence.ts`) asks
`fetchSockets()`, which only sees this instance, so a second API instance would push to
members who are online elsewhere. `@socket.io/redis-adapter` behind `REDIS_URL` is the fix
and is not wired. The chat debounce and the `last_active_at` throttle are in-process for the
same reason; the persisted daily caps are the backstop.

**The Mapbox path is written but has still never run.** A `pk.*` token now exists in
`apps/mobile/.env` and is verified against the live service, so that half of the requirement
is met — but `@rnmapbox/maps` is native and Expo Go cannot load it, so `hasMapbox()` is false
there and everything verified so far is the vector-city branch. Refetch-on-region-settle and
the search-radius ring are written and unexercised for the same reason: only the Mapbox
surface raises the one and draws the other. The venue place-search shares the token but no
native module, so it does run today.

**The Keystore native module is written but has never run either.** `AtsumaruKeystoreModule`
compiles in the sense that the TS bundle builds, but the Kotlin code only runs in a
`expo run:android` dev build — Expo Go cannot load it. Everything verified so far is the
gated wrapper + the `verifyDeviceSignature` unit tests; the migration `005_device_keys.sql`
is applied to the live project (2026-09-02) but the TEE round-trip — the actual register +
sign + verify against the live DB — is still unexercised.

The OAuth round-trip is wired but has only been exercised through the demo path — the
provider redirect and `atsumaru://auth` handoff still need a real run against configured
credentials in a dev build. No LINE or Google credentials exist yet; `seed --tokens`
mints real Supabase sessions, which is how the authenticated routes were verified.

Backend: **verified against the live project** as of 2026-09-03 — see `TRACKER.md` §1 for
the original assertion list, §1b for the eight defects only a real run could surface, and
§1f for the hardening pass and the ten assertions that proved it live. The sweep **claims**
each idempotency stamp before the side effect, so two drivers cannot double-notify, and the
handoff codes, PKCE verifiers and rate limits live in `services/ephemeral.ts` rather than
process-local Maps. Both Redis paths — the BullMQ driver and the ephemeral store's — are
written but have never run, because `REDIS_URL` is still empty.

## Codex Review

All work produced, will be thoroughly reviewed by **Codex**.

Codex will review the implementation for correctness, code quality, architecture, security, UI/UX consistency, adherence to the project documentation, and potential bugs or regressions.

Any issues identified during the review will be addressed before the implementation is considered finalized.
