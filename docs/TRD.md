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
Use Supabase OAuth with an Expo redirect URI.

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
