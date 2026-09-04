# Atsumaru — Technical Requirements Document

## 1. Architecture

```text
React Native / Expo
        │
        ├── REST API ───────────────┐
        │                           │
        └── Socket.io ──────────────┤
                                    ↓
                          Node.js + Express
                                    │
              ┌─────────────────────┼──────────────────┐
              ↓                     ↓                  ↓
          Supabase               Upstash            Groq
          Postgres/              Redis              Llama
          PostGIS/pgvector                           │
              │                                       ↓
              └──────────── MiniLM embeddings ───────┘
```

The supplied API contract defines Bearer JWT authentication, JSON bodies, ISO-8601 UTC timestamps, and `{ success, data }` / `{ success, error }` response conventions. fileciteturn0file0L3-L15

## 2. Frontend Stack

- React Native
- Expo
- TypeScript
- React Navigation
- Zustand
- TanStack React Query
- Socket.io Client
- `@rnmapbox/maps`
- Expo SecureStore
- Expo Notifications
- i18next + react-i18next

## 3. Backend Stack

- Node.js
- Express
- TypeScript
- Socket.io
- BullMQ
- Upstash Redis

## 4. Data Layer

Supabase:
- PostgreSQL
- PostGIS
- pgvector
- Supabase Auth

The API contract defines users, events, group members, chat messages, feedback, and unlocked connections. fileciteturn0file0L20-L88

## 5. Authentication

### Canonical MVP
OAuth only:
- LINE
- Google

The supplied API guide explicitly says there is no phone OTP because SMS requires a paid provider. fileciteturn0file0L94-L107

### Frontend
Store session credentials using Expo SecureStore.

Attach the access token to REST requests:

```text
Authorization: Bearer <access_token>
```

For Socket.io:

```text
io(WS_URL, {
  auth: { token }
})
```

The app never talks to a provider directly and never receives provider tokens. It opens
`GET /api/auth/{provider}?redirect_to=app`, and the API deep-links back with a **one-time
code** which the app trades at `POST /api/auth/session`. Tokens therefore never travel in
a URL.

### Provider brokering

The two providers reach a Supabase session by different routes, because Supabase Auth has
no LINE provider.

**Google — brokered by Supabase Auth.** The Google Cloud client id and secret live in
Supabase (Auth → Providers → Google), not in the API. `GET /api/auth/google` mints a PKCE
verifier, keeps it in memory keyed by the signed `state`, and redirects to
`…/auth/v1/authorize?provider=google&code_challenge=…&redirect_to=<API callback>`.
Supabase talks to Google, then redirects back to the API callback with `?code=`, which the
API redeems at `…/auth/v1/token?grant_type=pkce`. PKCE is what makes Supabase return a
code rather than tokens in a URL fragment; the verifier is single-use, so a replayed
callback cannot redeem a second session.

URLs live in three separate places and are easy to confuse:

| Setting | Value |
|---|---|
| Google Cloud console → authorized redirect URI | Supabase's `https://<ref>.supabase.co/auth/v1/callback` |
| `OAUTH_CALLBACK_URL` (API env) | the API's own `/api/auth/callback` |
| Supabase → Auth → URL Configuration → Redirect URLs | must list that API callback, or GoTrue silently falls back to Site URL |

**LINE — exchanged by the API.** The API swaps the code for an `id_token`, verifies it
through LINE's own verify endpoint (signature, audience, nonce), then maps the provider
subject to a Supabase user: `auth.admin.createUser` → `generateLink` → `verifyOtp`, the
last on an isolated client so the shared service-role client never adopts a user session.
A channel without email permission returns no address, so the API substitutes an internal
`@oauth.atsumaru.invalid` one that never leaves the server.

When a provider *does* return an address that already has an account, the second identity
is **linked** to it instead of creating a twin, so one person keeps one profile across
providers. Linking only ever happens for a real provider-supplied address, never a
synthetic one.

## 6. Suggested React Native Structure

```text
src/
├── app/
│   ├── navigation/
│   └── providers/
│
├── screens/
│   ├── Auth/
│   ├── Onboarding/
│   ├── Discover/
│   └── Meetup/
│
├── components/
│   ├── common/
│   ├── events/
│   ├── chat/
│   ├── onboarding/
│   └── feedback/
│
├── features/
│   ├── auth/
│   ├── onboarding/
│   ├── events/
│   ├── chat/
│   ├── feedback/
│   └── connections/
│
├── services/
│   ├── api/
│   ├── socket/
│   └── notifications/
│
├── store/
├── hooks/
├── i18n/
├── types/
└── utils/
```

