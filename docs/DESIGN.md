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

## 1b. Visual World — Warm Japanese Editorial

The app shares the marketing site's visual DNA (`site/globals.css`, the north
star for look-and-feel). The register is **editorial restraint + real-world
activity + Japanese warmth + playful social discovery** — never sterile
minimalism.

### Palette (theme/tokens.ts is canonical)

Sourced from `assets/color pal.jpeg` — five swatches, all warm:

| Swatch | Hex | Role |
|---|---|---|
| Champagne Glow | `#F5E5CC` | `colors.background` — the page ground and the whole surface ramp |
| Citrus Fizz | `#FFCC99` | `colors.fizz` — the mid tint (soft fills, pips, badges) |
| Neon Citrus | `#FF9E0F` | `colors.citrus` — the electric/highlight register |
| Orange Zest | `#CE4503` | `colors.primary` — THE action colour |
| Berry Pop | `#7D0000` | `colors.danger`, and the deep end of the ink ramp |

| Role | Token | Value |
|---|---|---|
| Warm content ground | `colors.background` | Champagne Glow `#F5E5CC` |
| Ink (primary text) | `colors.text` | warm ink `#1E1710` |
| **Brand / action / payoff** | `colors.primary` | Orange Zest `#CE4503` |
| **The action colour as *text*** | `colors.primaryInk` | `#9C3406` |
| **Secondary semantic** (trust / AI / compat / success) | `colors.accent` | olive `#4F6B3A` |
| Highlight / payoff register | `colors.citrus` | Neon Citrus `#FF9E0F` |
| Destructive | `colors.danger` | Berry Pop `#7D0000` |
| Night surfaces | `colors.night` | berry ink `#231310` (dark, not cold black) |

Rules:
- **Orange Zest is THE one action register.** The mutual-match celebration is
  the same zest, elevated by size + craft, never a second hue.
- **`primary` is a fill, not an ink.** Orange Zest as small text measures
  3.79:1 on the ground and 3.82:1 on night — legible as a button, not as an
  11pt label. `primaryInk` (5.83:1 on the ground) is the text weight; `citrus`
  (8.66:1) is the one for text on night. Every `colors.primary` used as a text
  or small-glyph colour is a contrast bug.
- **Olive is the secondary semantic** register — never used for primary
  actions. It is also the only hue in the file the palette does not supply: five
  analogous warm swatches cannot express "success" as distinct from "action", and
  rendering compatibility in another orange would collapse the one distinction it
  exists to make.
- **Neon Citrus is the electric band, never the action colour.** Tape badges,
  highlighter marks, the payoff moment. White on it is 2.07:1, so it takes
  `citrusInk` and only `citrusInk`.
- **Category colors are data-encoded content accents only** (food=Neon Citrus,
  gaming=magenta, arts=violet, outdoor=olive), paired with glyph + label text.
  They never decorate generic chrome (buttons, nav, surfaces). The band is
  deliberately *not* folded into the warm ramp — nine categories need nine
  distinguishable hues — but each is pitched at pigment weight rather than the
  screen-neon weight that reads as radioactive on champagne.
- **Night stays dark** but is the berry desaturated to ink weight, not pure
  black and not `#7D0000` at full strength (which reads as an error state).
  Login and the Discover editorial band sit on it; content stays champagne.
- The product should read warm, calm, playful and social — not a loud neon
  palette and not a sterile one.

### Typography (theme/typography.ts is canonical)

**Inter, bundled** (`@expo-google-fonts/inter`, five weights), matching `site/` — the
app had been on the platform system face while the marketing site was on Inter, so the
two halves of the product were set in different typefaces. `apple-design` §15 permits
overriding the platform face "with a reason"; brand continuity is that reason.

**Noto Sans JP is deliberately NOT bundled.** Inter has no kana or hanzi, so both
platforms substitute their own Japanese face per glyph — verified on device beside the
Latin, and correct. A bundled Japanese face costs megabytes to re-solve a problem the
OS already solves.

RN has no font fallback chain and **no synthetic weights**: `fontWeight` is ignored once
`fontFamily` names a concrete face, so every weight is its own family string.

- **Display tier**: `displayLarge` 56/54/−2.6/800 (one per screen, at most) and
  `display` 44/46/−2.2/800. The negative tracking is not decoration — Inter at 56pt
  drifts apart without it.
- **Two mono roles, not three.** `kicker` names a screen or section; `overline` labels a
  *datum* and is attached to the thing it names. A third role (`sectionHeader`) existed
  at a third size doing the same job as `kicker`, and the three together accounted for
  **39 labels across ~12 screens** — roughly one above every block, which is the single
  most reliable way to make an interface read as generated. Budget: **at most one
  `kicker` per three sections.**
- `caption` carries `tabular-nums`, so scores, counts and clock times stop shifting
  width as they change.

### Component grammar

- **Editorial labels**: mono uppercase kickers (`type.kicker`/`overline`) for
  section headers and micro-labels on every surface.
- **Kill the pill smell**: primary nav and chrome are mono kicker links /
  numbered indices, not round `radius.pill` icon buttons. Category filter chips
  are the one legitimate pill family (they are data selectors) and render their
  selected state as a sticker.
- **Sticker/vinyl pops**: the site's hard-offset-shadow, slightly-rotated,
  die-cut stickers and tape badges carry the playful moments (category marks,
  status tapes, decals). This is what keeps the system warm, not generic.
- **Cards form a small family** — featured / standard / compact — sharing the
  category kicker, score mark, occupancy pips and trailing chevron; never one identical
  padded rectangle everywhere. The family is built from *hierarchy* (mark size, title
  size, air, a tilt on the featured sticker), never from a badge or colour the others
  lack.
- **The vinyl offset is the app's one distinctive object.** One primitive
  (`ui/VinylShadow`) draws it, and every sticker, tape and vinyl button uses that one.
  It draws *outside* its parent's bounds, so an ancestor with `overflow: "hidden"`
  clips it away.
- **Chrome is a material, not an opaque disc.** Floating chrome over the map uses
  `ui/Material` so the map genuinely passes underneath, and `ui/ScrollEdge` fades that
  material in as content scrolls under a sticky bar — never a permanently drawn
  divider. Never stack a light material on another light material.
- **Chat** keeps meetup identity present; sender bubbles use the action fill.
- **Decorative washes** (login, hero) are subtle site-style ambients
  (`colors.washPrimary` / `washAccent`, ~10% alpha), never rainbow gradients.
  Both stops of the gradient derive from the same token — fading a colour
  through a *different* transparent hue tints the midpoint.

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
