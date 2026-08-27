# Atsumaru — AI / ML Specification

## 1. Purpose

AI exists to make social matching feel natural and personalized.

It has three responsibilities:

1. Understand the user.
2. Help identify compatible groups.
3. Learn from post-meetup feedback.

## 2. Onboarding

Input:

```text
User ↔ conversational AI
```

The AI extracts:

```json
{
  "interests": ["hiking", "coffee", "board games"],
  "personality": ["chill", "explorer"]
}
```

The user confirms the extraction before onboarding is completed.

## 3. Language

Supported:
- Japanese
- English
- Simplified Chinese

The onboarding API can receive the selected language and returns the AI response in the appropriate language. fileciteturn0file0L109-L120

## 4. Embeddings

```text
interests + personality
        ↓
MiniLM
        ↓
embedding vector
        ↓
Supabase pgvector
```

The preference vector starts from onboarding.

## 5. Group Matching

Reference score:

```text
match_score =
  0.6 * cosine(user_preference, candidate_vector)
  + 0.2 * group_balance(size, ratio)
  + 0.2 * normalized_reputation
```

The backend should own the authoritative score.

The frontend displays:
- score
- human-readable reasons

Example:

```text
91% group fit

Why:
• You both like ramen
• 3 members enjoy gaming
• Similar social energy
```

The API contract exposes `/events/:id/match-preview` with `match_score` and `why`. fileciteturn0file0L137-L143

## 6. Feedback Learning

Ratings:

```text
fire → positive preference signal
good → mild positive signal
meh  → negative preference signal
```

Reference update:

```text
new =
  old
  + lr * liked_vector
  - lr * disliked_vector
```

`lr ≈ 0.1`.

The product concept specifies feedback as the main personalization signal rather than continuous GPS tracking. fileciteturn0file1L72-L83

## 7. Reputation

Reputation should reflect participation/reliability signals.

Examples:
- attending meetups
- completing feedback
- repeated positive participation

Avoid making the reputation system feel like a public popularity ranking.

## 8. AI Safety

The model must never be trusted with:
- authorization decisions
- direct database permissions
- private identity disclosure
- connection unlocking
- reputation manipulation

Those are backend-controlled business rules.

## 9. Appathon Demo

The AI story should be visually obvious:

```text
"What do you do on weekends?"
          ↓
"I hike, drink coffee..."
          ↓
AI extracts:
Hiking · Coffee · Chill
          ↓
91% fit meetup
          ↓
Feedback
          ↓
Future matching improves
```

The judge should understand why AI is useful without needing to understand the ML implementation.
