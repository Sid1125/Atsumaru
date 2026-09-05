# Atsumaru Visual Overhaul

## Objective

Bring the entire React Native app into the Atsumaru website's visual
language.

## Locked decisions

- **Palette re-anchored on `assets/color pal.jpeg` (2026-09-05).** Champagne
  Glow ground + warm ink + Orange Zest action + Berry Pop destructive, with
  Citrus Fizz as the mid tint. Supersedes the cream/coral/sage core below —
  the *structure* of that decision (one action register, one secondary
  semantic, category colours as content-only) is unchanged; only the hues moved
- Orange Zest `#CE4503` = brand/action/payoff. **It is a fill, not an ink** —
  `primaryInk` `#9C3406` is the text weight, `citrus` the one for text on night
- Olive `#4F6B3A` = trust/compatibility/success. The one hue not from the
  palette, because five analogous warm swatches cannot say "success" and
  "action" at the same time
- Category colors = localized content only
- **Electric band = Neon Citrus `#FF9E0F`** (was lime `#C8FF00`) — highlighter
  marks, tape badges, sticker highlights. It is never the action colour and
  never appears on generic chrome; only where the site wears it (marker on the
  wordmark, tape on status, sticker on payoff figures). It always takes
  `citrusInk`; white on it is 2.07:1
- Dark Discover remains dark but uses warm ink
- Editorial component language
- **Pills where the site has them, never everywhere**: CTAs are pills with a
  glow (`primary`) or a hard vinyl shadow (`vinyl`), matching the site's
  `rounded-full` CTA + `.sticker-badge`; pills are not used as a catch-all
- **Vinyl marks the moments, soft depth carries the surfaces**: hard offset
  shadows only on CTAs/tape/stickers/stats strips (the site's `2px 3px 0`
  shadow), never on every card
- No uniform card system
- No generic React Native UI
- Preserve functionality

## Progress

- [x] Design tokens (cream/ink/coral/sage, neon→coral, food amber)
- [x] **Token re-anchor on the palette reference (2026-09-05)** — see below
- [x] Login — rainbow/lilac/neon washes removed (subtle coral + sage now)
- [x] SVG icon set (connections, profile, gear, chevron, sparkle, map, warning, send, wave)
- [x] Navigation — Discover top corners = connections SVG circle + profile avatar circle
- [x] Username removed from Discover top band
- [x] New Profile page (hero/interests/stats/language/sign-out) replaces old Settings screen
- [x] Button grammar → **pill CTA with coral glow** (site `rounded-full` +
      `shadow-accent/20`); `neon` = vinyl hard shadow underlay (site
      `.sticker-badge`). The 2026-09-01 "rectangular slab" rule was a
      divergence from the site and is superseded by the site-faithful pill
- [x] Profile menus modernised (2026-09-03): lime vinyl stats strip, blocks as
      cards, language as a segmented control, handle wearing the highlighter mark
- [x] Meetup status → `Tape` badge (lime/coral/ink by status); match score →
      lime sticker; Discover host CTA → lime vinyl pill; feedback ratings wear
      per-rating sticker colours
- [x] EventCard grammar → edge-to-edge editorial row (hairline rule, no bg/elevation/floating rect)
- [x] Discover feedbackRow + locationRow → editorial (transparent, hairline rule)
- [x] Emoji→SVG swap: ScreenState (⚠️→IconWarning, 🗺️→IconMap), celebration (🎉→IconSparkle), chat empty (👋→IconWave), AIChat send (↑→IconSend), AIChat opener (👋→IconWave)
- [x] i18n keys for Profile page (en/ja/zh)
- [x] Final visual QA pending (emulator — human eye)

## Completed work (this session)

- **Token rebalance**: keep `primary`=`#FF432A` (site brand coral), fold
  `neon`→coral (lime gone as general-purpose accent), `neonText`→cream
  `#F7F4EE`, `accent`→sage `#719B86`, bg→cream, night→warm ink family,
  food sticker lime→warm amber `#D9A441`. typecheck green.
- **Login de-compete**: neon/lilac radials replaced with subtle coral + sage
  ambient surfaces. No rainbow.
- **SVG icon set**: `IconConnections`, `IconProfile`, `IconGear`,
  `IconChevronRight`, `IconSparkle`, `IconMap`, `IconWarning`, `IconSend`,
  `IconWave` — stroke-based, 24×24, currentColor. `react-native-svg` 15.15.4
  was already in the project.
- **Discover nav restructure**: two `circleButton` anchors (connections SVG
  left, profile avatar right), username/kicker removed. Filter rail
  positioned below via `bandBottom` onLayout.
- **Profile page**: full replacement for old SettingsScreen. Night hero
  (avatar, kicker, handle, name), stats row (rep/connections/meetups),
  numbered interests index, mono group labels (APPS PREFS / ACCOUNT),
  language menu with coral check, sign-out, privacy note. Removed old
  SettingsScreen + Settings route from types/linking/RootNavigator.
- **Button grammar break (2026-09-03, supersedes the slab rule)**: buttons
  are back to pills to match the site's own CTA (`rounded-full` +
  `shadow-accent/20`). `primary` = coral pill with a coral glow; `neon` = the
  site's vinyl sticker look (hard offset underlay under the pill) for dark
  surfaces; `secondary`/`tinted`/`plain` follow. Pills are reserved for CTAs
  and data marks, never sprayed across chrome — "no pills-everywhere" still
  holds.
- **EventCard grammar break**: floating rect (bg/radius/elevation/border)
  → transparent edge-to-edge row with bottom hairline rule. Sticker (vinyl
  pop), kicker row (category + coral score mark), title, meta, occupancy.
  Score moved from `accentSoft` pill to tight coral numeric mark.
