import { Router } from "express";

import { requireAuth } from "../../middleware/auth.js";
import { notImplemented } from "../../utils/response.js";

export const chatRouter = Router();

// REST fallback for group chat; realtime path is socket/index.ts.
// TODO: verify the caller is a member of the event before reading/writing.
chatRouter.get("/:id/messages", requireAuth, () => {
  throw notImplemented("GET /events/:id/messages");
});

chatRouter.post("/:id/messages", requireAuth, () => {
  throw notImplemented("POST /events/:id/messages");
});
