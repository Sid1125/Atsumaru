# Atsumaru (集まる)

> **Not a dating app — friendship first.**

Atsumaru is a Japan-focused, low-pressure social discovery app that puts people into small groups of 4–6 around shared interests and real-world activities.

## Core Idea

```text
Interest
   ↓
AI understanding
   ↓
Small-group meetup
   ↓
Shared experience
   ↓
Private mutual connection
   ↓
Better future matching
```

## Documentation

| File | Purpose |
|---|---|
| `IDEA.md` | Product concept and original idea |
| `PRD.md` | Product requirements and scope |
| `DESIGN.md` | UI/UX and screen specification |
| `TRD.md` | Technical architecture and implementation requirements |
| `FRONTEND.md` | React Native implementation guide |
| `RULES.md` | Non-negotiable development/product rules |
| `API_STRUCTURE.md` | Backend contract and API specification |

## Primary Screens

1. **AI Onboarding**
2. **Discover / Home**
3. **Meetup / Group**

Post-meetup feedback and mutual connection are states of the Meetup flow rather than separate primary product surfaces.

## Frontend

- React Native
- Expo
- TypeScript
- React Query
- Zustand
- Socket.io Client
- Mapbox
- Expo SecureStore
- Expo Notifications
- i18next

## Backend

- Node.js
- Express
- TypeScript
- Socket.io
- BullMQ
- Upstash Redis
- Supabase Postgres
- PostGIS
- pgvector

## AI

- Groq / Llama 3.3 for conversational onboarding
- MiniLM embeddings
- cosine similarity
- feedback-driven preference updates

## Authentication

MVP uses:
- LINE OAuth — exchanged by the API (Supabase has no LINE provider)
- Google OAuth — brokered by Supabase Auth over PKCE

No phone OTP. The app receives a one-time code, never a provider token, and trades it at
`POST /api/auth/session`. See `TRD.md` §5 for the redirect-URL topology.

## Core Privacy Rules

- public identity uses `@handle` + display name
- real names remain private
- feedback choices are private
- 1:1 chat requires mutual selection
- no continuous GPS tracking

## Appathon Objective

Build a polished end-to-end demo rather than a huge feature set.

The judge should understand Atsumaru after seeing:

**AI onboarding → nearby meetup → group → meetup feedback → mutual connection.**
