# Visual Bug Report — Atsumaru Android release APK

- Build: `:app:assembleRelease` from main `421f70a`, debug-signed, 178.5 MB
- Device: Pixel_10a emulator (1080x2424), portrait
- Backend: Render live API, fresh account `qasweep01@test.com`, onboarding completed via AI chat
- Screenshots: `C:\Users\siddh\AppData\Local\Temp\opencode\shot*.png`
- Status: report only, zero fixes applied

## B1 — Back chevron overlaps left-aligned header title (high, 4 screens)
Native stack header: title starts under `<` glyph.
- `shot03` EmailAuth: `<` sits on "Log in or sign up"
- `shot20` Feedback modal: `<` sits on "How was Ramen Night?"
- `shot22` Profile: `<` touches "Profile"
- `shot17` GroupChat: `<` crowds "Karaoke Night" (mild)
- Counter-examples (OK): `shot23` Connections, `shot33` Edit profile — same `headerOptions`, no overlap. Inconsistent → inset/margin issue, not theme.

## B2 — Status-bar icons unreadable on dark surfaces (high, 3 screens)
- `shot01/02/03` Login + EmailAuth: dark clock/icons on near-black `#1E1710`. `RootNavigator` sets `light` for auth stage — not taking effect in release.
- `shot16/19` Meetup transparent header: dark icons over dark hero photo.

## B3 — Interest pills show raw slugs with underscores (med-high, 2 screens)
- `shot13` ProfileConfirm, `shot22` Profile: `curry_rice`, `jazzy_cafe`, `matcha_sweets`, `cozy_hideaway`, `shinjuku_cafe_crawl`. Needs human labels.

## B4 — "Member since Invalid Date" (med, Profile)
- `shot22`: join-date parse/format fails for fresh account.

## B5 — Map pin collisions, no declutter (med, Discover)
- `shot14/15/18`: "Ramen Night" pin overlaps "Karaoke Night" + "Indie Films"; stacked labels unreadable.
- Tap fallout: tapping "Show list" (`shot27`) selected a pin instead — pin hit-targets overlap sheet touch zone.

## B6 — Expanded sheet card truncation + crowded bottom row (med, Discover)
- `shot18`: card title cut as "Ramen Night ..."; bottom strip squeezes "View details" button and tab-bar icons (compass/person) onto one row.

## B7 — Host "+" FAB clipped at screen edge (med-low, Discover)
- `shot29`: plus button half off-screen right on the "Explore more" map card.

## B8 — PastMeetups has no back affordance (low)
- `shot24`: no `<` chevron (Connections has one). System-back only exit.

## B9 — PastMeetups card data suspects (low)
- `shot24`: both cards "12:00 AM" (UTC-midnight formatting?); second title garbled "Morning Sketch ... Ramen Night" (two titles concatenated or title/subtitle collision).

## B10 — Password field has no show/hide toggle (low, EmailAuth)
- `shot06`: masked only, no eye icon.

## B11 — Venue map preview "unavailable" in full native build (suspect, CreateEvent)
- `shot30`: "Map preview unavailable / precise pinning needs a dev build with Mapbox" — but this IS a full build with `@rnmapbox/maps` plugin + token. Suggests `hasMapbox()` false in release. Needs verification, not confirmed visual-only.

## B12 — Onboarding entry redundancy (info)
- `shot07`: text input AND "Start chatting" button do the same thing.

## B13 — Search placeholder vanishes when field unfocused (med, Discover)
- `shot41/44`: empty search shows magnifier only, no "Search meetups". Placeholder returns on focus (`shot43`). Should persist while empty.

## B14 — Venue picker is an ad-laden Google webview; ads escape to YouTube (high, CreateEvent)
- `shot47`: "Find a venue" renders google.com search ("cafes in Shibuya", English) — spec (`CLAUDE.md` map section, `services/places.ts`) says Mapbox Search Box with `language=ja`. Wrong provider + wrong language.
- `shot46`: tapping the top ad ("7:00 PM ... booking") broke out of the app into Chrome → YouTube. No in-app containment for ad clicks.

## B15 — Venue result titles truncated (med, VenuePicker)
- `shot47`: "Xian ...", "Ramen ..." — result rows ellipsis-cut with room to spare.

## B16 — B1 family gains a screen: "Host a meetup" (CreateEvent)
- `shot48`: `<` overlaps "Host a meetup". Same native-header inset issue as B1.

## B17 — Sweep-1 gap (process, not a bug)
Sweep 1 never passed the system location dialog (`shot40`Proof): all Discover findings were pre-permission state. Sweep 2 covered: allow path (no map change — emulator has no fix, "Precise location off" pill + rationale sheet `shot42` all clean), deny path (graceful "Location is off — showing Shibuya · Turn on" banner, `shot59`, dismissible, map usable).

## B18 — Sign Out fires with no confirmation (med-low, Profile)
One tap on "Sign Out" → instant logout to Login. No "are you sure" — cheap mis-tap costs the whole session (SecureStore cleared).

