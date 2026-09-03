import { createServer } from "node:http";

import cors from "cors";
import express from "express";

import { env, hasGoogle, hasGroq, hasLine, hasSupabase } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/routes.js";
import { onboardingRouter } from "./modules/onboarding/routes.js";
import { usersRouter } from "./modules/users/routes.js";
import { eventsRouter } from "./modules/events/routes.js";
import { connectionsRouter } from "./modules/connections/routes.js";
import { startJobs } from "./jobs/index.js";
import { attachSocket } from "./socket/index.js";
import { ok, HttpError } from "./utils/response.js";

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
// 8 MB so a base64 profile photo fits in one request (a compressed phone photo
// is ~1-2 MB in base64). Everything else stays far under this.
app.use(express.json({ limit: "8mb" }));

// Liveness only. Integration/oauth config state is deliberately withheld: it is not
// needed by any health probe and disclosing which providers are enabled is information
// an unauthenticated caller should not have (docs/ATSUMARU_SECURITY_COMPLETE §20).
app.get("/health", (_req, res) => ok(res, { status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/users", usersRouter);
app.use("/api/events", eventsRouter);
app.use("/api/connections", connectionsRouter);

// Unknown routes answer in the API's envelope instead of Express' HTML page.
app.use((_req, _res, next) =>
  next(new HttpError(404, "NOT_FOUND", "That endpoint does not exist."))
);

app.use(errorHandler);

const httpServer = createServer(app);
attachSocket(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`Atsumaru API on http://localhost:${env.PORT}/api`);
  if (!hasSupabase) console.warn("Supabase not configured — data routes will 503.");
  if (!hasGroq) console.warn("Groq not configured — onboarding chat will 503.");
  if (!hasLine && !hasGoogle) console.warn("No OAuth provider configured — login will 503.");

  // Post-meetup work runs on a timer (docs/TRD.md §14).
  void startJobs();
});
