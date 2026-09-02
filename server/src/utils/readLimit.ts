import type { Request, Response } from "express";

import { createRateLimiter } from "./rateLimit.js";
import { HttpError } from "./response.js";

/**
 * One per-user budget shared across every read surface (each is authenticated). A single
 * user can otherwise page through the whole roster/event table in seconds, which is the
 * scraping vector calling out every event id. The budget is generous enough that a real
 * session never trips it.
 *
 * "Request throttling" in practice: reads are the high-frequency path, so they get a
 * fixed per-user per-window allowance rather than a per-endpoint stack of counters.
 */
const readLimiter = createRateLimiter({
  limit: Number(process.env.READ_RATE_LIMIT ?? 240),
  windowMs: 60 * 1000,
});

/** Throws 429 when the (authenticated) caller is over the shared read budget. */
export function enforceReadLimit(req: Request, res: Response): void {
  const userId = (req as Request & { userId?: string }).userId;
  const key = userId ?? (req.socket.remoteAddress ?? "unknown");

  if (!readLimiter.take(key)) {
    res.setHeader("Retry-After", readLimiter.retryAfter(key));
    throw new HttpError(429, "RATE_LIMITED", "Too many requests. Try again shortly.");
  }
}
