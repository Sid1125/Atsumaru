# context.md — working context for the Atsumaru rewire

> Purpose: a durable record of *why* this work is happening and *what* was decided, so a
> fresh session (or a context reset mid-task) can resume without re-deriving anything.
> `CLAUDE.md` = how to work in this repo. `TRACKER.md` = what is built. **This file = the
> live state of the current task.**
>
> Started 2026-08-29. Update the Change Log section as work lands.

---

## 1. The ask

Analyze the React Native app, find why functionality is breaking, rewire it end to end,
and run it on a Pixel 9 Android emulator. Document everything; keep context durable.

## 2. Environment (verified, not assumed)

| Fact | Value |
|---|---|
| Repo root | `C:\Projects\Personal\Atsumaru\Atsumaru` |
| Node / npm | v22.19.0 / 10.9.3 |
| adb | `C:\Users\rcyas\AppData\Local\Android\Sdk\platform-tools\adb.exe` (not on PATH) |
| Emulator | `emulator-5554`, `sdk_gphone16k_x86_64`, Android 17, Pixel-class AVD |
| System Java | 1.8.0_51 — **too old for a native build**; Android Studio's JBR is the fallback |
| Android SDK env | `ANDROID_HOME` / `ANDROID_SDK_ROOT` both unset |
| `server/.env` | **does not exist** (only `.env.example`) |
| `apps/mobile/.env` | did not exist; created by this task (gitignored) |
| Mobile deps | installed (555 pkgs); `server/` and `site/` deps NOT installed |

Baseline before changes: `tsc --noEmit` clean, `expo-doctor` 20/21 (only `expo`
57.0.17 vs `~57.0.18` patch drift), `expo export --platform android` succeeded
(1123 modules → 2.7 MB Hermes bytecode), Metro served a dev bundle over HTTP 200.
**The app compiled and bundled fine before this work — the breakage is logical, not
build-level.**

## 3. Root causes found (evidence, not guesses)

### D1 — Onboarding is structurally unreachable *(critical)*
`RootNavigator` gates onboarding on `needsOnboarding = !!user && !user.handle`.
But `schema.sql` declares `handle text unique not null`, and `GET /auth/me`
(`server/src/modules/auth/routes.ts`) returns `{ user: null }` until onboarding writes
the row. So a non-null user *always* has a handle → the condition is never true →
`OnboardingStack` is dead code. A new user lands on `!user` → `AuthStack` → Login,
forever.
**Fix:** track authentication separately from profile completion. Signed-in +
`user === null` ⇒ onboarding.

### D2 — Nothing can persist a session token *(critical)*
`useAuthStore.signIn(token, user)` is the only writer to SecureStore and requires a
non-null `User`, which OAuth does not have for new accounts. It is called only from
`LoginScreen`, which is stubbed to an `Alert`. `authApi.session()` exists and is
correct but is never called, and no `atsumaru://auth` deep-link listener is registered.
**Fix:** `signIn(token, user | null)` + a real deep-link OAuth hook.

### D3 — `localhost` is wrong inside an Android emulator *(critical for the target device)*
`src/config/env.ts` defaults to `http://localhost:4000`. In an emulator that resolves to
the emulator itself; the host machine is `10.0.2.2`. Every REST call and the Socket.io
handshake would fail on the Pixel 9 even against a healthy server.
**Fix:** platform-aware default (`10.0.2.2` on Android) + `.env` override.

### D4 — Match score never reaches the event cards
`EventCard` accepts a `matchScore` prop; `DiscoverScreen` never passes it, so the
"91% group fit" figure required by `docs/DESIGN.md` §4 never renders on the list.

### D5 — `Message` type does not match the wire format
Mobile types `event_id: string`; the server returns `event_id: string | null` alongside
`connection_id: string | null` (one is always null — enforced by a CHECK constraint).
DM messages therefore do not type-check against the shared `Message` shape.

### D6 — Whole surfaces missing
No Connections list, no DM thread, no create-event screen, no settings/sign-out, no
push-token registration, no `match:unlocked` celebration. `useConnections` and
`connectionsApi` exist with nothing rendering them.

### Found *during* emulator testing (not visible from reading the code)

**D7 — `expo-notifications` crashes the app on launch in Expo Go.** Adding push
registration with a static `import` took the whole app down with a redbox before any
component mounted: Expo Go dropped Android remote push in SDK 53 and the module
reports it through the global error handler, so neither a `try/catch` around the import
nor one around a lazy `require()` contains it. **Fix:** check
`Constants.executionEnvironment` first and never load the module in Expo Go.
*Caught only by screenshotting — a redbox is not a logcat `FATAL`, so the log grep
came back clean while the app was dead.*

