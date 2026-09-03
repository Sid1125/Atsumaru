import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import { enforceReadLimit } from "../../utils/readLimit.js";
import { enforceQuota } from "../../utils/quota.js";
import { db, publicUser } from "../../db/queries.js";
import { embed, onboardingChat } from "../../services/ai.js";
import { hasGroq } from "../../config/env.js";
import { dbError, HttpError, ok } from "../../utils/response.js";
import { createRateLimiter } from "../../utils/rateLimit.js";
import { serializeVector } from "../../utils/vector.js";
import { BloomFilter } from "../../utils/bloom.js";
import { handleVariants } from "./suggest.js";
import { LANGUAGES } from "../../types.js";

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

// A bloom filter over taken handles, loaded lazily from the DB. It is a fast negative
// pre-check, never the source of truth: the `users.handle` unique constraint is. A
// fresh suffixed handle usually misses the filter, so the common keystroke check runs
// with zero DB queries; a filter hit ("maybe") falls through to a DB confirm.
let handleBloom: BloomFilter | null = null;
let handleBloomLoaded = false;

/** Load all live handles into the filter once. Best-effort: on any failure leave it
 *  unloaded (a pure-DB path is still correct) and retry on the next check. */
async function loadHandleBloom(): Promise<BloomFilter | null> {
  if (handleBloomLoaded) return handleBloom;
  try {
    const { data, error } = await db().from("users").select("handle");
    if (error) throw dbError(error);
    const bloom = new BloomFilter();
    for (const row of data ?? []) {
      if (row.handle) bloom.add(row.handle as string);
    }
    handleBloom = bloom;
    handleBloomLoaded = true;
  } catch (error) {
    console.warn("Handle bloom filter unavailable, falling back to DB-only checks:", error);
  }
  return handleBloom;
}

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

    // Persisted daily Groq budget on top of the hourly limiter — this is the paid
    // integration, so it also gets a cross-restart cap (docs/ATSUMARU_SECURITY_COMPLETE §19).
    await enforceQuota(req.userId!, "groq_turns", 500, res);

    const result = await onboardingChat(parsed.data.messages, parsed.data.language);
    return ok(res, result);
  })
);

async function takenHandles(candidates: string[]): Promise<Set<string>> {
  if (candidates.length === 0) return new Set();

  // Bloom fast-negative: a candidate that is definitely free skips the DB entirely.
  // Only "maybe" candidates (a bloom miss is impossible here; a hit means maybe) are
  // confirmed against the table, so the DB query shrinks to the likely-taken few.
  const bloom = await loadHandleBloom();
  const maybe = bloom ? candidates.filter((c) => bloom.maybePresent(c)) : candidates;
  if (maybe.length === 0) return new Set();

  const { data, error } = await db()
    .from("users")
    .select("handle")
    .in("handle", maybe);

  if (error) throw dbError(error);

  return new Set((data ?? []).map((row) => row.handle as string));
}

/** Alphanumeric variants of what the user typed, minus ones already taken or invalid. */
async function availableSuggestions(rawBase: string): Promise<string[]> {
  const variants = handleVariants(rawBase);
  if (variants.length === 0) return [];
  const taken = await takenHandles(variants);
  return variants.filter((variant) => !taken.has(variant));
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
    enforceReadLimit(req, res);
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
    enforceReadLimit(req, res);
    const raw = String(req.query.handle ?? "");
    const handle = raw.toLowerCase();

    // Valid only if the exact typed text is a well-formed handle; while the user is
    // mid-word (e.g. "drivi") the field is not yet usable, but suggestions still flow.
    const available =
      HANDLE_RE.test(handle) && !(await takenHandles([handle])).has(handle);

    // Alphanumeric variants of what the user typed, e.g. "drivinggames_x4k92",
    // surface live so a taken or invalid handle has a one-tap fix.
    const suggestions = await availableSuggestions(raw);

    return ok(res, { available, suggestions });
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

    // Reflect the new handle in the filter so a later duplicate check is caught fast.
    handleBloom?.add(profile.handle);

    return ok(res, { user: await publicUser(req.userId!) });
  })
);
