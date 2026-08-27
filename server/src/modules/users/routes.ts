import { Router } from "express";

import { requireAuth } from "../../middleware/auth.js";
import { notImplemented } from "../../utils/response.js";

export const usersRouter = Router();

// TODO: read/write the public profile projection (never expose real_name).
usersRouter.get("/me", requireAuth, () => {
  throw notImplemented("GET /users/me");
});

usersRouter.patch("/me", requireAuth, () => {
  throw notImplemented("PATCH /users/me");
});

usersRouter.get("/:id", requireAuth, () => {
  throw notImplemented("GET /users/:id");
});