**D8 — Discover hangs on "Loading…" forever when the device has no GPS fix.**
`getCurrentPositionAsync` *hangs* rather than rejects, so the existing `.catch()` never
fired, `coords` stayed null, and `useNearbyEvents` (gated on `enabled: !!coords`) never
ran. Reproduces on any emulator without a simulated location and on a phone indoors
with a cold GPS. **Fix:** race the call against a 5s timeout, falling back to Shibuya.

**D9 — `VirtualizedList` nested inside a `ScrollView`.** The group chat `FlatList` sits
inside `MeetupScreen`'s `ScrollView`; React Native warns because windowing and scroll
handling both break. Pre-existing in `GroupChat` and inherited by `ChatThread`.
**Fix:** `ChatThread` virtualizes only when it owns the screen (`fill`, i.e. DMs) and
renders plain mapped rows when embedded.

**D10 — A completed meetup was unreachable.** `/events/nearby` correctly excludes
finished meetups, and nothing else listed them — `/events/mine` and `eventsApi.mine()`
existed with no caller. The only route in was the feedback push, which Expo Go cannot
receive, so feedback was untestable and a real user who missed the notification had no
way back. **Fix:** a "Your meetups" section on Discover, with completed ones flagged
"Leave feedback".

**D11 — DM composer read "Message your group…".** `ChatThread` reused the group
placeholder for 1:1 threads. **Fix:** scope-aware placeholder addressed by handle.

## 4. Decision — demo mode (user-selected)

No Supabase/Groq/OAuth credentials exist, so the real API 503s on every data route and
the meetup loop cannot run. **Chosen approach: a toggleable offline demo layer** so the
full loop runs on the emulator today, with all real wiring left intact and switching
back on the moment credentials land.

**Contract for the demo layer — do not violate:**
1. It sits *behind* `services/api/client.ts`, at the same seam the real client uses.
   Screens and hooks stay unaware of it (`docs/RULES.md` §5: centralize API requests).
2. It is a **stand-in for the server**, so it may implement server-side business logic
   (match scoring, mutual unlock, reputation). It mirrors
   `server/src/modules/matching/score.ts` rather than inventing a second model
   (`docs/RULES.md` §7). No scoring logic ever moves into a component.
3. It obeys every product rule: mutual-only unlock, private feedback, no `real_name`.
4. `EXPO_PUBLIC_DEMO_MODE=0`/absent ⇒ the real axios path, byte for byte as today.

## 5. How to run

```bash
# emulator must already be running
cd apps/mobile && npx expo start --android      # demo mode reads apps/mobile/.env

ADB="$HOME/AppData/Local/Android/Sdk/platform-tools/adb.exe"
"$ADB" devices                                  # expect emulator-5554
"$ADB" reverse tcp:8081 tcp:8081                # if Metro is unreachable from the device
```

Real (non-demo) mode additionally needs `server/.env` filled in, `server/db/schema.sql`
pasted into Supabase, and `npm run server` — see `TRACKER.md` §1.

## 6. Change log

All paths relative to `apps/mobile/`.

### Defect fixes

| File | Change |
|---|---|
| `src/config/env.ts` | Platform-aware host (`10.0.2.2` on Android) + blank-as-unset handling + `DEMO_MODE` flag. **Fixes D3.** |
| `src/store/index.ts` | Added `isAuthenticated`, separate from `user`; `signIn` now accepts `user: User \| null`. **Fixes D2.** |
| `src/features/auth/hooks/useSession.ts` | Returns `{ user, authenticated }`; a dead token falls back to signed-out instead of stranding a spinner. **Fixes D2.** |
| `src/app/navigation/RootNavigator.tsx` | Three-way `stage` gate (`auth` / `onboarding` / `app`) replacing the impossible `!user.handle` test; registers the new screens; wires `linking` + push registration. **Fixes D1.** |
| `src/types/api.ts` | `Message.event_id` and `.connection_id` are both nullable, matching the wire format. **Fixes D5.** |
| `src/screens/Discover/DiscoverScreen.tsx` | Fetches per-event match previews via `useQueries` and passes `matchScore` to `EventCard`; adds Connections / Settings / Host entry points. **Fixes D4.** |
| `src/services/api/events.ts` | `create()` accepts the `description` the server already supported. |
| `src/features/notifications/usePushRegistration.ts` | Expo Go detected via `Constants.executionEnvironment`; the native module is never loaded there. **Fixes D7.** |
| `src/screens/Discover/DiscoverScreen.tsx` | 5s race around `getCurrentPositionAsync`, falling back to Shibuya. **Fixes D8.** Restructured so the whole screen is one `FlatList` (header in `ListHeaderComponent`) — no nested scrollers. Adds the "Your meetups" section. **Fixes D10.** |
| `src/components/chat/ChatThread.tsx` | Virtualizes only when it owns the screen; mapped rows when embedded. **Fixes D9.** Scope-aware composer placeholder. **Fixes D11.** |
| `src/features/events/hooks/useEvents.ts` | `useMyEvents()` — first caller of `/events/mine`. |
| `src/services/api/demo/world.ts` | World held on `globalThis` so Fast Refresh cannot desync it from the auth store. |

