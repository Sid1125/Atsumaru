/**
 * Small fixed-window limiter for the endpoints that cost money (the Groq onboarding chat
 * and the vibe recap).
 *
 * The counters live in the shared ephemeral store rather than a Map of its own, so two API
 * instances enforce one budget instead of one each — and so the map cannot grow for the
 * lifetime of the process, which is what it used to do (TRACKER.md §5).
 */

import { ephemeral, type EphemeralStore } from "../services/ephemeral.js";

export interface RateLimit {
  /** Calls allowed per window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Seconds until the caller's window resets; 0 when they are not limited. */
  retryAfterSeconds: number;
}

/**
 * `namespace` keeps one limiter's counters out of another's now that they share a store.
 * `store` is injectable so a test can drive it with a fake clock.
 */
export function createRateLimiter(
  { limit, windowMs }: RateLimit,
  namespace: string,
  store: EphemeralStore = ephemeral
) {
  return {
    async take(key: string, now = Date.now()): Promise<RateLimitVerdict> {
      const { count, resetAt } = await store.bump(
        `ratelimit:${namespace}:${key}`,
        windowMs
      );

      // The count keeps rising after the cap is reached, which costs nothing: only
      // `count <= limit` decides, and the key expires with the window either way.
      if (count <= limit) return { allowed: true, retryAfterSeconds: 0 };

      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    },
  };
}
