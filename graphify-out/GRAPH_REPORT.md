# Graph Report - WeLiveAppathon  (2026-08-27)

## Corpus Check
- Corpus is ~31,391 words - fits in a single context window. You may not need a graph.

## Summary
- 294 nodes · 443 edges · 15 communities (11 shown, 4 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.85)
- Token cost: 9,200 input · 2,600 output

## Community Hubs (Navigation)
- Product Scope & Journey
- Mobile Dependencies
- Client Env & Auth
- RN UI Components
- AI & Data Models
- React Query Hooks
- Expo App Config
- Package Metadata
- App Bootstrap & Onboarding
- TS Config
- App Entry
- API Client Layer
- Client Architecture Patterns
- App Icon Asset
- Client State Management

## God Nodes (most connected - your core abstractions)
1. `expo` - 11 edges
2. `colors` - 8 edges
3. `spacing` - 8 edges
4. `typography` - 8 edges
5. `Atsumaru` - 8 edges
6. `Core User Journey` - 8 edges
7. `useAuthStore` - 7 edges
8. `useUiStore` - 7 edges
9. `api` - 6 edges
10. `getAccessToken()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Primary Navigation (Onboarding/Discover/Meetup)` --conceptually_related_to--> `Atsumaru`  [INFERRED]
  docs/DESIGN.md → docs/IDEA.md
- `Handle-Based Privacy Identity Rule` --semantically_similar_to--> `Handle-Based Identity`  [INFERRED] [semantically similar]
  docs/DESIGN.md → docs/IDEA.md
- `Core Idea` --conceptually_related_to--> `Core User Journey`  [INFERRED]
  docs/README.md → docs/PRD.md
- `No Backend Logic Duplication` --semantically_similar_to--> `Single Matching Model Rule`  [INFERRED] [semantically similar]
  docs/PROJECT_STRUCTURE.md → docs/RULES.md
- `API Response Convention` --conceptually_related_to--> `API Surface`  [INFERRED]
  docs/RULES.md → docs/TRD.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Feedback Learning Loop** — docs_idea_post_meetup_feedback, docs_ai_preference_update_rule, docs_idea_preference_vector, docs_idea_reputation_score, docs_ai_match_score_formula [EXTRACTED 0.75]
- **Primary Product Surfaces** — docs_idea_ai_onboarding_chat, docs_idea_map_event_discovery, docs_idea_atsumaru [EXTRACTED 0.75]
- **Appathon end-to-end demo flow** — docs_prd_ai_onboarding, docs_prd_discover, docs_prd_meetup_group, docs_prd_post_meetup_feedback, docs_prd_mutual_connection [EXTRACTED 1.00]
- **Feedback-driven matching intelligence loop** — docs_prd_post_meetup_feedback, docs_prd_smart_group_matching, docs_prd_match_score_formula, docs_trd_preference_update [EXTRACTED 1.00]
- **Non-negotiable trust and privacy guardrails** — docs_project_structure_no_backend_duplication, docs_rules_ai_untrusted, docs_rules_identity_rules, docs_rules_connection_rules [INFERRED 0.75]

## Communities (15 total, 4 thin omitted)

### Community 0 - "Product Scope & Journey"
Cohesion: 0.06
Nodes (47): AI Onboarding, Appathon Success Criteria, Core User Journey, Discover, Match Score Formula, Meetup / Group, Mutual Connection, Explicit Non-Goals (+39 more)

### Community 1 - "Mobile Dependencies"
Cohesion: 0.05
Nodes (39): dependencies, axios, expo, expo-localization, expo-location, expo-notifications, expo-secure-store, expo-status-bar (+31 more)

### Community 2 - "Client Env & Auth"
Cohesion: 0.08
Nodes (27): API_URL, MAPBOX_PUBLIC_TOKEN, SUPABASE_ANON_KEY, SUPABASE_URL, WS_URL, useSession(), authApi, api (+19 more)

### Community 3 - "RN UI Components"
Cohesion: 0.11
Nodes (25): AppStackParamList, AuthStackParamList, OnboardingStackParamList, Button(), ButtonProps, styles, Chip(), ChipProps (+17 more)

### Community 4 - "AI & Data Models"
Cohesion: 0.07
Nodes (31): AI Safety Boundary, Groq Llama 3.3, Match Score Formula, MiniLM Embeddings, Preference Update Rule, Supabase pgvector, Connection (unlocked 1:1) Data Model, Event (Meetup) Data Model (+23 more)

### Community 5 - "React Query Hooks"
Cohesion: 0.11
Nodes (13): connectionsApi, eventsApi, feedbackApi, Connection, Coords, EventStatus, Feedback, GroupMember (+5 more)

### Community 6 - "Expo App Config"
Cohesion: 0.09
Nodes (22): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+14 more)

### Community 7 - "Package Metadata"
Cohesion: 0.13
Nodes (14): devDependencies, @types/react, typescript, main, name, private, scripts, android (+6 more)

### Community 8 - "App Bootstrap & Onboarding"
Cohesion: 0.21
Nodes (8): AppProviders(), queryClient, setLanguage(), SUPPORTED, AIChatScreen(), ProfileConfirmScreen(), useOnboardingDraft, useUiStore

### Community 9 - "TS Config"
Cohesion: 0.40
Nodes (4): compilerOptions, strict, extends, expo/tsconfig.base

### Community 11 - "API Client Layer"
Cohesion: 0.67
Nodes (3): Success/Data API Envelope, Axios API Client Layer, React Query (server state)

## Knowledge Gaps
- **99 isolated node(s):** `styles`, `name`, `slug`, `version`, `orientation` (+94 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `expo-secure-store` connect `Expo App Config` to `Client Env & Auth`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `styles`, `name`, `slug` to the rest of the system?**
  _99 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Product Scope & Journey` be split into smaller, more focused modules?**
  _Cohesion score 0.0641025641025641 - nodes in this community are weakly interconnected._
- **Should `Mobile Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `Client Env & Auth` be split into smaller, more focused modules?**
  _Cohesion score 0.08367071524966262 - nodes in this community are weakly interconnected._
- **Should `RN UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.112375533428165 - nodes in this community are weakly interconnected._
- **Should `AI & Data Models` be split into smaller, more focused modules?**
  _Cohesion score 0.06881720430107527 - nodes in this community are weakly interconnected._