- **Discover sheet rows**: `feedbackRow` and `locationRow` converted from
  floating rects to editorial transparent rows with hairline rules.
  `hostButton` from pill → rectangular.
- **Emoji→SVG**: ScreenState loading stays ActivityIndicator; error →
  `IconWarning` (40px, nightMuted); empty → `IconMap`. MeetupScreen and
  FeedbackPanel celebration → `IconSparkle` (40px, coral). ChatThread
  empty → `IconWave` (32px, textMuted). AIChat send → `IconSend` (22px,
  primaryText); opener → `IconWave` (36px, coral). Dead glyph styles
  removed from all files.
- **i18n**: Profile keys (`profile.title`, `profile.heroKicker`,
  `profile.statConnections`, `profile.statMeetups`, `profile.prefsGroup`,
  `profile.accountGroup`) added to en/ja/zh.
- **Full typecheck green** (server + mobile) after all edits.

## Palette re-anchor (2026-09-05)

Driven by `assets/color pal.jpeg`. The swatches were sampled from the image
rather than read off its labels, which caught one discrepancy: **Orange Zest's
printed `#5E2638` does not match its own swatch**, which reads `#CE4503`. That
hex is a dark plum with no relationship to the citrus ramp either side of it;
the swatch wins.

| Was | Now | |
|---|---|---|
| `background` `#F7F4EE` | `#F5E5CC` | Champagne Glow |
| `text` `#171717` | `#1E1710` | warm ink — neutral black reads blue against this much yellow |
| `primary` coral `#FF432A` | `#CE4503` | Orange Zest |
| — | `primaryInk` `#9C3406` | **new** — the action colour at a text weight |
| `accent` sage `#719B86` | `#4F6B3A` | olive |
| `danger` `#B3402C` | `#7D0000` | Berry Pop |
| `night` `#171717` | `#231310` | berry desaturated to ink weight |
| `lime` `#C8FF00` / `limeInk` | `citrus` `#FF9E0F` / `citrusInk` | Neon Citrus |
| `neon` / `neonText` | *deleted* | `neon` had decayed into a plain alias of `primary` |
| `washCoral` / `washSage` | `washPrimary` / `washAccent` | named for role, not hue |
| `Button variant="neon"` | `variant="vinyl"` | it names a finish, not a colour |
| `TapeTone "lime" \| "coral"` | `"citrus" \| "action"` | same reason |

**Every value was solved against the actual ground, not carried over.**
Champagne is a full step darker than the cream it replaces, so weights that
passed before do not automatically pass on it — `textMuted` at its old
`#77716A` measures 3.90:1 here and would have shipped as a silent AA failure
across every muted label in the app. It is now `#6B6053` (4.96:1).

The same audit caught the inverse problem: **Orange Zest is a fill, not an
ink** (3.79:1 on the ground, 3.82:1 on night). Eleven text and small-glyph
sites were on `colors.primary` and moved to `primaryInk`; `EventCard`'s score
mark became dark-aware (`citrus` on night, `primaryInk` on cream) because it is
the one that renders on both.

Also folded in:
- **The vector city was retuned**, not left behind. Its twenty inline `fill=`
  literals are now one `CITY` constant derived from Champagne Glow, so Discover's
  ground is the page ground with streets drawn on it. Water stays blue — warmed
  and desaturated, but a warm-orange river stops reading as water, and map
  legibility outranks palette purity.
- **The category band was re-pitched, not re-hued.** Nine categories need nine
  distinguishable colours, so folding them into the warm ramp would destroy the
  thing they exist to do. What changed is register: the screen-neons (`#00F0FF`,
  `#FF2E93`, `#8A4FFF`) read as radioactive on champagne and are now at pigment
  weight. `food` resolves to Neon Citrus, which the palette supplies outright.
  Every `{bg, on}` pair still clears AA — two (`music`, `sports`) had to move
  because they did not.
- **The last retired literals are gone.** `rgba(250,247,242,…)` and
  `rgba(26,22,19,…)` in `BottomSheet`'s grabber, `#ffffff` in `TurnstileWidget`,
  and the two Login wash gradients — whose *transparent* stops were still the old
  coral and sage, so each wash was fading through a hue the palette no longer
  contains. Outside `theme/`, the only raw colours left in `src/` are Google's
  brand hexes in `BrandLogos.tsx`, which must not change.

## Editorial premium pass (2026-09-06)

Typography, materials and motion. Full log in `TRACKER.md` §7; the rules that came out of
it are in `docs/DESIGN.md` (Typography + Component grammar) and `CLAUDE.md`.

- **Inter bundled**, display tier to 56pt at −2.6 tracking, `tabular-nums` on caption.
  Noto Sans JP deliberately not bundled.
- **Two mono roles, rationed** — 39 tracked-caps labels across ~12 screens became 6
  kickers + 28 overlines, and `sectionHeader` is deleted.
- **The vinyl offset shadow now renders.** It never had: all five implementations inset
  the underlay behind the opaque body. One primitive draws it now.
- **New primitives**: `VinylShadow`, `ScrollEdge`, `NightCard`, `ScreenHeader`,
  `EditorialRow`, `ScoreMark` — each replacing three to five independent copies.
- **Discover**: identity islands on a real material (the pill chrome is gone), scroll
  edge on the sheet header, a three-member card family, the recommended meetup promoted
  to the top, staggered first paint, and an empty state with a Host action.
- **Meetup**: collapsing hero with the sticker lifting and counter-rotating, title
  handing off to a nav bar, and grouped spacing (32pt between regions) replacing one
  uniform 24pt gap.
- **Grain was attempted and removed** — `FeTurbulence` is unimplemented on Android and a
  tiled `Image` did not render either; both measured 0.00 variance. Not shipped.

## Known issues

<!-- Claude maintains this -->