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
import { notifyDmMessage } from "../../services/chatNotice.js";
import { dbError, HttpError, ok } from "../../utils/response.js";
import { pageParams, uuidParam } from "../../utils/request.js";
import { createRateLimiter } from "../../utils/rateLimit.js";
import { enforceReadLimit } from "../../utils/readLimit.js";

const bodySchema = z.object({ message: z.string().min(1).max(2000) });

export const connectionsRouter = Router();

const dmSendLimiter = createRateLimiter(
  { limit: 120, windowMs: 60 * 60 * 1000 },
  "dm-send"
);

// Only mutual unlocks are visible, and only to the two participants.
connectionsRouter.get(
  "/",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    await enforceReadLimit(req, res);

    const userId = req.userId!;

    const { data, error } = await db()
      .from("connections")
      .select(CONNECTION_COLUMNS)
      .eq("mutual", true)
      // `.or()` takes a raw PostgREST filter string rather than a bound parameter, which
      // makes this the one interpolated value in the codebase. `requireAuth` asserts the
      // uuid shape of `userId` before any route sees it, so there is nothing here a filter
      // separator could ride in on.
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
    await enforceReadLimit(req, res);
    await requireConnection(uuidParam(req, "id"), req.userId!);

    const { page, limit } = pageParams(req.query);

    return ok(res, await listMessages("connection_id", uuidParam(req, "id"), page, limit));
  })
);

connectionsRouter.post(
  "/:id/messages",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    await requireConnection(uuidParam(req, "id"), req.userId!);

    const budget = await dmSendLimiter.take(req.userId!);

    if (!budget.allowed) {
      res.setHeader("Retry-After", budget.retryAfterSeconds);
      throw new HttpError(429, "RATE_LIMITED", "Too many messages. Try again later.");
    }

    const parsed = bodySchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", "message must be 1-2000 characters.");
    }

    const message = await insertMessage(
      "connection_id",
      uuidParam(req, "id"),
      req.userId!,
      parsed.data.message
    );

    // Matches the socket path, so REST and live sends notify identically.
    void notifyDmMessage(uuidParam(req, "id"), req.userId!, parsed.data.message).catch(
      (error: unknown) => {
        console.error("DM notice failed:", (error as Error).message);
      }
    );

    return ok(res, { message }, 201);
  })
);