### New wiring (D6)

| File | Purpose |
|---|---|
| `src/features/auth/hooks/useOAuthLogin.ts` | **new** — opens the provider, catches `atsumaru://auth?code=…`, trades the code via `POST /auth/session`. Guards against double-claiming a code. |
| `src/app/navigation/linking.ts` | **new** — deep-link map for the `atsumaru://` scheme. |
| `src/features/notifications/usePushRegistration.ts` | **new** — best-effort Expo push registration; every failure path is a no-op. |
| `src/features/chat/hooks/useLiveThread.ts` | **new** — REST history + realtime merge, dedupe by id, used by both chat surfaces. |
| `src/components/chat/ChatThread.tsx` | **new** — the shared chat component; **`components/chat/GroupChat.tsx` was deleted**, superseded by this. |
| `src/screens/Connections/ConnectionsScreen.tsx` | **new** — mutual connections list. |
| `src/screens/Connections/DmScreen.tsx` | **new** — 1:1 thread. |
| `src/screens/Settings/SettingsScreen.tsx` | **new** — language override → `PATCH /users/me`, sign-out, reputation. |
| `src/screens/Events/CreateEventScreen.tsx` | **new** — FR-13 host flow. |
| `src/services/api/users.ts` | **new** — `me` / `byId` / `updateMe`. |
| `src/services/api/errors.ts` | **new** — `ApiError` extracted so client ↔ demo is not a cycle. |
| `src/screens/Meetup/MeetupScreen.tsx` | `match:unlocked` handler + celebration + route into the DM; uses `ChatThread`. |
| `src/components/feedback/FeedbackPanel.tsx` | Celebration state with a "Start chatting" CTA; the no-unlock branch still reveals nothing. |
| `src/screens/Auth/LoginScreen.tsx` | Real OAuth via `useOAuthLogin`; the `Alert` stub is gone. |
| `src/i18n/locales/{en,ja,zh}.json` | +21 keys each (`common.send`, `auth.demoNote`, `meetup.chatEmpty`, `feedback.thanksTitle`, `connection.*`, `settings.*`, `createEvent.*`). **77 keys, all three in parity.** |

### Demo layer

| File | Purpose |
|---|---|
| `src/services/api/demo/world.ts` | **new** — seeded world mirroring `server/scripts/seed.ts`: 6 users, 4 Shibuya meetups (open / nearly-full / ongoing / completed), chat history. Mutable in-session state. |
| `src/services/api/demo/index.ts` | **new** — the request router: every endpoint the app calls, matching `docs/API_STRUCTURE.md` §3 response shapes. Holds the server-side logic (scoring, mutual unlock). |
| `src/services/api/client.ts` | One branch at the transport seam: `DEMO_MODE` → `demoRequest`, else axios. Everything above it is unchanged. |
| `src/services/socket/index.ts` | Demo transport for realtime — same exported surface, local emitter instead of socket.io; persists before broadcasting, like the server. |
| `.env` | **new** (gitignored) — `EXPO_PUBLIC_DEMO_MODE=1`. |

**Onboarding hand-off in demo mode:** completing onboarding adopts the new user into
`e-ramen-retro` (upcoming, for group chat) and `e-cafe-crawl` (completed, for feedback),
and pre-seeds `@harucafe`'s reciprocal pick — so the first honest feedback submission
produces a *real* mutual unlock rather than a scripted one.

## 6b. UI revamp (Apple design) — 2026-08-29

Applied the `apple-design` skill (WWDC *Designing Fluid Interfaces* / *Details of UI
Typography* / *Principles of Great Design*), translated from its web framing to RN:
springs → Reanimated, `backdrop-filter` → `expo-blur`, Pointer Events →
`react-native-gesture-handler`, plus `expo-haptics` for the multimodal rule.

**New dependencies** (all Expo Go compatible — no dev build needed):
`react-native-reanimated` 4.5.1, `react-native-gesture-handler` 2.32.0,
`react-native-svg` 15.15.4, `expo-blur`, `expo-haptics`, `expo-linear-gradient`.
Reanimated 4 compiles worklets through `react-native-worklets`, which needs
`babel.config.js` with `react-native-worklets/plugin` **last** — the project had no
babel config at all before this.

### Design system (`src/theme/`)

