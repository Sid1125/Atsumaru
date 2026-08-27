import { Router } from "express";

import { requireAuth } from "../../middleware/auth.js";
import { notImplemented } from "../../utils/response.js";
import { chatRouter } from "../chat/routes.js";
import { feedbackRouter } from "../feedback/routes.js";

export const eventsRouter = Router();

// TODO: PostGIS ST_DWithin query over events for the map pins.
eventsRouter.get("/nearby", requireAuth, () => {
  throw notImplemented("GET /events/nearby");
});

eventsRouter.get("/mine", requireAuth, () => {
  throw notImplemented("GET /events/mine");
});

eventsRouter.post("/", requireAuth, () => {
  throw notImplemented("POST /events");
});

eventsRouter.get("/:id", requireAuth, () => {
  throw notImplemented("GET /events/:id");
});

// TODO: enforce max_size, then score with modules/matching/score.ts.
eventsRouter.post("/:id/join", requireAuth, () => {
  throw notImplemented("POST /events/:id/join");
});

eventsRouter.post("/:id/leave", requireAuth, () => {
  throw notImplemented("POST /events/:id/leave");
});

eventsRouter.get("/:id/members", requireAuth, () => {
  throw notImplemented("GET /events/:id/members");
});

eventsRouter.get("/:id/match-preview", requireAuth, () => {
  throw notImplemented("GET /events/:id/match-preview");
});

// Per-event sub-resources live in their own modules.
eventsRouter.use("/", chatRouter);
eventsRouter.use("/", feedbackRouter);
