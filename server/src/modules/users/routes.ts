import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import { db, publicUser } from "../../db/queries.js";
import { dbError, HttpError, ok } from "../../utils/response.js";
import { param } from "../../utils/request.js";
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

// Other users' profiles expose the public projection only — never real_name.
usersRouter.get(
  "/:id",
  requireAuth,
  asyncRoute(async (req, res) => ok(res, { user: await publicUser(param(req, "id")) }))
);
