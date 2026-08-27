# Atsumaru — Project Structure

## Recommended Repository

```text
atsumaru/
├── apps/
│   └── mobile/
│       ├── app.json
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── app/
│           ├── screens/
│           ├── components/
│           ├── features/
│           ├── services/
│           ├── store/
│           ├── hooks/
│           ├── i18n/
│           ├── types/
│           └── utils/
│
├── server/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── onboarding/
│   │   │   ├── users/
│   │   │   ├── events/
│   │   │   ├── chat/
│   │   │   ├── feedback/
│   │   │   └── connections/
│   │   ├── middleware/
│   │   ├── socket/
│   │   ├── jobs/
│   │   └── utils/
│   └── package.json
│
├── docs/
│   ├── IDEA.md
│   ├── PRD.md
│   ├── DESIGN.md
│   ├── TRD.md
│   ├── FRONTEND.md
│   ├── RULES.md
│   └── AI.md
│
└── README.md
```

## Feature Ownership

### Mobile
Owns:
- presentation
- navigation
- local state
- API consumption
- realtime UI
- localization
- device permissions

### Server
Owns:
- authentication validation
- authorization
- matching
- reputation
- feedback processing
- connection unlocking
- AI orchestration
- persistence

## Rule

Do not duplicate backend business logic in the mobile app.

The mobile app may provide optimistic UI, but the server is authoritative for:
- membership
- match score
- reputation
- feedback
- connection state
- permissions



## Codex Review

All work produced, will be thoroughly reviewed by **Codex**.

Codex will review the implementation for correctness, code quality, architecture, security, UI/UX consistency, adherence to the project documentation, and potential bugs or regressions.

Any issues identified during the review will be addressed before the implementation is considered finalized.