## B19 — Time picker OK never commits (high, CreateEvent)
- `shot79/80/81`: native clock set 2:45 AM then 3:00 AM, OK tapped (dialog closes per UI dump — tap lands), field stays "01:18 AM". Date picker commits fine (`shot83`). Time stuck at creation default → no same-day future event publishable via UI.

## B20 — "4 members · 7 online" contradiction (med, GroupChat)
- `shot71`: header claims 4 members but 7 online. Presence counts sockets, not members — visible nonsense.

## B21 — Hosted meetup + one-hour ask (info, CreateEvent)
- Time picker (B19) blocked +1h: published "QA shibuya sweep", Food, Shibuya default venue, Sep 15 2:45 AM (first 2:45 setting committed late — picker state applies inconsistently). 1/6, host sees Leave (not Join), empty chat "Be the first to say hello" (`shot85`), Wrap Up correctly gated "Feedback opens after the meetup" (`shot86`). Venue default + map-unavailable disclosure both render (`shot74`).
- API shortcut failed: `/auth/login` 401 INVALID_CREDENTIALS from curl while app login works — adb-typed password deterministically mangled (exact transform unknown; 4 guesses failed, stopped to avoid lockout).

## B22 — B13 refined: placeholder missing only after first search
Fresh launch shows "Search meetups" (`shot72`); placeholder loss (`shot41/44`) triggers after first search/clear cycle.

## B23 — Outdoor chip OK (checked, not a bug)
5 chips (All/Food/Games/Art/Outdoor) all filter; row fits 1080px, "Outdoor" fully visible (`shot72`).

## OPS — Cron cannot keep Render awake (infra, not visual)
- `.github/workflows/keepalive.yml` pings `/health` every 5 min, but GitHub routinely drops sub-hourly ticks on free repos (~1 in 80 observed firing). Render free sleeps after ~15 min idle → service cold-boots mid-sweep (30–60 s stalls, dead sockets, paused sweep). File itself says fix = external 5-min uptime monitor (e.g. UptimeRobot) on `/health`; cron stays as redundancy + Supabase daily ping only.

