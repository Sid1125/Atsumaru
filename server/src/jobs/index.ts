import type { Redis as RedisClient } from "ioredis";

import { env, hasRedis, hasSupabase } from "../config/env.js";
import { runSweep } from "./sweep.js";

/** Five minutes is well inside the one-hour reminder window and cheap to run. */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/** BullMQ rejects ':' in queue names because it builds its Redis keys from them. */
const JOB_NAME = "atsumaru-post-meetup-sweep";

async function sweepOnce() {
  try {
    const result = await runSweep();

    if (
      result.completed ||
      result.remindersSent ||
      result.eventsSettled ||
      result.receiptsChecked
    ) {
      console.log(
        `Sweep: ${result.completed} completed, ${result.remindersSent} reminders, ` +
          `${result.eventsSettled} settled, ${result.receiptsChecked} receipts.`
      );
    }
  } catch (error) {
    // A failed sweep must not take the process down; the next tick retries.
    console.error("Sweep failed:", (error as Error).message);
  }
}

export interface JobRunner {
  stop: () => Promise<void>;
}

/**
 * BullMQ + Upstash is the documented stack (docs/TRD.md §3), but the demo has to run
 * without Redis, so the same sweep also works on a plain interval. One body, two drivers.
 */
export async function startJobs(): Promise<JobRunner | null> {
  if (env.NODE_ENV === "test") return null;

  if (!hasSupabase) {
    console.warn("Jobs not started — Supabase is not configured.");
    return null;
  }

  if (hasRedis) return startQueue();

  console.log("Jobs: in-process sweeper every 5 minutes (set REDIS_URL for BullMQ).");

  // One pass at boot so a restart picks up anything that came due while it was down.
  void sweepOnce();

  return intervalRunner();
}

/** Redis noise is repetitive; one line per 30s is enough to diagnose it. */
function throttledLogger(prefix: string) {
  let lastLoggedAt = 0;

  return (error: Error) => {
    const now = Date.now();

    if (now - lastLoggedAt < 30_000) return;

    lastLoggedAt = now;
    console.error(prefix, error.message);
  };
}

function intervalRunner(): JobRunner {
  const timer = setInterval(sweepOnce, SWEEP_INTERVAL_MS);

  // Keeps `npm test` and one-off scripts from hanging on the timer.
  timer.unref();

  return {
    stop: async () => {
      clearInterval(timer);
    },
  };
}

async function startQueue(): Promise<JobRunner | null> {
  // Declared outside the try so the fallback path can close it instead of leaving a
  // socket reconnecting forever. The type import is erased, so ioredis stays lazy.
  let connection: RedisClient | undefined;

  try {
    // Imported lazily so a deployment without Redis never loads bullmq/ioredis.
    const [{ Queue, Worker }, { Redis }] = await Promise.all([
      import("bullmq"),
      import("ioredis"),
    ]);

    // ioredis parses the URL itself, which is how Upstash's rediss:// TLS endpoint
    // works. BullMQ requires maxRetriesPerRequest to be null on its connections.
    //
    // ponytail: five attempts, then give up and let the interval sweeper take over —
    // the two drivers run the same sweep, so degrading costs nothing but a log line.
    connection = new Redis(env.REDIS_URL!, {
      maxRetriesPerRequest: null,
      retryStrategy: (attempt) =>
        attempt > 5 ? null : Math.min(attempt * 200, 2000),
    });

    // Without an 'error' listener ioredis' event would be unhandled and kill the process.
    const logRedis = throttledLogger("Redis connection error:");

    connection.on("error", logRedis);

    const queue = new Queue(JOB_NAME, { connection });

    queue.on("error", logRedis);

    await queue.upsertJobScheduler(
      "every-5-minutes",
      { every: SWEEP_INTERVAL_MS },
      { name: JOB_NAME }
    );

    const worker = new Worker(JOB_NAME, sweepOnce, { connection });

    worker.on("error", logRedis);
    worker.on("failed", (_job, error) => {
      console.error("Sweep job failed:", error.message);
    });

    console.log("Jobs: BullMQ worker on REDIS_URL, sweeping every 5 minutes.");

    const redis = connection;

    return {
      stop: async () => {
        await worker.close();
        await queue.close();
        redis.disconnect();
      },
    };
  } catch (error) {
    console.error(
      "BullMQ unavailable, falling back to the in-process sweeper:",
      (error as Error).message
    );

    connection?.disconnect();

    return intervalRunner();
  }
}
