# Atsumaru — React Native Frontend Implementation Guide

## 1. Frontend Goal

Build an Android-first React Native/Expo application that can demonstrate the complete Atsumaru loop:

```text
Auth
→ AI onboarding
→ Discover
→ Event
→ Group
→ Chat
→ Feedback
→ Mutual connection
```

## 2. Recommended Navigation

```text
RootNavigator
├── AuthStack
│   └── Login
│
├── OnboardingStack
│   ├── AIChat
│   └── ProfileConfirm
│
└── AppStack
    ├── Discover
    └── Meetup
```

Connections/DM can be a child route from Meetup or a modal/pushed destination.

## 3. Screen Responsibilities

### Login
- LINE OAuth
- Google OAuth
- loading/error states
- route new users to onboarding
- route existing users to Discover

### AIChat
- message list
- composer
- typing/loading state
- language-aware responses
- completion detection

### ProfileConfirm
- extracted interest chips
- personality chips
- handle suggestions
- handle availability
- display name
- complete onboarding

### Discover
- map
- nearby event pins
- category filters
- recommended event cards
- event selection

### Meetup
Before meetup:
- event information
- group members
- match score
- why-match reasons
- group chat

After meetup:
- ratings
- rejoin choice
- mutual connection selection
- unlocked connection state

## 4. Type Definitions

Keep API/domain types centralized.

```ts
export type Language = "ja" | "en" | "zh";

export type EventStatus =
  | "open"
  | "full"
  | "ongoing"
  | "completed";

export type Rating = "meh" | "good" | "fire";

export interface User {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  language: Language;
  interests: string[];
  personality: string[];
  reputation_score: number;
  location: {
    lat: number;
    lng: number;
  } | null;
}

export interface Event {
  id: string;
  host_id: string;
  title: string;
  category: string;
  description: string;
  venue_name: string;
  location: {
    lat: number;
    lng: number;
  };
  start_time: string;
  max_size: number;
  current_size: number;
  status: EventStatus;
}
```

These correspond to the backend contract's public User and Event models. fileciteturn0file0L20-L50

## 5. API Layer

Recommended:

```text
services/api/client.ts
services/api/auth.ts
services/api/onboarding.ts
services/api/events.ts
services/api/feedback.ts
services/api/connections.ts
```

Example:

```ts
const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
```

If using `fetch` instead of Axios, keep equivalent logic inside one client module.

## 6. Query Hooks

```text
features/events/hooks/useNearbyEvents.ts
features/events/hooks/useEvent.ts
features/events/hooks/useMatchPreview.ts
features/chat/hooks/useMessages.ts
features/feedback/hooks/useFeedbackForm.ts
features/connections/hooks/useConnections.ts
```

## 7. Socket Service

One shared socket service should:
- establish the authenticated connection
- expose connection status
- join/leave rooms
- subscribe/unsubscribe listeners
- clean up listeners

Do not create a new Socket.io connection on every render.

## 8. State Ownership

### React Query
Use for:
- current user from server
- events
- event members
- messages loaded from REST
- feedback form
- connections

### Zustand
Use for:
- selected category
- temporary onboarding state
- selected event
- transient UI state
- language preference

## 9. Map Strategy

Request nearby events when the map region changes, but debounce the request.

Avoid:

```text
every camera movement
→ API request
```

Prefer:

```text
camera settles
→ debounce
→ request nearby events
```

Only *gesture-driven* moves count. Framing the pins when results arrive is a programmatic
move, and treating it as a settle would let framing feed itself a fetch.

### Chrome over the map

Controls float over the map rather than occupying a bar, and they stay inside the visible
band — between the filter rail and the sheet's resting edge. Keep the bottom-left corner
free: on the Mapbox surface that is where the attribution and wordmark live, and they are a
licence condition.

A control that moves the camera should also reset whatever the map was last panned to, or the
view and the list end up describing different places.

### Drawing distance

The search radius is drawn in real coordinates so it scales with the map, and it is generated
once rather than per frame. It is only worth drawing where the surface can actually show it —
see TRD §12.2 for why the vector city cannot.

## 10. Chat Strategy

Initial load:

```text
GET /events/:id/messages
```

Realtime:

```text
group:join
group:message
member:joined
typing
```

For DMs:

```text
dm:join
dm:message
typing
```

The backend contract defines REST fallback endpoints and Socket.io events for both chat types. fileciteturn0file0L145-L187

## 11. Demo Mode

For an Appathon, create a development/demo seed path if the backend team supports it.

The UI should be able to demonstrate:
- populated nearby events
- a nearly full group
- chat messages
- completed meetup
- feedback
- mutual connection

Do not fake production behavior in the final architecture. Demo data should be clearly isolated from real user data.

## 12. Build Order

### Phase 1
- Expo project
- navigation
- theme
- reusable components
- API client
- auth

### Phase 2
- AI onboarding
- profile confirmation
- Discover map
- event cards

### Phase 3
- Meetup screen
- member list
- match preview
- join flow

### Phase 4
- group chat
- feedback
- mutual connection
- DM

### Phase 5
- loading/error states
- i18n
- animations
- polish
- demo testing

## 13. Appathon Rule

If time is running out, preserve this exact path:

```text
Login
→ Onboarding
→ Discover
→ Meetup
→ Feedback
→ Mutual Connect
```

Chat and advanced polish are secondary to having this path work end-to-end.
