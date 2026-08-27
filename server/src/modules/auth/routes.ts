import { Router } from "express";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import { db, PUBLIC_USER_COLUMNS, type PublicUser } from "../../db/queries.js";
import { dbError, HttpError, notImplemented, ok } from "../../utils/response.js";

export const authRouter = Router();

// OAuth is handled by Supabase on the client (LINE + Google, no phone OTP).
// These routes exist so the app has a single place to resolve/end its session.
authRouter.get(
  "/me",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    // Unlike /users/me this may legitimately be empty: the row appears only once
    // onboarding completes, and the client uses `user: null` to route there.
    const { data, error } = await db()
      .from("users")
      .select(PUBLIC_USER_COLUMNS)
      .eq("id", req.userId!)
      .maybeSingle<PublicUser>();

    if (error) throw dbError(error);

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
