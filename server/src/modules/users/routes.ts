import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import { db, publicUser } from "../../db/queries.js";
import { EXPO_PUSH_TOKEN_RE } from "../../services/push.js";
import { dbError, HttpError, ok } from "../../utils/response.js";
import { uuidParam } from "../../utils/request.js";
import { LANGUAGES } from "../../types.js";

const patchSchema = z.object({
  display_name: z.string().min(1).max(40).optional(),
  avatar_url: z.string().url().nullable().optional(),
  interests: z.array(z.string().min(1).max(40)).max(12).optional(),
  language: z.enum(LANGUAGES).optional(),
  location: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional(),
});

export const usersRouter = Router();

usersRouter.get(
  "/me",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) =>
    ok(res, { user: await publicUser(req.userId!) })
  )
);

usersRouter.patch(
  "/me",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const parsed = patchSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", "Invalid profile payload.");
    }

    const { location, ...rest } = parsed.data;

    const patch: Record<string, unknown> = { ...rest };

    // Location is stored as PostGIS geography; only used for nearby discovery.
    if (location) {
      patch.location = `SRID=4326;POINT(${location.lng} ${location.lat})`;
    }

    const { error } = await db().from("users").update(patch).eq("id", req.userId!);

    if (error) throw dbError(error);

    return ok(res, { user: await publicUser(req.userId!) });
  })
);

const pushTokenSchema = z.object({
  token: z.string().regex(EXPO_PUSH_TOKEN_RE, "Expected an Expo push token."),
  platform: z.enum(["android", "ios"]).optional(),
});

// Not in docs/API_STRUCTURE.md: the contract describes the notification but not where
// the device registers. Needed for the feedback reminder (docs/TRD.md §14).
usersRouter.post(
  "/me/push-token",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const parsed = pushTokenSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", parsed.error.issues[0]!.message);
    }

    const { error } = await db()
      .from("push_tokens")
      .upsert(
        {
          user_id: req.userId!,
          token: parsed.data.token,
          platform: parsed.data.platform ?? null,
        },
        { onConflict: "user_id,token" }
      );

    if (error) throw dbError(error);

    return ok(res, { success: true });
  })
);

// Other users' profiles expose the public projection only — never real_name.
usersRouter.get(
  "/:id",
  requireAuth,
  asyncRoute(async (req, res) => ok(res, { user: await publicUser(uuidParam(req, "id")) }))
);
