import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import { insertMessage, listMessages, requireMembership } from "../../db/queries.js";
import { HttpError, ok } from "../../utils/response.js";
import { pageParams, uuidParam } from "../../utils/request.js";

const bodySchema = z.object({ message: z.string().min(1).max(2000) });

export const chatRouter = Router();

// REST fallback for group chat; realtime path is socket/index.ts.
chatRouter.get(
  "/:id/messages",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    await requireMembership(uuidParam(req, "id"), req.userId!);

    const { page, limit } = pageParams(req.query);

    return ok(res, await listMessages("event_id", uuidParam(req, "id"), page, limit));
  })
);

chatRouter.post(
  "/:id/messages",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    await requireMembership(uuidParam(req, "id"), req.userId!);

    const parsed = bodySchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", "message must be 1-2000 characters.");
    }

    const message = await insertMessage(
      "event_id",
      uuidParam(req, "id"),
      req.userId!,
      parsed.data.message
    );

    return ok(res, { message }, 201);
  })
);
