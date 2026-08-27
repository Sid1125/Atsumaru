import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import {
  CONNECTION_COLUMNS,
  db,
  insertMessage,
  listMessages,
  requireConnection,
  type ConnectionRow,
} from "../../db/queries.js";
import { dbError, HttpError, ok } from "../../utils/response.js";
import { pageParams, param } from "../../utils/request.js";

const bodySchema = z.object({ message: z.string().min(1).max(2000) });

export const connectionsRouter = Router();

// Only mutual unlocks are visible, and only to the two participants.
connectionsRouter.get(
  "/",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const userId = req.userId!;

    const { data, error } = await db()
      .from("connections")
      .select(CONNECTION_COLUMNS)
      .eq("mutual", true)
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order("unlocked_at", { ascending: false });

    if (error) throw dbError(error);

    return ok(res, { connections: (data ?? []) as unknown as ConnectionRow[] });
  })
);

connectionsRouter.get(
  "/:id/messages",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    await requireConnection(param(req, "id"), req.userId!);

    const { page, limit } = pageParams(req.query);

    return ok(res, await listMessages("connection_id", param(req, "id"), page, limit));
  })
);

connectionsRouter.post(
  "/:id/messages",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    await requireConnection(param(req, "id"), req.userId!);

    const parsed = bodySchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", "message must be 1-2000 characters.");
    }

    const message = await insertMessage(
      "connection_id",
      param(req, "id"),
      req.userId!,
      parsed.data.message
    );

    return ok(res, { message }, 201);
  })
);
