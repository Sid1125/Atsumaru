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

## 6a. Vibe Recap

After a meetup completes, each member who submitted feedback gets one short line about
what their **own** ratings imply:

```text
You clicked with people who love hiking, coffee and board games.
```

`GET /events/:id/recap` → `{ recap, traits, source, created_at }`.

Groq's second and only other job. The flow:

```text
the caller's own feedback rows
        ↓
traitsFromRatings()   fire +2, good +1, meh -1, summed per trait
        ↓
liked / cooled traits + count + meetup category   ← anonymous by construction
        ↓
Groq (one sentence)  ──fails/absent──▶  templateRecap()  in en/ja/zh
        ↓
sanitizeRecap()      reject a hallucinated @handle
        ↓
meetup_recaps (cached per event+user)
```

**Per-user, not per-meetup.** The recap is derived from the caller's own ratings, so two
members of one meetup see different text and neither can infer the other's picks
(`docs/RULES.md` §8). `meetup_recaps` is keyed `(event_id, user_id)` for that reason, and
records only the aggregate traits — never who was rated.

**Nothing identifying reaches the model.** `RecapPrompt` in `modules/recap/vibe.ts` holds
traits, a count, and the category; there is no field a handle or user id could travel in.
Output still passes `sanitizeRecap()`, because a model can invent a name it was never
given.

**The template is the floor, not an error path.** No `GROQ_API_KEY`, an unusable answer,
or a rate-limited caller all fall back to `templateRecap()` in the member's language. A
recap is passive — the member did not ask for it and is not waiting — so an error would
render an empty card that looks like a bug. `source` records which path ran.

Gates, in order: membership → meetup completed (409 `MEETUP_NOT_FINISHED`) → the caller
has submitted their own feedback (404 `NO_FEEDBACK_YET`). Generation is capped at 10/hour
per user; cache reads are free.

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
