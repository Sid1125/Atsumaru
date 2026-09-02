# Graph Report - WeLiveAppathon  (2026-09-02)

## Corpus Check
- 208 files · ~218,920 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1275 nodes · 2632 edges · 120 communities (64 shown, 56 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Map Rendering & Geo
- OAuth & Session
- Background Jobs & Matching
- Shared UI Components
- Server Dependencies
- DB Queries & Socket
- Mobile App Bootstrap
- Server Routes & Middleware
- Navigation & Auth Hooks
- Demo Mode API
- Recap & Rate Limiting
- Site TypeScript Config
- Server Config & AI
- Meetup & Feedback UI
- UI Primitives & Motion
- Marketing Page Sections
- API Types & Hooks
- Socket & Live Chat
- Common UI Components
- Connections & Profile
- Device Identity & Keystore
- Root Package Config
- Project Documentation
- Server TypeScript Config
- Seed Script & Demo Data
- Onboarding Screens
- Demo World State
- Marketing App Preview
- Site Dependencies
- Site Dev Tooling
- Site Interactive Elements
- Context & Rationale Docs
- Mobile Core Dependencies
- Site Hero Section
- Login Screen UI
- Mobile API Client
- Architecture Concepts
- Site Layout & Setup
- Site Nav & Ticker
- Site Sticker System
- Mobile Package Config
- Design & Visual Docs
- Server Check Config
- Site Activities Section
- Site AI Chat Demo
- Site Sound Engine
- Site Package Config
- Product Requirements
- Mobile Dev Dependencies
- Typography System
- Product Vision Docs
- Server Device Verification
- API & TRD Docs
- Matching Reasons
- Mobile Brand Assets
- Mobile TypeScript Config
- Friendship-First Concept
- Site Wave & Utils
- SQL Migration Script
- Root TypeScript Config
- Supabase Keepalive CI
- Site Button Component
- Site Phone Mockup
- Site Typewriter Effect
- Axios Dependency
- Expo Blur Dependency
- Expo Constants Dependency
- Expo Haptics Dependency
- Expo Linear Gradient
- Expo Localization
- Expo Notifications
- Expo Secure Store
- i18next Dependency
- react-i18next Dependency
- Reanimated Dependency
- Safe Area Context
- React Native Screens
- React Native SVG
- Worklets Dependency
- React Navigation Core
- Navigation Native Stack
- Mapbox Maps Dependency
- React Query Dependency
- Zustand Dependency
- Hero & Globe Assets
- Interest Ceiling Rationale
- Frontend API Layer Docs
- GSAP Dependency
- Site Agent Config
- Site ESLint Config
- Next.js Config
- Site React Dependency
- Tailwind Merge
- React DOM Types
- PostCSS Config
- File & Window SVGs
- Next & Vercel SVGs
- Android Icon Background
- Default App Icon
- AI Surface Boundary
- Hybrid OAuth Flow
- Backend Matching Rule
- Real Name Privacy
- Recap Per-User Privacy
- Sweep Atomicity Issue
- Three-URL Agreement
- OTP Isolation Rule
- 503 Graceful Degradation
- API Envelope Pattern
- Secure Store Tokens
- Android-First Expo
- Navigation Doc
- Socket Service Doc
- Zustand Doc
- Match Moments Not People
- Site Next.js Scaffold

## God Nodes (most connected - your core abstractions)
1. `db()` - 38 edges
2. `dbError()` - 37 edges
3. `colors` - 25 edges
4. `useAuthStore` - 23 edges
5. `useReducedMotion()` - 22 edges
6. `spacing` - 22 edges
7. `radius` - 20 edges
8. `demoRequest()` - 18 edges
9. `MeetupEvent` - 17 edges
10. `HttpError` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Android adaptive icon foreground layer` --semantically_similar_to--> `Atsumaru brand mark - primary logo`  [INFERRED] [semantically similar]
  apps/mobile/assets/android-icon-foreground.png → assets/atsumaru-mark.png
- `Android adaptive icon monochrome layer for themed icons` --semantically_similar_to--> `Atsumaru brand mark - primary logo`  [INFERRED] [semantically similar]
  apps/mobile/assets/android-icon-monochrome.png → assets/atsumaru-mark.png
- `Web/app favicon image` --semantically_similar_to--> `Atsumaru brand mark - primary logo`  [INFERRED] [semantically similar]
  apps/mobile/assets/favicon.png → assets/atsumaru-mark.png
- `Expo splash screen icon shown during app loading` --semantically_similar_to--> `Atsumaru brand mark - primary logo`  [INFERRED] [semantically similar]
  apps/mobile/assets/splash-icon.png → assets/atsumaru-mark.png
- `Demo mode — EXPO_PUBLIC_DEMO_MODE=1 replaces API with in-app demo` --conceptually_related_to--> `Core product loop — AI onboarding → meetup → group → chat → feedback → connection`  [INFERRED]
  WIRING.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Supabase keepalive system — workflow + RPC + migration + project** — github_workflows_keepalive_yml_keepalive_workflow, github_workflows_keepalive_yml_ping_keepalive, claude_md_supabase_project_ucxgvtcqoeazuhsgwbhf, concept_pgrst202_schema_cache [EXTRACTED 1.00]
- **OAuth authentication flow — Google PKCE, LINE exchange, three-URL agreement** — docs_trd_md_hybrid_oauth_provider_brokering, claude_md_hybrid_oauth_flow, context_md_auth_session_log, concept_auth_state_secret_hardcoded, rationale_hybrid_oauth [EXTRACTED 1.00]
- **AI pipeline — Groq onboarding + vibe recap, HuggingFace embedding, template fallback** — docs_ai_md_groq_onboarding_chat, docs_ai_md_vibe_recap, docs_ai_md_milveml_embedding, concept_sanitize_recap, concept_template_recap_floor, docs_ai_md_ai_safety [EXTRACTED 1.00]
- **Mobile app brand assets derived from central Atsumaru mark** — assets_atsumaru_mark, apps_mobile_assets_android_icon_foreground, apps_mobile_assets_android_icon_monochrome, apps_mobile_assets_favicon, apps_mobile_assets_splash_icon [INFERRED 0.85]
- **Site framework and deployment branding assets from Next.js + Vercel defaults** — site_public_next_svg, site_public_vercel_svg, site_public_file_svg, site_public_globe_svg, site_public_window_svg [INFERRED 0.75]

## Communities (120 total, 56 thin omitted)

### Community 0 - "Map Rendering & Geo"
Cohesion: 0.07
Nodes (43): EventCardProps, CHROME_HEIGHT, EXPOSED_FRACTION, SHEET_MAX_EXPOSURE, ARTERIALS, blocks, buildBlocks(), buildResidential() (+35 more)

### Community 1 - "OAuth & Session"
Cohesion: 0.09
Nodes (44): hasLine, authDb(), PUBLIC_USER_COLUMNS, authClient(), authorizeUrl(), callbackWithState(), claimVerifier(), CONFIG (+36 more)

### Community 2 - "Background Jobs & Matching"
Cohesion: 0.09
Nodes (41): intervalRunner(), JobRunner, startJobs(), startQueue(), sweepOnce(), throttledLogger(), dueForReminder(), dueForSettlement() (+33 more)

### Community 3 - "Shared UI Components"
Cohesion: 0.08
Nodes (32): CATEGORY_GLYPH, CATEGORY_ORDER, categoryGlyph(), categorySticker(), Chip(), ChipProps, styles, EventCard() (+24 more)

### Community 4 - "Server Dependencies"
Cohesion: 0.05
Nodes (42): cors, dotenv, express, groq-sdk, dependencies, bullmq, cors, dotenv (+34 more)

### Community 5 - "DB Queries & Socket"
Cohesion: 0.14
Nodes (34): clearDeviceChallenge(), CONNECTION_COLUMNS, ConnectionRow, db(), DeviceKey, findEvent(), findMembers(), getDeviceKey() (+26 more)

### Community 6 - "Mobile App Bootstrap"
Cohesion: 0.06
Nodes (33): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, permissions, predictiveBackGestureEnabled (+25 more)

### Community 7 - "Server Routes & Middleware"
Cohesion: 0.11
Nodes (28): EventRow, toApiEvent(), supabase(), app, httpServer, AuthedRequest, requireAuth(), verifySocketToken() (+20 more)

### Community 8 - "Navigation & Auth Hooks"
Cohesion: 0.11
Nodes (26): linking, AppStack, AuthStack, headerOptions, navigationTheme, OnboardingStack, RootNavigator(), AppStackParamList (+18 more)

### Community 9 - "Demo Mode API"
Cohesion: 0.11
Nodes (35): buildRecap(), DemoMessageListener, demoRequest(), DONE_REPLY, eventStatusIsClosed(), extractFrom(), findEvent(), FOLLOW_UPS (+27 more)

### Community 10 - "Recap & Rate Limiting"
Cohesion: 0.11
Nodes (25): DemoUser, Rating, OwnFeedbackRow, recapLimiter, recapRouter, RecapRow, MAX_RECAP_CHARS, MAX_RECAP_TRAITS (+17 more)

### Community 11 - "Site TypeScript Config"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 12 - "Server Config & AI"
Cohesion: 0.10
Nodes (23): env, hasEmbeddings, hasGoogle, hasGroq, hasRedis, hasSupabase, parsed, provided (+15 more)

### Community 13 - "Meetup & Feedback UI"
Cohesion: 0.13
Nodes (18): FeedbackPanel(), FeedbackPanelProps, RATINGS, styles, styles, VibeRecapCard(), VibeRecapCardProps, useEvent() (+10 more)

### Community 14 - "UI Primitives & Motion"
Cohesion: 0.16
Nodes (22): InteractiveMap(), BottomSheet, BottomSheetProps, SheetDetent, styles, AnimatedPressable, Feedback, PressableScale() (+14 more)

### Community 15 - "Marketing Page Sections"
Cohesion: 0.15
Nodes (17): AISection(), CoreStatement(), HowItWorks(), JapanSection(), approaches, ProblemSection(), features, SafetySection() (+9 more)

### Community 16 - "API Types & Hooks"
Cohesion: 0.16
Nodes (16): Scope, api, connectionsApi, WorldState, eventsApi, AuthState, ChatTurn, EventStatus (+8 more)

### Community 17 - "Socket & Live Chat"
Cohesion: 0.12
Nodes (21): useLiveThread(), handleSignOut(), demoAppendMessage(), demoCurrentUser(), emitDemoMessage(), onDemoMessage(), onDemoUnlock(), ConnectionStatus (+13 more)

### Community 18 - "Common UI Components"
Cohesion: 0.12
Nodes (15): ChatThreadProps, styles, Button(), ButtonProps, styles, ScreenState(), ScreenStateProps, styles (+7 more)

### Community 19 - "Connections & Profile"
Cohesion: 0.13
Nodes (17): Avatar(), AVATAR_COLORS, colorForId(), SIZES, styles, IconChevronRight(), useConnections(), useMyEvents() (+9 more)

### Community 20 - "Device Identity & Keystore"
Cohesion: 0.19
Nodes (15): deviceIdentityAvailable(), getDeviceId(), hexToBase64(), newDeviceId(), registerDeviceIdentity(), deleteKey(), DEVICE_KEY_ALIAS, ensureKey() (+7 more)

### Community 21 - "Root Package Config"
Cohesion: 0.09
Nodes (22): @expo/ngrok, dependencies, expo, description, devDependencies, @expo/ngrok, @types/react, typescript (+14 more)

### Community 22 - "Project Documentation"
Cohesion: 0.13
Nodes (20): CLAUDE.md — Atsumaru repo conventions, join_event atomic RPC — row lock prevents double-booking, pgvector preference_vector — vector(384) MiniLM, PostGIS nearby event discovery — radius search, AI Safety — model must never authorize, unlock connections, or write records, docs/AI.md — AI/ML specification, Feedback-driven preference learning, Groq onboarding chat — conversational interest extraction (+12 more)

### Community 23 - "Server TypeScript Config"
Cohesion: 0.10
Nodes (19): ES2022, src/**/*.test.ts, compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+11 more)

### Community 24 - "Seed Script & Demo Data"
Cohesion: 0.22
Nodes (19): admin(), check(), demoAuthUsers(), DemoEvent, emailFor(), ensureAuthUser(), EVENTS, isDemoEmail() (+11 more)

### Community 25 - "Onboarding Screens"
Cohesion: 0.16
Nodes (14): PERSONALITY_KEYS, PersonalityKey, AIChatScreen(), postTurn(), send(), submitTraits(), Nav, styles (+6 more)

### Community 26 - "Demo World State"
Cohesion: 0.17
Nodes (18): COMPLETED_EVENT_ID, EVENT_SEEDS, EventSeed, FEATURED_EVENT_ID, FeedbackRow, GlobalWithWorld, hours(), iso() (+10 more)

### Community 27 - "Marketing App Preview"
Cohesion: 0.16
Nodes (11): AppPreview(), DiscoverScreen(), screens, BUDDIES, CONFETTI_COLORS, PITCH_POINTS, ScrollShowcase(), CARDS (+3 more)

### Community 28 - "Site Dependencies"
Cohesion: 0.12
Nodes (17): canvas-confetti, clsx, framer-motion, @gsap/react, lenis, lucide-react, next, react-dom (+9 more)

### Community 29 - "Site Dev Tooling"
Cohesion: 0.12
Nodes (17): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/canvas-confetti (+9 more)

### Community 30 - "Site Interactive Elements"
Cohesion: 0.18
Nodes (13): FinalCTA(), Navbar(), AREAS, buildSquad(), Squad, VibeCheckToy(), CITIES, INTERESTS (+5 more)

### Community 31 - "Context & Rationale Docs"
Cohesion: 0.14
Nodes (16): AUTH_STATE_SECRET hardcoded default — login CSRF risk in production, Expo Go bundle host mismatch — endless spinner trap, PGRST202 — PostgREST schema cache must reload after new functions, sanitizeRecap — reject hallucinated @handle from AI output, templateRecap() — deterministic floor when Groq fails, Real Google OAuth + mutual connection session log (2026-08-30), TEE decision → hardware-backed device identity (2026-09-01), Root causes B1-B10 found during verification (+8 more)

### Community 32 - "Mobile Core Dependencies"
Cohesion: 0.13
Nodes (15): dependencies, expo, expo-location, expo-status-bar, react, react-native, react-native-gesture-handler, socket.io-client (+7 more)

### Community 33 - "Site Hero Section"
Cohesion: 0.16
Nodes (10): Hero(), Pill, PILLS, SOCIAL, clamp(), DraggableSticker(), Props, StickerTone (+2 more)

### Community 34 - "Login Screen UI"
Cohesion: 0.19
Nodes (9): GoogleLogo(), LineLogo(), useOAuthLogin(), CORAL_WASH, FLOATER_LAYOUT, LoginScreen(), NIGHT_GROUND, SAGE_WASH (+1 more)

### Community 35 - "Mobile API Client"
Cohesion: 0.17
Nodes (8): SUPABASE_ANON_KEY, SUPABASE_URL, WS_URL, axiosInstance, Envelope, request(), ApiError, getCachedDeviceId()

### Community 36 - "Architecture Concepts"
Cohesion: 0.15
Nodes (13): BullMQ sweep driver with timer fallback, Demo mode — EXPO_PUBLIC_DEMO_MODE=1 replaces API with in-app demo, Socket.io rooms — group:{event_id}, dm:{connection_id}, user:{user_id}, Vector city fallback map — hand-authored SVG when Mapbox unavailable, Deferred require() pattern for Expo Go-safe native modules, Mapbox wired behind fallback session log (2026-08-31), Socket.io event contract (group:*, dm:*, member:*, match:unlocked, typing), Hybrid OAuth — Google via Supabase Auth PKCE, LINE via API exchange (+5 more)

### Community 37 - "Site Layout & Setup"
Cohesion: 0.18
Nodes (8): inter, metadata, notoSansJP, viewport, Footer(), GSAPProvider(), Preloader(), WORDS

### Community 38 - "Site Nav & Ticker"
Cohesion: 0.24
Nodes (7): MarqueeTicker(), Pulse, SoundToggle(), subscribe(), NAV_LINKS, SITE, TICKER_PULSES

### Community 39 - "Site Sticker System"
Cohesion: 0.18
Nodes (9): StickerSheet(), Decal(), DecalShape, Props, SHAPE_CLASS, ART, Props, StickerArtName (+1 more)

### Community 40 - "Mobile Package Config"
Cohesion: 0.18
Nodes (10): main, name, private, scripts, android, ios, start, typecheck (+2 more)

### Community 41 - "Design & Visual Docs"
Cohesion: 0.18
Nodes (11): Meetup categories expanded 4 → 9, Pill grammar — pills for compact metadata only, never CTAs, Sticker/vinyl system — category data encoded in stickers, Warm Japanese Editorial visual overhaul session log (2026-09-01), docs/DESIGN.md — Product & UI design spec, Color-blind safety rule — emoji+colour always pairs with text (§10), Warm Japanese Editorial visual world (§1b), docs/PROJECT_STRUCTURE.md — Repository layout (+3 more)

### Community 42 - "Server Check Config"
Cohesion: 0.18
Nodes (10): scripts/**/*.ts, ./tsconfig.json, compilerOptions, noEmit, rootDir, exclude, extends, include (+2 more)

### Community 43 - "Site Activities Section"
Cohesion: 0.24
Nodes (7): Activities(), ConnectionSection(), members, Stage, stageKeys, Highlight(), ACTIVITIES

### Community 44 - "Site AI Chat Demo"
Cohesion: 0.27
Nodes (7): AIChatDemo(), run(), sleep(), waitForVisible(), CHAT_SCRIPT, ChatMessage, TypingBubble()

### Community 46 - "Site Package Config"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, lint, start, version

### Community 47 - "Product Requirements"
Cohesion: 0.25
Nodes (8): 4-6 person small group design, Mutual-only connection unlock — both must select each other, Core product principles (group before 1:1, activity before romance, consent before connection), Functional requirements FR-01 through FR-14, docs/PRD.md — Product requirements document, Backend-authoritative matching rationale — prevent client gaming, Group before 1:1 rationale — lower pressure, safety, match_score formula (0.6 cosine + 0.2 balance + 0.2 reputation)

### Community 48 - "Mobile Dev Dependencies"
Cohesion: 0.29
Nodes (7): devDependencies, babel-preset-expo, @types/react, typescript, @types/react, typescript, babel-preset-expo

### Community 49 - "Typography System"
Cohesion: 0.29
Nodes (6): monoFont, Role, systemFont, systemFontMedium, type, typography

### Community 50 - "Product Vision Docs"
Cohesion: 0.29
Nodes (7): Group harmony (wa) — Japanese social norm influencing product, Activity-first social discovery — interests before photos, Cultural fit — group harmony, Japanese norms, safety, docs/IDEA.md — Product idea document, Pseudonymous handle identity — no real names, Activity-first rationale — interests before photos, Pseudonymous identity rationale — privacy + safety

### Community 51 - "Server Device Verification"
Cohesion: 0.33
Nodes (4): nonce, { publicKey, privateKey }, spki, verifyDeviceSignature()

### Community 52 - "API & TRD Docs"
Cohesion: 0.47
Nodes (6): docs/API_STRUCTURE.md — API contract, Known contract inconsistency — API_STRUCTURE §5–6 references OTP, TRD §17 says OAuth, docs/README.md — documentation index, Map specification — @rnmapbox/maps, TRD §17 canonical — OAuth only, no phone OTP, docs/TRD.md — Technical requirements document

### Community 53 - "Matching Reasons"
Cohesion: 0.40
Nodes (4): matchReasons(), ReasonInput, TEMPLATES, base

### Community 54 - "Mobile Brand Assets"
Cohesion: 0.40
Nodes (5): Android adaptive icon foreground layer, Android adaptive icon monochrome layer for themed icons, Web/app favicon image, Expo splash screen icon shown during app loading, Atsumaru brand mark - primary logo

### Community 55 - "Mobile TypeScript Config"
Cohesion: 0.40
Nodes (4): compilerOptions, strict, extends, expo/tsconfig.base

### Community 56 - "Friendship-First Concept"
Cohesion: 0.50
Nodes (5): Core product loop — AI onboarding → meetup → group → chat → feedback → connection, Friendship-first social discovery — not a dating app, Friendship-first positioning rationale, README — Atsumaru marketing & technical overview, Feedback learning loop — fire pulls, meh pushes

### Community 57 - "Site Wave & Utils"
Cohesion: 0.60
Nodes (3): WaveField(), WaveFieldProps, cn()

### Community 58 - "SQL Migration Script"
Cohesion: 0.50
Nodes (3): args, cmdIdx, fileIdx

### Community 59 - "Root TypeScript Config"
Cohesion: 0.50
Nodes (3): compilerOptions, extends, expo/tsconfig.base

### Community 60 - "Supabase Keepalive CI"
Cohesion: 0.67
Nodes (3): Supabase project ucxgvtcqoeazuhsgwbhf, Keep Supabase awake GitHub Actions workflow, ping_keepalive() Supabase RPC function

## Knowledge Gaps
- **444 isolated node(s):** `name`, `slug`, `scheme`, `version`, `orientation` (+439 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **56 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MeetupScreen()` connect `Meetup & Feedback UI` to `Navigation & Auth Hooks`, `Socket & Live Chat`, `Shared UI Components`, `UI Primitives & Motion`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `scheme` to the rest of the system?**
  _444 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Map Rendering & Geo` be split into smaller, more focused modules?**
  _Cohesion score 0.07315233785822021 - nodes in this community are weakly interconnected._
- **Should `OAuth & Session` be split into smaller, more focused modules?**
  _Cohesion score 0.08503401360544217 - nodes in this community are weakly interconnected._
- **Should `Background Jobs & Matching` be split into smaller, more focused modules?**
  _Cohesion score 0.08865248226950355 - nodes in this community are weakly interconnected._
- **Should `Shared UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.08350951374207188 - nodes in this community are weakly interconnected._
- **Should `Server Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._