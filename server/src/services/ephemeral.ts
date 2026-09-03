/**
 * Short-lived keyed values that a second API instance has to be able to see: OAuth handoff
 * codes, PKCE verifiers, and rate-limit counters. All three used to live in module-level
 * Maps, which is why the API could only ever run one instance (TRACKER.md §5).
 *
 * In memory by default, because one instance needs nothing else and the demo must run with
 * no Redis at all. Backed by Redis when `REDIS_URL` is set, which is what makes horizontal
 * scaling possible — the same one-body-two-drivers shape as the sweep in jobs/index.ts.
 */

import type { Redis as RedisClient } from "ioredis";

import { env, hasRedis } from "../config/env.js";

export interface EphemeralStore {
  /** Stores a value that expires on its own. */
  put(key: string, value: string, ttlMs: number): Promise<void>;
  /** Reads and removes in one step, so a replay cannot claim the same value twice. */
  take(key: string): Promise<string | null>;
  /** Fixed-window counter. Returns the count *after* this call and when the window ends. */
  bump(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  /** Live key count. Only the in-memory store has one; used by its tests. */
  size?: () => number;
}

interface Entry {
  value: string;
  expiresAt: number;
}

/**
 * Pruning is lazy and bounded the same way the rate limiter's is: walking the map is O(n),
 * so it happens when the map is worth walking rather than on every call.
 */
const PRUNE_THRESHOLD = 512;

/** `clock` is injectable so a test can step time instead of sleeping through a window. */
export function memoryStore(clock: () => number = Date.now): EphemeralStore {
  const entries = new Map<string, Entry>();
  let lastPrunedAt = 0;

  function prune(now: number) {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(key);
    }
  }

  function maybePrune(now: number, windowMs: number) {
    if (entries.size < PRUNE_THRESHOLD || now - lastPrunedAt < windowMs) return;

    prune(now);
    lastPrunedAt = now;
  }

  return {
    async put(key, value, ttlMs) {
      const now = clock();

      maybePrune(now, ttlMs);
      entries.set(key, { value, expiresAt: now + ttlMs });
    },

    async take(key) {
      const now = clock();
      const entry = entries.get(key);

      if (!entry) return null;

      entries.delete(key);

      return entry.expiresAt >= now ? entry.value : null;
    },

    async bump(key, windowMs) {
      const now = clock();

      maybePrune(now, windowMs);

      const entry = entries.get(key);

      if (!entry || entry.expiresAt <= now) {
        const resetAt = now + windowMs;

        entries.set(key, { value: "1", expiresAt: resetAt });

        return { count: 1, resetAt };
      }

      const count = Number(entry.value) + 1;

      entry.value = String(count);

      return { count, resetAt: entry.expiresAt };
    },

    /** Live key count, so a test can prove the map does not grow without bound. */
    size: () => entries.size,
  };
}

/**
 * Every operation degrades to `fallback` rather than throwing. A dead Redis then costs
 * per-instance limiting and one re-login, instead of 500ing a request — the same posture
 * as the BullMQ driver falling back to the interval sweeper.
 */
function redisStore(redis: RedisClient, fallback: EphemeralStore): EphemeralStore {
  const warn = (operation: string, error: Error) => {
    console.error(`Redis ${operation} failed, using in-process memory:`, error.message);
  };

  return {
    async put(key, value, ttlMs) {
      try {
        await redis.set(key, value, "PX", ttlMs);
      } catch (error) {
        warn("put", error as Error);
        await fallback.put(key, value, ttlMs);
      }
    },

    async take(key) {
      try {
        // GETDEL wants Redis 6.2; MULTI does the same job on any version.
        const results = await redis.multi().get(key).del(key).exec();
        const value = results?.[0]?.[1];

        return typeof value === "string" ? value : null;
      } catch (error) {
        warn("take", error as Error);

        return fallback.take(key);
      }
    },

    async bump(key, windowMs) {
      try {
        const results = await redis.multi().incr(key).pttl(key).exec();
        const count = Number(results?.[0]?.[1] ?? 1);
        let ttl = Number(results?.[1]?.[1] ?? -1);

        // A fresh key has no expiry yet, and PEXPIRE NX would need Redis 7. Setting it
        // only on the first increment keeps the window fixed rather than sliding.
        if (ttl < 0) {
          await redis.pexpire(key, windowMs);
          ttl = windowMs;
        }

        return { count, resetAt: Date.now() + ttl };
      } catch (error) {
        warn("bump", error as Error);

        return fallback.bump(key, windowMs);
      }
    },
  };
}

const fallbackStore = memoryStore();

let active: EphemeralStore = fallbackStore;
let connection: RedisClient | null = null;

/**
 * Called once at boot. Failing to reach Redis is not fatal: the in-memory store stays, the
 * API keeps working, and the only thing lost is the ability to run a second instance.
 */
export async function initEphemeral(): Promise<void> {
  if (!hasRedis) return;

  try {
    const { Redis } = await import("ioredis");

    connection = new Redis(env.REDIS_URL!, {
      // Same retry ceiling as the BullMQ connection: give up rather than reconnect forever.
      maxRetriesPerRequest: 3,
      retryStrategy: (attempt) => (attempt > 5 ? null : Math.min(attempt * 200, 2000)),
    });

    // Without an 'error' listener ioredis' event is unhandled and takes the process down.
    connection.on("error", (error: Error) => {
      console.error("Redis (ephemeral store) error:", error.message);
    });

    active = redisStore(connection, fallbackStore);

    console.log("Ephemeral store: Redis (handoff codes, PKCE verifiers, rate limits).");
  } catch (error) {
    console.error(
      "Redis unavailable, keeping the in-process ephemeral store:",
      (error as Error).message
    );

    connection?.disconnect();
    connection = null;
  }
}

/** For tests and shutdown; the in-memory store needs no teardown. */
export async function closeEphemeral(): Promise<void> {
  connection?.disconnect();
  connection = null;
  active = fallbackStore;
}

export const ephemeral: EphemeralStore = {
  put: (key, value, ttlMs) => active.put(key, value, ttlMs),
  take: (key) => active.take(key),
  bump: (key, windowMs) => active.bump(key, windowMs),
};