## 7. API Client

Centralize REST access.

Responsibilities:
- base URL
- JWT injection
- JSON serialization
- common error handling
- response unwrapping
- request cancellation where useful

Do not call `fetch()` directly throughout screens.

## 8. API Surface

### Auth
- `GET /auth/line`
- `GET /auth/google`
- `GET /auth/callback`
- `POST /auth/logout`
- `GET /auth/me`

### Onboarding
- `POST /onboarding/chat`
- `GET /onboarding/suggest-handles`
- `GET /onboarding/check-handle`
- `POST /onboarding/complete`

### Profile
- `GET /users/me`
- `PATCH /users/me`
- `GET /users/:id`

### Events
- `GET /events/nearby`
- `GET /events/:id`
- `POST /events`
- `GET /events/mine`

### Groups
- `POST /events/:id/join`
- `POST /events/:id/leave`
- `GET /events/:id/members`
- `GET /events/:id/match-preview`

### Group Chat
- `GET /events/:id/messages`
- `POST /events/:id/messages`

### Feedback
- `GET /events/:id/feedback-form`
- `POST /events/:id/feedback`

### Connections
- `GET /connections`
- `GET /connections/:id/messages`
- `POST /connections/:id/messages`

These endpoints are defined by the supplied API contract. fileciteturn0file0L94-L164

## 9. Query Strategy

React Query owns server state.

Examples:

```text
useNearbyEvents()
useEvent(id)
useEventMembers(id)
useMatchPreview(id)
useMessages(id)
useFeedbackForm(id)
useConnections()
```

Zustand should own small client-side state such as:
- onboarding draft
- selected filters
- UI preferences
- temporary chat/composer state

Do not duplicate the entire server database inside Zustand.

## 10. Realtime

Socket.io rooms:

```text
group:{event_id}
dm:{connection_id}
```

Client events:
- `group:join`
- `group:message`
- `dm:join`
- `dm:message`
- `typing`

Server events:
- `group:message`
- `dm:message`
- `member:joined`
- `match:unlocked`
- `typing`

The supplied API guide defines these events. fileciteturn0file0L168-L187

## 11. Realtime Reliability

The client must:
- reconnect automatically
- show a connection state when disconnected
- optimistically render local messages only if the implementation can safely reconcile failures
- fall back to REST message retrieval
- avoid duplicate messages after reconnect

## 12. Map

Use `@rnmapbox/maps`.

Flow:

```text
Device/location permission
        ↓
Current coordinates
        ↓
GET /events/nearby?lat=&lng=&radius=
        ↓
Render event pins
        ↓
Tap pin
        ↓
Open event detail
```

The API contract specifies `{ lat, lng }` coordinates and nearby event retrieval. fileciteturn0file0L10-L16

Do not implement continuous GPS tracking.

### 12.1 Two renderers

`hasMapbox()` is the whole decision. With a `pk.*` token *and* a dev build the app draws real
tiles; otherwise it draws the hand-authored vector city in `components/map/geo.ts`. Expo Go can
never load the native module, so the vector city is what runs there — it is a complete map, not
a placeholder. Both surfaces take the same props and draw the same `PinBody`.

### 12.2 Search radius

Drawn as a **coordinate polygon** (`components/map/radius.ts` → `ShapeSource`), never a
`CircleLayer`: `circleRadius` is screen pixels, so such a ring holds its size while the ground
moves under it — a 5 km claim that becomes 50 km on zoom out. Real coordinates scale with the
map, so the ring is generated once and never recomputed during a gesture.

The radius must equal what the query asks for. Client, server default and drawing are all
5 km; changing one means changing all three.

**Mapbox only.** The vector city models a 3.35 × 3.33 km slice of Shibuya, so a 5 km radius
wants 10 km across — three times its whole world — and its minimum zoom already shows that
world entire. The ring's edge is unreachable at every zoom, so only a flat tint would render.

### 12.3 Map controls

`MapSurface` exposes one imperative verb, `recenter(coords)`, implemented by both renderers;
everything else stays declarative. Recentring clears the panned centre, because the nearby
query prefers it over the location fix and the two would otherwise describe different places.

Controls sit clear of the bottom-left corner: Mapbox's attribution and wordmark are a licence
condition and cannot be covered.

### 12.4 Venue place-search

Hosting takes coordinates from a place the member picked (`services/places.ts`, the single
gate), falling back to a fixed central point only when no token is configured — and saying so
on screen when it does.

