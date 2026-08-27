import { Router } from "express";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import { supabase } from "../../db/supabase.js";
import { HttpError, notImplemented, ok } from "../../utils/response.js";

export const authRouter = Router();

// OAuth is handled by Supabase on the client (LINE + Google, no phone OTP).
// These routes exist so the app has a single place to resolve/end its session.
authRouter.get(
  "/me",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const client = supabase();

    if (!client) {
      throw new HttpError(503, "DB_UNAVAILABLE", "Supabase is not configured.");
    }

    const { data, error } = await client
      .from("users")
      .select(
        "id, handle, display_name, avatar_url, language, interests, personality, reputation_score, created_at"
      )
      .eq("id", req.userId!)
      .maybeSingle();

    if (error) {
      throw new HttpError(500, "DB_ERROR", error.message);
    }

    return ok(res, { user: data ?? null });
  })
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncRoute(async (_req, res) => ok(res, { success: true }))
);

authRouter.get("/line", () => {
  throw notImplemented("LINE OAuth redirect");
});

authRouter.get("/google", () => {
  throw notImplemented("Google OAuth redirect");
});

authRouter.get("/callback", () => {
  throw notImplemented("OAuth callback");
});
