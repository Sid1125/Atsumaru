import { Router } from "express";

import { requireAuth } from "../../middleware/auth.js";
import { notImplemented } from "../../utils/response.js";

export const feedbackRouter = Router();

// Ratings and connection picks stay private: only mutual pairs may be revealed,
// and the response must never say who did not pick the caller (docs/RULES.md §8-9).
feedbackRouter.get("/:id/feedback-form", requireAuth, () => {
  throw notImplemented("GET /events/:id/feedback-form");
});

// TODO: store ratings, update reputation + preference vector
// (updatePreferenceVector in modules/matching/score.ts), then unlock mutuals.
feedbackRouter.post("/:id/feedback", requireAuth, () => {
  throw notImplemented("POST /events/:id/feedback");
});
