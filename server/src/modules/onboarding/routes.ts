import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import { onboardingChat } from "../../services/ai.js";
import { hasGroq } from "../../config/env.js";
import { HttpError, notImplemented, ok } from "../../utils/response.js";

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
  language: z.enum(["ja", "en", "zh"]).optional(),
});

export const onboardingRouter = Router();

onboardingRouter.post(
  "/chat",
  asyncRoute(async (req, res) => {
    const parsed = chatSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", "Invalid chat payload.");
    }

    if (!hasGroq) {
      throw new HttpError(503, "AI_UNAVAILABLE", "GROQ_API_KEY is not configured.");
    }

    const result = await onboardingChat(parsed.data.messages, parsed.data.language);
    return ok(res, result);
  })
);

// TODO: back these with Supabase (handle uniqueness + preference_vector via embed()).
onboardingRouter.get("/suggest-handles", () => {
  throw notImplemented("suggest-handles");
});

onboardingRouter.get("/check-handle", () => {
  throw notImplemented("check-handle");
});

onboardingRouter.post(
  "/complete",
  requireAuth,
  asyncRoute(async (_req: AuthedRequest) => {
    throw notImplemented("onboarding complete");
  })
);