Use the **Search Box API**, not Geocoding. Geocoding is address-shaped: asked for "Shibuya
Station" it answers with the ward, and a Japanese POI query returns nothing.

Search Box must be called with `language=ja`. Japan's POI index is Japanese-language, so `en`
or `zh` return wards and neighbourhoods with **zero** venues. Passing the member's UI language
is the change that silently turns a venue picker into an administrative-area picker.

`/suggest` returns names without coordinates and `/retrieve` resolves the chosen one. Both
carry the same `session_token`, because Mapbox bills a session rather than a request.

## 13. AI

### Onboarding
```text
User message
    ↓
POST /onboarding/chat
    ↓
Groq / Llama
    ↓
reply + extracted JSON
```

When `done=true`, extracted interests/personality can be confirmed by the user.

### Embeddings
```text
interests/personality
        ↓
MiniLM embedding
        ↓
pgvector preference_vector
```

### Feedback loop
```text
feedback
   ↓
preference vector update
   ↓
future match score
```

Reference update:

```text
new = old + lr * liked_vector - lr * disliked_vector
```

with `lr ≈ 0.1`. fileciteturn0file0L249-L271

## 14. Notifications

Use Expo Push Notifications for:
- meetup reminders
- post-meetup feedback
- mutual connection notification

The supplied contract specifies a feedback notification approximately one hour after the meetup start time. fileciteturn0file0L277-L286

### 14.1 Types

Five, each with its own trigger, and all of them sent through one `notify()` gate in
`server/src/services/notifications.ts` so the guards below cannot be applied inconsistently.

| Type | Trigger | Idempotency / limit |
|---|---|---|
| `feedback` | ~1h after `start_time`, by the sweep | `events.feedback_reminder_sent_at` |
| `meetup_soon` | ~15 min before `start_time`, by the sweep | `events.start_reminder_sent_at` |
| `chat` | a message whose recipient has no live socket | 5-min per-thread debounce + daily cap |
| `nearby` | a meetup opens within 5 km of `users.location` | daily cap; location must be < 7 days old |
| `reengagement` | `users.last_active_at` older than 7 days | `users.last_reengaged_at`, 14-day gap |

Every stamp is **claimed before the send**, never written after it: a crash between the two
costs one notification, whereas stamping afterwards lets two drivers send the same thing
twice.

### 14.2 Guards

- **Opt-out** — `notification_prefs (user_id, type, enabled)`. An absent row means enabled,
  so shipping the table does not mute anyone.
- **Quiet hours** — 22:00-08:00 JST, for `nearby` and `reengagement` only. The other three
  follow from something the member did, and holding them until morning would make them
  arrive after they mattered.
- **Daily caps** — persisted through `bump_quota`, so a restart cannot reset a budget.
  Charged per person, not per device.

### 14.3 Routing

The payload carries a `url` (`atsumaru://meetup/:id`, `atsumaru://dm/:id`) alongside
`data.type`. React Navigation's linking only reads URLs, so
`apps/mobile/src/app/navigation/linking.ts` overrides `getInitialURL`/`subscribe` to feed it
notification taps — that override is what makes cold start, warm start and background behave
the same. Group chat has no route of its own, so a chat notification deep-links to the
meetup screen.

### 14.4 Copy

Server-side, in `push.ts`, in all three languages (RULES §12). A notification may name a
co-member — they already share a group chat — using `display_name` only, and may state only
what the data proves. Nothing claims a member is waiting for, missing, or asking after
someone, and nothing is ever drawn from `feedback` or `connections`.


## 15. Security / Privacy

- Never display `real_name` in another user's profile.
- Never put access tokens in AsyncStorage.
- Use SecureStore for session persistence.
- Do not log access tokens.
- Validate all user-generated content server-side.
- Escape/sanitize displayed text where required.
- Do not expose private feedback choices.
- Only mutual selections can create a 1:1 connection.

## 16. Performance

Appathon targets:
- fast initial render
- map should not refetch on every tiny region movement
- debounce map-region requests
- cache event lists
- paginate messages
- lazy-load noncritical screens/components
- avoid unnecessary global state updates

The API guide states list endpoints are paginated. fileciteturn0file0L277-L286

## 17. Known Contract Inconsistency

The supplied API guide's screen map contains an old `Login / OTP` reference to `/auth/request-otp` and `/auth/verify-otp`, while its actual authentication section specifies **OAuth only — LINE + Google, no phone OTP**.

For this project, treat the OAuth-only authentication section as canonical and do not implement phone OTP unless the backend contract is deliberately changed.