## User-reported batch (added verbatim, not independently verified)
- **U1 — Chat not live.** Messages take time to appear; server side isn't truly realtime.
- **U2 — Locate button misplaced.** Stuck mid-screen vertically on right edge; belongs lower on same side.
- **U3 — Category chips overlap** the profile/connections/past-meetups pill on the map.
- **U4 — Radius selector missing.** 5/10/30/60 km meetup-range selector still doesn't exist.
- **U5 — PastMeetups shows "something went wrong."** (This pass: clean empty-state, error not repro'd — plausibly Render cold-boot fetch failure; see OPS.)
- **U6 — Edit Profile interest Add button overflows** right of textbox, half off-screen. (Confirmed on-device `shot93`: + Add bleeds past right edge.)
- Partial device cross-checks this pass: locate mid-right confirmed (`shot90`); no radius UI anywhere on Discover; chips-vs-pill overlap not visible in current states (`shot90/91`) — may need pins present.
- **U7 — Host screen start input (change request).** Rename "Starts in (hours)" → "Starts on"; replace hour-only input with a combined date+time input.

## Not covered (no path without seed data / second user)
- Dm thread (no connection exists; shares `ChatScreenShell`/`ChatThread` with verified GroupChat — low risk)
- Sign-out → re-login, JA/ZH locales, push cold-start, offline/error states, landscape (app is portrait-locked)

---

# Resolution pass — 2026-09-14

Branch: `feat-visual-overhaul`, fast-forwarded to `main` (421f70a) and then merged with
PR #14 (`fix/event-create-datetime-category`) so one tree has both PastMeetups (#13) and
the date+time picker. Verified in Expo Go on a Pixel-class Android 17 emulator
(1080x2424), demo mode.

## Two blockers found before any bug could be reproduced

| | |
|---|---|
| **Duplicate `IconClock`** | #13 and #14 each added one; git merged both without a conflict, so the bundle failed with `Identifier 'IconClock' has already been declared`. Deduped. |
| **`app.json` `extra.eas.projectId: null`** | Serialises to `{}` in the manifest, which makes `expo-updates` report *misconfigured* rather than *absent* — Expo Go refused to launch the project at all ("Something went wrong"). An absent key means "not configured"; a null one means "configured with garbage". Removed. |

## Fixed and verified on device

| ID | Fix |
|---|---|
| **B1 / B16** | `headerTitleAlign: "left"` is now iOS-only. Android's native header already places the title after the back button; forcing `left` put it at the container edge, so long titles started under the chevron. Short ones cleared it, which is why it looked inconsistent rather than broken. |
| **B2** | Status-bar style moved from *navigation stage* to *screen*. The auth stage holds two grounds — Login (night) and EmailAuth (champagne) — so one `light` for the stage rendered white icons on cream. Login and EmailAuth now each declare their own. |
| **B3** | New `src/tagLabel.ts` humanises slugs at the render layer: `curry_rice` → "Curry rice". Demo data is already clean, which is why this only showed against the live API. |
| **B6** | Card titles wrap to two lines (`compact` still clips at one). The ellipsis was the line cap, not the width. |
| **B8** | PastMeetups rendered its own `ScreenHeader` *plus* the stack's `title` — the screen printed its name twice and repeated that header in all four branches. Body header removed; the native one keeps the back chevron. |
| **B9** | `EventCard` formats a **completed** meetup as a date ("Sep 13, 2026") instead of weekday+clock. Both past cards read "12:00 AM" because a completed `start_time` often carries a date-only timestamp. |
| **B10** | `TextField` renders a reveal toggle whenever `secureTextEntry` is set, so every password field in the app gets one. |
| **B18** | Sign out asks first (`Alert`, destructive style). |
| **B19** | **Root cause: the picker's `onChange` is deprecated in `@react-native-community/datetimepicker` 9** and does not reliably deliver the confirmed value — a runtime warning says so. Migrated to `onValueChange` + `onDismiss`. Verified: setting 3 PM and tapping OK now commits (field reads "3:08 PM"); it previously kept the creation default. |
| **U2** | The locate control was pinned to `bottom: 48%` — the *default* sheet detent, i.e. dead centre — and stayed there when the sheet moved. It now tracks the live detent. |
| **U3** | `bandBottom` is `0` until the identity rail reports layout, so the first painted frame put the filter chips on top of the handle/profile island. Given a real first-frame fallback. |
| **U5** | PastMeetups had no `ScreenState` at all: a failed fetch showed an unstyled "Something went wrong" with **no retry**. Now loading/empty/error all go through `ScreenState` with `onRetry`. |
| **U6** | Two causes. `TextField` forwarded the caller's `style` to the inner `TextInput`, never the wrapper, so `flex: 1` landed on the wrong view (added `containerStyle`); and the "+ Add" button's width came from a translated string. It is now a fixed 44pt icon button, so the row cannot overflow in any locale. |
| **U7** | Satisfied by PR #14 — "Starts in (hours)" is replaced by a **When → Date + Time** group. Dead `startsIn` key removed from all three locales. |

Also fixed while in the area: PastMeetups cards had `onPress={() => {}}` — a chevron that
did nothing; they now open the meetup.

## Fixed, not verified on device

| ID | Why not |
|---|---|
| **B5** | Selected pins carry `zIndex`, but on Android **`elevation` outranks `zIndex`** and every `PinBody` shares `elevation.medium`, so ordering fell back to source order and a neighbour covered the selected pin's label. Selected pins now raise elevation too. Needs genuinely colliding pins to confirm. True declutter (clustering/spiderfy) is a feature, not a fix, and is **not** done. |
| **B11** | Root cause confirmed: **`eas.json` declared no `env` for any profile, and EAS Build never reads the local `.env`** — so the release APK shipped a blank `EXPO_PUBLIC_MAPBOX_TOKEN`, making `hasMapbox()` and `hasPlaceSearch()` both false. Reproduced locally ("Place search is off, so the meetup pins to central Shibuya"). `eas.json` now declares the non-secret values; the Mapbox and Turnstile keys must be created as EAS environment variables (commands in `.env.example`) because they must not be committed. Confirming needs an actual build. |
| **B15** | Venue rows now wrap to two lines. Needs a Mapbox token to see results. |

## No matching code in this repository

Grepped every one of the 12 remote branches. These strings exist nowhere, so the
screenshots came from a build that was never pushed — they cannot be fixed from this tree
and were **not** implemented speculatively:

- **B4** "Member since" · **B20** "N online" · **B5** "Show list" button ·
  **B6** "View details" + compass/person tab bar · **B7** "Explore more" card and the `+` FAB ·
  **B17** "Precise location off" / "Location is off" banner
- **B13 / B22** — there is no search field on Discover at all in this tree.
- **B12** — no "Start chatting" button on the onboarding screen; only the composer.
- **B14** — `services/places.ts` is pure Mapbox Search Box with `language=ja`. There is **no
  WebView and no Google** anywhere in `VenuePicker`. The nearest real defect is B11 above.

**Please confirm which build produced those screenshots** — most likely an unpushed local
branch.

## Untouched

- **U1** (chat not truly realtime), **U4** (radius selector — a feature that does not exist),
  **B21**, and **OPS** (Render cold-start / cron) are backend or feature work, not visual fixes.
- **B9's** "garbled title" (two titles concatenated) could not be reproduced on demo data.

## Verification

`npx tsc --noEmit` clean (mobile + server); i18n parity 201/201/201; `npm test` 105 pass /
1 fail — the failure is the pre-existing `oauth.test.ts` `ERR_INVALID_URL` from a missing
`server/.env`, and no server code was touched.
