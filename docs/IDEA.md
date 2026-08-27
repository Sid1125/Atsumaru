# Atsumaru (集まる) — Product Idea Document

> **集まる** means *"to gather / to come together"* in Japanese.

**One-liner:** *Not a dating app — friendship first. Meet in small groups over shared interests, check the vibe, and let romance happen naturally. No hookup pressure, no marriage pressure.*

---

## 1. The Problem

Dating apps in Japan fail young people (20s) at both extremes:

| App | Weakness |
|-----|----------|
| **Tinder** | Swipe/photo-first, hookup vibe — culturally uncomfortable in Japan. Blunt, appearance-driven. |
| **Pairs / Omiai** | Marriage-pressure heavy, rigid, slow-progression expected, Japanese-only. Overwhelming for people who just want to *date* or *socialize*, not get engaged. |

**The gap nobody fills:** A **low-stakes, group-based, activity-first** space — neither hookup pressure nor marriage pressure. *"Let's just hang out with people who like the same stuff."* Romance can develop organically, but it is never forced.

---

## 2. The Solution — Core Concept

Atsumaru matches people into **small groups (4–6 people)** based on **shared interests** (board games, hiking, ramen tasting, anime cafés, coffee) and brings them together at a **real venue**.

- **No swipe, no photo-first profiles.** AI understands you through a short chat instead of a boring form.
- **Group setting, not 1:1.** Less awkward, more natural, and safer — solo-date safety is a real concern in Japan, especially for women.
- **Organic progression.** After an event, if two people click, the app privately unlocks a 1:1 chat. The app never forces romance.

---

## 3. How It Works (User Journey)

1. **Onboarding** — User chats with an AI ("What do you do on weekends?"). AI extracts interests + personality. No forms.
2. **Discover** — User browses upcoming interest-based meetups on a **map** (nearby events).
3. **Join** — User joins a group. Matching algorithm balances the group by interest overlap, size, and reputation.
4. **Group chat** — Members coordinate before the meetup (real-time chat).
5. **Meet** — The group meets at the real venue.
6. **Feedback** — After the meetup, a quick tap: *"How was it? Who did you vibe with?"*
7. **Connect** — If two people mutually liked each other, a **1:1 chat unlocks**. Feedback also improves future matches.

---

## 4. Key Features (MVP)

- **AI onboarding chat** — conversational interest & personality extraction (no forms).
- **Handle-based identity** — no real names shown. Users pick a unique `@handle` + display name; AI suggests cool handles from their interests. Real name is optional & never public (privacy + meetup safety).
- **Multi-language** — Japanese, English, and Chinese (Simplified). Onboarding AI auto-detects and speaks the user's language.
- **Map-based event discovery** — see nearby meetups as pins.
- **Smart group matching** — interest similarity + group balance + reputation.
- **Group chat** — real-time coordination before the meetup.
- **Post-meetup feedback** — quick tap rating (😐 / 🙂 / 🔥) per person + "rejoin this group?".
- **Feedback-driven matching** — the more you use it, the better your matches get.
- **1:1 unlock** — mutual like after an event unlocks private chat.
- **Reputation score** — active, genuine users get better groups; ghosts/flakes get filtered.

---

## 5. AI / ML Role

AI is the app's **smart matchmaker**. It does three jobs:

1. **Understand you (Onboarding)** — Instead of a form, AI *talks* to you and figures out your interests and personality (shy/outgoing, chill/energetic). → *Groq (Llama 3.3)*
2. **Find the right people (Matching)** — Converts interests into vectors and groups people with matching vibes so meetups aren't awkward. → *MiniLM embeddings + cosine similarity*
3. **Keep it trustworthy (Reputation)** — Tracks feedback activity so genuine users get good groups and flaky users get filtered.

**Without AI:** boring form + random grouping = no vibe.
**With AI:** natural chat + smart groups = real connection.

---

## 6. Feedback-Driven Matching (the "learning" loop)

