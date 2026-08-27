/**
 * Small fixed-window limiter for the endpoints that cost money (the Groq onboarding
 * chat). Per-process and in memory, which is enough for one API instance.
 */

export interface RateLimit {
  /** Calls allowed per window. */
  limit: number;
  windowMs: number;
}

interface Counter {
  count: number;
  resetAt: number;
}

export function createRateLimiter({ limit, windowMs }: RateLimit) {
  const counters = new Map<string, Counter>();

  return {
    /** True when the call is allowed; false when the caller is over budget. */
    take(key: string, now = Date.now()): boolean {
      const current = counters.get(key);

      if (!current || current.resetAt <= now) {
        counters.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }

      if (current.count >= limit) return false;

      current.count += 1;
      return true;
    },

    /** Seconds until the caller's window resets; 0 when they are not limited. */
    retryAfter(key: string, now = Date.now()): number {
      const current = counters.get(key);

      if (!current || current.resetAt <= now) return 0;

      return Math.ceil((current.resetAt - now) / 1000);
    },

    /** Drops expired counters so the map cannot grow without bound. */
    prune(now = Date.now()) {
      for (const [key, counter] of counters) {
        if (counter.resetAt <= now) counters.delete(key);
      }
    },
  };
}
