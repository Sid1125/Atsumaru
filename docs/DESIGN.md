# Atsumaru — Product & UI Design Specification

## 1. Design Direction

Atsumaru should feel like a **calm social discovery app**, not a conventional dating app.

### Keywords
- warm
- modern
- friendly
- low-pressure
- Japanese-inspired without becoming stereotypical
- community-oriented
- trustworthy
- activity-first

Avoid:
- aggressive dating-app gradients
- swipe-card UI
- excessive hearts
- appearance-first profile layouts
- nightclub/hookup aesthetics
- overly corporate enterprise styling

## 2. Primary Navigation

The MVP has three primary product surfaces:

```text
AI Onboarding
     ↓
Discover / Home
     ↓
Meetup / Group
```

Authentication and settings are supporting flows.

## 3. Screen 1 — AI Onboarding

### Goal
Make profile creation feel like a conversation rather than registration.

### Layout

```text
┌─────────────────────────────┐
│ Atsumaru             1/3    │
│                             │
│  Let's get to know you.     │
│                             │
│  AI message                 │
│  "What do you usually       │
│   do on weekends?"          │
│                             │
│              User message   │
│              "I hike..."    │
│                             │
│  AI message                 │
│  "Nice! Anything else?"     │
│                             │
│ ┌─────────────────────────┐ │
│ │ Type a message...       │ │
│ └─────────────────────────┘ │
│                         ➤   │
└─────────────────────────────┘
```

### Completion state
Show extracted data as editable chips:

- Hiking
- Coffee
- Board games
- Chill
- Explorer

Then:
- suggested handles
- handle availability
- display name
- language

Primary CTA:

**Find my people**

## 4. Screen 2 — Discover / Home

### Goal
Immediately show the user that Atsumaru is about **real-world activities with small groups**.

### Recommended hierarchy

1. Greeting / handle
2. Map
3. Category filters
4. Recommended meetup
5. Nearby meetup list

Example:

```text
┌─────────────────────────────┐
│ @trailbrew            🔔    │
│ Find your people nearby     │
│                             │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │        MAP              │ │
│ │     •      •            │ │
│ │          •              │ │
│ │    •                   │ │
│ └─────────────────────────┘ │
│                             │
│ Food  Games  Art  Outdoor   │
│                             │
│ For you                     │
│ ┌─────────────────────────┐ │
│ │ 🍜 Ramen & Retro Games  │ │
│ │ Shibuya · Sat 7 PM      │ │
│ │ 4/6 people              │ │
│ │ 91% group fit           │ │
│ │              View →     │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### Event Card
Must expose enough information without opening detail:
- title
- category
- venue
- date/time
- current/max size
- match score

## 5. Screen 3 — Meetup / Group

### Before Meetup

```text
┌─────────────────────────────┐
│ ← Ramen & Retro Games       │
│ Shibuya · Sat 7:00 PM       │
│                             │
│ Your group · 5/6            │
│                             │
│ @haru     @kenji            │
│ @yuki     @mika             │
│                             │
│ Why this group?             │
│ 🍜 Ramen                    │
│ 🎮 Gaming                   │
│ ☕ Café culture              │
│                             │
│ ───── Group Chat ─────────  │
│ @haru: Can't wait!          │
│ @kenji: Same here           │
│                             │
│ [ Join / Open Chat ]        │
└─────────────────────────────┘
```

### Post-Meetup State

```text
┌─────────────────────────────┐
│ How was the meetup?         │
│                             │
│ @haru       😐 🙂 🔥        │
│ @kenji      😐 🙂 🔥        │
│ @yuki       😐 🙂 🔥        │
│                             │
│ Rejoin this group?          │
│        Yes / No             │
│                             │
│ Who would you like to       │
│ stay connected with?        │
│                             │
│ @haru        ○              │
│ @kenji       ○              │
│ @yuki        ○              │
│                             │
│ [ Submit privately ]        │
└─────────────────────────────┘
```

### Mutual Connection State

Use a celebratory but restrained state:

> 🎉 It's a mutual connection!
>
> You and @haru both want to stay connected.

CTA:

**Start chatting**

Do not expose non-mutual selections.

## 6. Identity Design

Public identity:
- `@handle`
- display name
- avatar
- interests/personality where appropriate

Never render:
- real name
- private authentication information

The backend contract explicitly treats real name as private. fileciteturn0file0L23-L34

## 7. Components

Create reusable React Native components:

```text
Button
Chip
Avatar
EventCard
MapPin
MatchScore
MatchReason
MemberRow
ChatBubble
ChatInput
RatingSelector
HandleSuggestion
EmptyState
ErrorState
LoadingSkeleton
BottomSheet
```

## 8. States

Every network-backed component should account for:

- loading
- loaded
- empty
- error
- retrying
- offline/reconnecting where relevant

Do not leave blank screens on API failure.

## 9. Interaction Rules

- Primary actions should be obvious.
- Avoid destructive actions next to primary CTAs.
- Use bottom sheets for event detail where appropriate.
- Use haptics sparingly.
- Avoid animation that delays the user.
- Mutual-match animation may be emphasized because it is the emotional payoff.
- Chat should feel familiar and fast.

## 10. Accessibility

- Touch targets should be comfortably tappable.
- Do not communicate important state with color alone.
- Text should remain readable at larger device font sizes.
- Icons need accessible labels where they are the only indication of an action.
- Emoji ratings should have text/accessibility equivalents.

## 11. Internationalization

Locales:
- `en`
- `ja`
- `zh`

Never hardcode user-facing strings directly inside components.

Recommended structure:

```text
src/i18n/
  en.json
  ja.json
  zh.json
```

The backend should receive the selected language so onboarding AI can reply in that language. fileciteturn0file0L109-L120

## 12. Visual Rule

The product should visually communicate:

**"Come meet people."**

Not:

**"Come find a date."**
