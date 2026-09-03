# Atsumaru Visual Overhaul

## Objective

Bring the entire React Native app into the Atsumaru website's visual
language.

## Locked decisions

- Cream + ink + coral + sage core palette
- Coral = brand/action/payoff
- Sage = trust/compatibility/success
- Category colors = localized content only
- **Electric band (lime `#C8FF00`) returned 2026-09-03** as the Gen-Z
  register — highlighter marks, tape badges, sticker highlights. It is never
  the action colour and never appears on generic chrome; only where the site
  wears it (marker on the wordmark, tape on status, sticker on payoff figures)
- Dark Discover remains dark but uses warm ink
- Editorial component language
- **Pills where the site has them, never everywhere**: CTAs are pills with a
  coral glow (`primary`) or a hard vinyl shadow (`neon`), matching the site's
  `rounded-full` CTA + `.sticker-badge`; pills are not used as a catch-all
- **Vinyl marks the moments, soft depth carries the surfaces**: hard offset
  shadows only on CTAs/tape/stickers/stats strips (the site's `2px 3px 0`
  shadow), never on every card
- No uniform card system
- No generic React Native UI
- Preserve functionality

## Progress

- [x] Design tokens (cream/ink/coral/sage, neon→coral, food amber)
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

## Known issues

<!-- Claude maintains this -->