| File | What it establishes |
|---|---|
| `tokens.ts` | Semantic colours (screens never touch the raw palette), 4pt spacing scale, radii, and a three-step elevation ramp where bigger surfaces read as thicker. |
| `typography.ts` | A 12-role scale where **tracking and leading are size-specific** — negative tracking on display sizes, positive on caption. The old scale had no tracking at all, which is what made the app read as stock React Native. |
| `motion.ts` | Apple's **damping + response** parameters converted to Reanimated's mass/stiffness/damping, so animations are specified as a designer would state them. Also the momentum-projection and rubber-band functions, and `useReducedMotion`. |

### The map (`src/components/map/`)

Replaces the dashed "needs a dev build" placeholder — the least finished thing in the
app — with a hand-authored vector city.

- `geo.ts` — lat/lng → world projection, plus a generated street network (arterials and
  secondaries hand-placed; the residential grid is generated with seeded jitter, because
  a regular grid reads as graph paper). Districts, parks, a river and a rail corridor.
- `MapCanvas.tsx` — the static SVG art. Roads are drawn as a casing stroke plus a
  lighter fill stroke, which is what makes vector lines read as *roads*. Memoised and
  never re-rendered during gestures: the gesture layer transforms the container, so
  panning stays on the compositor.
- `InteractiveMap.tsx` — 1:1 pan, pinch-to-zoom about the focal point, double-tap
  anchored to the tap, momentum projection into a velocity-handed-off spring,
  rubber-banded edges, independent X/Y springs, and a camera that frames the annotations.
- `MapPin.tsx` — pins **counter-scale against zoom** so they stay readable and tappable
  at every zoom level, grow up-and-out toward the finger on selection, and carry a
  callout. Map ↔ list selection stay in sync in both directions.

### Bugs found by building it

**D12 — disabled buttons rendered as enabled.** `PressableScale` wrote `opacity` on
every frame, silently overriding the `opacity: 0.45` the Button set for its disabled
state (the animated style merges last). Compounded on the emulator, which reports
reduce-motion on. **Fix:** the press animation no longer emits `opacity` unless it owns
it, *and* the disabled state is expressed in colour rather than opacity — a state that
important should not depend on which style merges last.

**D13 — map framing was silently clamped.** Vertical pan limits were measured against
the full view height while the bottom ~45% sits behind the sheet, so the world could
barely move vertically and any attempt to frame content in the visible band was clamped
away. **Fix:** bounds measure against the sheet's deepest exposure, and the fit centres
within the band *below the floating chrome* rather than from y=0.

## 7. Verification log

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 after the rewire |
| Demo-layer smoke test (20 assertions, headless) | all passed — onboarding extraction, handle collision, discovery, match preview, join, chat paging, feedback, **exactly one mutual unlocked**, **non-mutual pick absent from the response**, DM round-trip |
| i18n parity | en/ja/zh = **84 keys each**, no missing, no extra |

### Emulator run — Pixel_9 (`emulator-5554`, Android 17), Expo Go, demo mode

Bundle: 1327 modules, no errors. Every step below was confirmed by screenshot, not by
log absence (see D7 — a redbox does not appear in logcat).

| Step | Result |
|---|---|
| Launch | Login renders; demo note shown |
| Sign in | Loading state on the tapped provider, the other disabled; session minted |
| Route to onboarding | **Reached AI chat — the D1 fix.** Also verified on relaunch: token present + profile absent → onboarding, where the old build showed Login forever |
| AI chat | 3 turns, follow-ups in the user's language, extraction from free text (`hiking`, `coffee`, `board games`, `retro games`, `chill`) |
| Handles | Suggestions generated from interests; `@trailbrew` reads as taken; debounced availability check shows "Available"; CTA disabled until a handle is picked |
| Complete | Profile created, routed to Discover |
| Location | One-shot foreground prompt only — no background request |
| Discover | 3 nearby meetups, finished one correctly excluded, **group-fit % on every card (the D4 fix)**, map placeholder as designed |
| Your meetups | Both adopted meetups listed; completed one flagged "Leave feedback" (the D10 fix) |
| Meetup | Members, 35% fit, why-reasons, join/leave, seeded group chat |
| Feedback | Self excluded; emoji ratings carry text labels (`docs/DESIGN.md` §10); privacy note; submit gated on a rating |
| **Mutual unlock** | Rated 🔥/🙂 and picked **two** people, only one reciprocated → **exactly one unlock; the non-mutual pick appears nowhere in the UI** (`docs/RULES.md` §9) |
| DM | Opened from the celebration CTA, header `@harucafe`, message sent and rendered with timestamp |
| Final state | Zero JS errors, zero fatals in logcat |

**Known limitation:** the `atsumaru://` deep link does not route in Expo Go (custom
schemes need a dev build), so the push-notification path into feedback could not be
exercised on-device. "Your meetups" is the tested route in. `linking.ts` is wired and
should be re-verified in a dev build.
