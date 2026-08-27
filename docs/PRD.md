# Atsumaru (集まる) — Product Requirements Document

## 1. Product

**Name:** Atsumaru (集まる)  
**Meaning:** "to gather / to come together"  
**Positioning:** Friendship-first social discovery. Not a dating app.

> Meet in small groups over shared interests, check the vibe, and let romance happen naturally. No hookup pressure, no marriage pressure.

## 2. Problem

Atsumaru targets young adults in Japan who feel existing dating products sit at the wrong ends of the spectrum:

- **Tinder:** photo/swipe-first and associated with a blunt, hookup-oriented experience.
- **Pairs / Omiai:** more serious, marriage-oriented, structured, and slower-progressing.

The product gap is a **low-stakes, group-based, activity-first** way to meet people with shared interests.

## 3. Product Principles

1. **Group before 1:1.**
2. **Activity before romance.**
3. **Interests before photos.**
4. **Consent before private connection.**
5. **Pseudonymous by default.**
6. **AI should reduce friction, not become the product.**
7. **Every MVP feature must support the core meetup loop.**

## 4. Target Users

### Primary
Young adults in their 20s in Japan who want to socialize, make friends, date casually, or meet people through activities without immediate romantic pressure.

### Secondary
Foreign workers/residents in Japan who may want multilingual, interest-based social connection.

## 5. Core User Journey

```text
Login
  ↓
AI Onboarding
  ↓
Discover nearby meetups
  ↓
Event detail + match preview
  ↓
Join 4–6 person group
  ↓
Group chat
  ↓
Meet at venue
  ↓
Private post-meetup feedback
  ↓
Mutual connection?
  ├── Yes → 1:1 chat unlocked
  └── No  → feedback improves future matching
```

## 6. MVP Requirements

### 6.1 Authentication
- Supabase OAuth.
- Supported providers: LINE and Google.
- No phone OTP in the intended MVP.
- Persist the session securely on-device.

### 6.2 AI Onboarding
The user chats with an AI instead of filling a long profile form.

The AI extracts:
- interests
- personality/social style
- preferred language

Supported languages:
- Japanese (`ja`)
- English (`en`)
- Simplified Chinese (`zh`)

The user confirms extracted interests/personality and chooses a unique `@handle` and display name.

### 6.3 Discover
The main screen provides:
- nearby meetup map
- meetup/event cards
- category filtering
- event timing
- venue
- current/max group size
- match score
- event detail entry point

### 6.4 Smart Group Matching
Matching considers:
- interest similarity
- group balance
- group size
- reputation

Reference scoring model:

```text
match_score =
  0.6 * cosine(user_preference, candidate_vector)
  + 0.2 * group_balance(size, ratio)
  + 0.2 * normalized_reputation
```

### 6.5 Meetup / Group
Users can:
- view group members
- see public handles/display names
- view match explanation
- join/leave
- coordinate through group chat

Real names must never be shown to other users.

### 6.6 Post-Meetup Feedback
After the meetup, users can:
- rate other attendees with `meh`, `good`, or `fire`
- indicate whether they want to rejoin the group

Feedback updates:
- reputation
- preference vector
- future matching

### 6.7 Mutual Connection
This is a core product mechanic.

Each attendee privately selects people they would like to stay connected with.

A private 1:1 connection unlocks **only when both people select each other**.

No user should be told who did not select them.

## 7. Primary Screens

The Appathon MVP is designed around three primary screens:

### Screen 1 — AI Onboarding
Conversational onboarding, extraction confirmation, handle selection.

### Screen 2 — Discover / Home
Map + nearby events + recommended meetup cards.

### Screen 3 — Meetup / Group
Event details, group members, match preview, group chat, and post-meetup feedback/connection state.

Secondary states such as feedback, connection unlocked, and chat can be presented as states, sheets, modals, or navigation destinations rather than requiring separate top-level screens.

## 8. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | User can authenticate with LINE or Google | P0 |
| FR-02 | New users enter AI onboarding | P0 |
| FR-03 | AI extracts interests/personality | P0 |
| FR-04 | User can select a unique handle | P0 |
| FR-05 | User can browse nearby meetups | P0 |
| FR-06 | User can view event match preview | P0 |
| FR-07 | User can join a 4–6 person meetup | P0 |
| FR-08 | Group members can coordinate in realtime chat | P0 |
| FR-09 | User can submit post-meetup feedback | P0 |
| FR-10 | Mutual interest unlocks 1:1 chat | P0 |
| FR-11 | Feedback affects future matching | P1 |
| FR-12 | UI supports JP/EN/ZH | P1 |
| FR-13 | User can create/host events | P1 |
| FR-14 | Push notification deep-links to feedback | P1 |

## 9. Non-Functional Requirements

- React Native + Expo frontend.
- Android-first.
- Backend contract uses JSON.
- REST requests use Bearer JWT.
- Realtime chat uses Socket.io.
- Secure token storage.
- No public real-name display.
- Avoid unnecessary GPS tracking; location is used for nearby-event discovery.
- UI must remain usable on typical Android phone dimensions.
- Network failures must show recoverable states instead of silently failing.

## 10. Success Criteria for the Appathon

The demo should communicate the product in under two minutes:

1. AI talks to user.
2. AI produces an understandable interest/personality profile.
3. Nearby meetup appears.
4. App explains why the user fits the group.
5. User joins.
6. Group members and chat appear.
7. Post-meetup feedback is submitted.
8. Mutual connection unlocks.
9. Feedback/matching loop is shown as the long-term intelligence of the product.

## 11. Explicit Non-Goals

Do not spend MVP time on:
- swipe cards
- public follower systems
- stories
- elaborate dating profiles
- payment infrastructure
- complex recommendation models
- production-grade venue partnerships
- phone/SMS authentication
- large-scale moderation tooling

## 12. Future Roadmap

Potential Phase 2+ features already identified:
- AI icebreakers
- richer AI feedback
- safety layer
- LINE integration
- gamification
- AI vibe recap
- recurring interest circles
- venue partnerships
- premium tier




## Codex Review

All work produced, will be thoroughly reviewed by **Codex**.

Codex will review the implementation for correctness, code quality, architecture, security, UI/UX consistency, adherence to the project documentation, and potential bugs or regressions.

Any issues identified during the review will be addressed before the implementation is considered finalized.
