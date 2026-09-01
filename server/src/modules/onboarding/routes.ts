import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import { db, publicUser } from "../../db/queries.js";
import { embed, onboardingChat } from "../../services/ai.js";
import { hasGroq } from "../../config/env.js";
import { dbError, HttpError, ok } from "../../utils/response.js";
import { createRateLimiter } from "../../utils/rateLimit.js";
import { serializeVector } from "../../utils/vector.js";
import { LANGUAGES } from "../../types.js";

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(30),
  language: z.enum(LANGUAGES).optional(),
});

const completeSchema = z.object({
  handle: z.string().regex(HANDLE_RE, "3-20 chars: a-z, 0-9, underscore"),
  display_name: z.string().min(1).max(40),
  language: z.enum(LANGUAGES),
  interests: z.array(z.string().min(1).max(40)).min(1).max(30),
  personality: z.array(z.string().min(1).max(40)).max(8),
});

export const onboardingRouter = Router();

/** Groq is on a free tier; 30 turns an hour is far more than onboarding needs. */
const chatLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 60 * 1000 });

// Onboarding runs after OAuth, so every route here is authenticated: it keeps the
// Groq budget and the handle list from being probed anonymously.
onboardingRouter.post(
  "/chat",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const parsed = chatSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", "Invalid chat payload.");
    }

    if (!hasGroq) {
      throw new HttpError(503, "AI_UNAVAILABLE", "GROQ_API_KEY is not configured.");
    }

    if (!chatLimiter.take(req.userId!)) {
      res.setHeader("Retry-After", chatLimiter.retryAfter(req.userId!));
      throw new HttpError(429, "RATE_LIMITED", "Too many messages. Try again later.");
    }

    const result = await onboardingChat(parsed.data.messages, parsed.data.language);
    return ok(res, result);
  })
);

async function takenHandles(candidates: string[]): Promise<Set<string>> {
  if (candidates.length === 0) return new Set();

  const { data, error } = await db()
    .from("users")
    .select("handle")
    .in("handle", candidates);

  if (error) throw dbError(error);

  return new Set((data ?? []).map((row) => row.handle as string));
}

function handleIdeas(interests: string[]): string[] {
  const words = interests
    .flatMap((interest) => interest.toLowerCase().split(/[^a-z0-9]+/))
    .filter((word) => word.length >= 3);

  const unique = [...new Set(words)];
  const suffixes = ["ish", "club", "days", "mode", "co"];
  const ideas: string[] = [];

  for (const word of unique) {
    ideas.push(word);
    for (const other of unique) {
      if (other !== word) ideas.push(`${word}${other}`);
    }
    for (const suffix of suffixes) ideas.push(`${word}${suffix}`);
  }

  return [...new Set(ideas)].filter((idea) => HANDLE_RE.test(idea)).slice(0, 24);
}

onboardingRouter.get(
  "/suggest-handles",
  requireAuth,
  asyncRoute(async (req, res) => {
    const interests = String(req.query.interests ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (interests.length === 0) {
      throw new HttpError(400, "INVALID_QUERY", "interests is required.");
    }

    const ideas = handleIdeas(interests);
    const taken = await takenHandles(ideas);

    return ok(res, {
      handles: ideas.filter((idea) => !taken.has(idea)).slice(0, 6),
    });
  })
);

onboardingRouter.get(
  "/check-handle",
  requireAuth,
  asyncRoute(async (req, res) => {
    const handle = String(req.query.handle ?? "").toLowerCase();

    if (!HANDLE_RE.test(handle)) {
      return ok(res, { available: false });
    }

    const taken = await takenHandles([handle]);
    return ok(res, { available: !taken.has(handle) });
  })
);

onboardingRouter.post(
  "/complete",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const parsed = completeSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", parsed.error.issues[0]!.message);
    }

    const profile = parsed.data;

    // The preference vector starts from onboarding (docs/AI.md §4). If embedding
    // is unavailable the profile is still saved; matching falls back to no vector.
    let vector: number[] | null = null;

    try {
      vector = await embed([...profile.interests, ...profile.personality].join(", "));
    } catch (error) {
      console.warn("Embedding unavailable, saving profile without vector:", error);
    }

    const { error } = await db()
      .from("users")
      .upsert(
        {
          id: req.userId!,
          handle: profile.handle,
          display_name: profile.display_name,
          language: profile.language,
          interests: profile.interests,
          personality: profile.personality,
          ...(vector ? { preference_vector: serializeVector(vector) } : {}),
        },
        { onConflict: "id" }
      );

    if (error) {
      // 23505 = unique_violation, i.e. the handle was taken between check and save.
      if (error.code === "23505") {
        throw new HttpError(409, "HANDLE_TAKEN", "That handle is already taken.");
      }
      throw dbError(error);
    }

    return ok(res, { user: await publicUser(req.userId!) });
  })
);
