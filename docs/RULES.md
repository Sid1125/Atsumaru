# Atsumaru — Development Rules

## 1. General

1. Build the smallest thing that can convincingly demonstrate Atsumaru.
2. Do not add features without a product reason.
3. Prefer reusable components over duplicated screen code.
4. Keep business logic outside visual components.
5. Type everything with TypeScript.
6. Never commit secrets or API keys.

## 2. Product Rules

1. Atsumaru is **friendship-first**.
2. The default interaction is **group-based**.
3. Romance is optional and must never be forced.
4. There is no swipe-first UX.
5. There is no public like counter.
6. Real names are private.
7. 1:1 communication requires mutual consent after a meetup.
8. Feedback selections are private.
9. The main experience should revolve around real-world activities.

## 3. Frontend Rules

1. React Native + Expo only for the frontend.
2. TypeScript only.
3. Use React Query for server state.
4. Use Zustand for lightweight client state.
5. Centralize API requests.
6. Centralize Socket.io handling.
7. Do not put raw API calls in UI components.
8. Do not put business rules in JSX.
9. Reuse components.
10. Keep screens thin.

## 4. Navigation Rules

Primary product surfaces:

```text
Onboarding
Discover
Meetup
```

Supporting flows may be pushed/presented from these surfaces.

Do not create a separate top-level screen solely because a feature exists.

## 5. API Rules

Every REST request must:
- use the configured API client
- attach the current Bearer JWT
- handle loading/error states
- handle non-success responses

Follow the backend response convention:

```json
{
  "success": true,
  "data": {}
}
```

or:

```json
{
  "success": false,
  "error": {
    "code": "STRING",
    "message": "..."
  }
}
```

## 6. Identity Rules

Public UI may show:
- handle
- display name
- avatar
- public interests

Public UI must not show:
- real name
- access token
- private feedback
- internal user IDs unless technically necessary and hidden

The API contract explicitly marks `real_name` as private and requires the frontend to show `@handle` + display name instead. fileciteturn0file0L23-L34

## 7. Matching Rules

The product's reference matching formula is:

```text
0.6 × cosine similarity
+ 0.2 × group balance
+ 0.2 × normalized reputation
```

Do not invent a second scoring model in the frontend.

The frontend displays the result and explanation supplied by the backend.

## 8. Feedback Rules

Allowed ratings:

```text
meh
good
fire
```

Never show:
- who rated whom
- another person's private rating
- a user's rejection/non-selection

A successful feedback submission may return unlocked connections. fileciteturn0file0L151-L157

## 9. Connection Rules

A connection is created/unlocked only when both participants select each other.

Expected UX:

```text
User A selects B
User B selects A
       ↓
Mutual
       ↓
1:1 chat unlocks
```

If the selection is not mutual:
- do nothing
- do not notify the other person
- do not expose the non-match

## 10. Chat Rules

### Group Chat
Only members of the event group may access its chat.

### Direct Chat
Only users with an unlocked connection may access the DM.

### Messages
- render server timestamps
- handle sending failures
- show reconnecting state
- avoid duplicate messages

## 11. Location Rules

Use location only for nearby meetup discovery.

Do not implement:
- background tracking
- movement history
- unnecessary location collection

## 12. i18n Rules

Supported locales:
- `en`
- `ja`
- `zh`

All user-facing text must come from translation resources.

Do not use English-only fallback strings inside components unless intentionally configured as the localization fallback.

## 13. AI Rules

AI output must be treated as untrusted application data.

Validate structured extraction before using it.

Do not allow model output to:
- execute code
- modify permissions
- bypass authentication
- directly create database records without backend validation

The AI's job is:
1. understand the user
2. assist matching
3. support the feedback loop

The AI is not the primary social experience.

## 14. Error Handling

Every async operation needs:
- loading state
- success state
- failure state
- retry path when reasonable

Example:

```text
Loading meetup...
       ↓
Failed to load meetup
       ↓
[Try again]
```

Never silently swallow an API error.

## 15. Git Rules

Suggested branches:

```text
main
develop
feature/*
fix/*
```

Commits should describe the actual change:

```text
feat: add meetup event cards
feat: implement AI onboarding chat
fix: prevent duplicate socket messages
```

Do not commit:
- `.env`
- credentials
- OAuth secrets
- Mapbox tokens
- Supabase service-role keys

## 16. Appathon Scope Rule

When in doubt:

**Working core flow > extra feature.**

Priority:

```text
AI onboarding
    >
Discover
    >
Meetup
    >
Group chat
    >
Feedback
    >
Mutual connection
    >
Polish
    >
Future features
```

Do not sacrifice the end-to-end demo for a flashy addon.


## Codex Review

All work produced, will be thoroughly reviewed by **Codex**.

Codex will review the implementation for correctness, code quality, architecture, security, UI/UX consistency, adherence to the project documentation, and potential bugs or regressions.

Any issues identified during the review will be addressed before the implementation is considered finalized.