No GPS tracking (privacy-friendly + simpler). **Feedback is the only signal.**

- Whoever gives feedback = attended & genuine → reputation ↑
- Ghosts who never give feedback → reputation ↓
- Each user has a **preference vector** (starts from onboarding). Feedback nudges it:
  - 🔥 "great vibe" → pull preference toward that person's interest profile
  - 😐 "meh" → push away
- Next match score = `cosine(user_preference, candidate_vector) × candidate_reputation`

> The more you use Atsumaru, the smarter it gets about the kind of people you connect with.

---

## 7. Cultural Fit

- **Group-first + activity-first** aligns naturally with Japanese social norms (group harmony *wa*, indirect approach).
- **Handle-based, no real names** — matches Japanese online privacy norms (ニックネーム culture) and adds meetup safety.
- **Multi-language (JP / EN / Chinese)** — unlike Japanese-only Pairs/Omiai, Atsumaru also includes **foreign workers/residents** in Japan who feel isolated. A real secondary wedge and inclusion story.
- Not Tinder's bluntness, not Pairs' marriage pressure.
- **Safety-forward** — group setting reduces solo-date risk, a real concern for women in Japan.

---

## 8. Differentiation

| | Tinder | Pairs/Omiai | **Atsumaru** |
|---|---|---|---|
| Format | 1:1 swipe | 1:1 marriage-focused | **Group, activity-first** |
| Pressure | Hookup | Marriage | **None — just hang out** |
| Onboarding | Photos | Long forms | **AI chat** |
| Safety | Low (solo) | Medium | **High (group)** |
| Progression | Instant DM | Slow, forced | **Organic (earn 1:1)** |

---

## 9. MVP Scope (48-hour hackathon)

1. AI onboarding chat (interest/personality extraction — Groq)
2. Map-based event discovery (Mapbox)
3. Group matching algorithm (similarity + balance scoring)
4. Join flow + real-time group chat (Socket.io)
5. Post-meetup feedback (quick tap)
6. Reputation + feedback-driven match improvement
7. Mutual-like → 1:1 chat unlock

---

## 10. Add-Ons / Future Roadmap (Phase 2+)

Nice-to-haves beyond the MVP — great for the pitch as "where this goes next":

- **AI icebreakers** — auto-generated conversation starters for each group based on shared interests.
- **AI feedback chat** — richer post-meetup feedback via conversation (Groq) instead of just taps.
- **Safety layer** — women-only group option, verified profiles, in-app emergency check-in, block/report.
- **LINE integration** — reminders & notifications via LINE (Japan-native touch).
- **Gamification** — attendance streaks, badges, "reliable member" status (reputation made visible & fun).
- **Vibe recap** — AI summary after each meetup ("You clicked with people who love the outdoors").
- **Recurring interest circles** — groups that liked each other can auto-schedule the next meetup.
- **Venue partnerships** — cafés/spaces host events, offer discounts (business model seed).
- **JP/EN language toggle** — expand beyond Japanese-only (unlike Pairs/Omiai).
- **Premium tier** — priority matching, more events/week, advanced filters (monetization).

---

## 11. Tech Stack (100% free-tier, 48hr-buildable)

- **Frontend:** React Native (Expo), Android-first · Mapbox (`@rnmapbox/maps`) · Zustand · React Query · Expo Push Notifications · `i18next` (JP/EN/Chinese)
- **Auth:** Supabase OAuth — **LINE** (Custom OIDC) + **Google** (native). No phone OTP (paid SMS avoided).
- **Backend:** Node.js + Express + TypeScript · Socket.io · BullMQ + Upstash Redis
- **DB + Auth:** Supabase (Postgres + PostGIS + pgvector + OTP auth)
- **AI/ML:** Groq (Llama 3.3) · HuggingFace MiniLM embeddings · cosine similarity + feedback loop
- **Hosting:** Expo (EAS) · Render/Railway · Supabase · Upstash — all free tier

> See `API_STRUCTURE.md` for the backend contract, data models, and flow diagrams.
