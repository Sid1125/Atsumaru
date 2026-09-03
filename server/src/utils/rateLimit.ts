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

/**
 * Walking the map costs O(n), so it is not worth doing on every call. Above this many
 * live keys a prune is cheaper than the memory the expired ones hold.
 */
const PRUNE_THRESHOLD = 512;

export function createRateLimiter({ limit, windowMs }: RateLimit) {
  const counters = new Map<string, Counter>();
  let lastPrunedAt = 0;

  /** Drops expired counters so the map cannot grow without bound. */
  function prune(now = Date.now()) {
    for (const [key, counter] of counters) {
      if (counter.resetAt <= now) counters.delete(key);
    }
  }

  return {
    /** True when the call is allowed; false when the caller is over budget. */
    take(key: string, now = Date.now()): boolean {
      // An expired counter is only replaced when its own key comes back, so a process
      // that sees many distinct callers would otherwise hold every one of them forever.
      // Walking the map is O(n), so it happens at most once per window rather than on
      // every call — otherwise a large map would pay that cost on each request.
      if (counters.size >= PRUNE_THRESHOLD && now - lastPrunedAt >= windowMs) {
        prune(now);
        lastPrunedAt = now;
      }

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

    prune,

    /** Live key count, so a test can prove the map does not grow without bound. */
    size(): number {
      return counters.size;
    },
  };
}
