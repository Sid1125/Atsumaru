import { Router } from "express";

import { requireAuth } from "../../middleware/auth.js";
import { notImplemented } from "../../utils/response.js";

export const connectionsRouter = Router();

// TODO: only return connections where mutual = true and the caller is a participant.
connectionsRouter.get("/", requireAuth, () => {
  throw notImplemented("GET /connections");
});

connectionsRouter.get("/:id/messages", requireAuth, () => {
  throw notImplemented("GET /connections/:id/messages");
});

connectionsRouter.post("/:id/messages", requireAuth, () => {
  throw notImplemented("POST /connections/:id/messages");
});
