import type { Response } from "express";

import { db } from "../db/queries.js";
import { HttpError } from "./response.js";

export type QuotaResource = "events_created" | "feedback_submitted" | "groq_turns";

/**
 * Per-user daily usage quotas, persisted in Postgres via the `bump_quota` RPC
 * (server/db/migrations/006_usage_quotas.sql). Unlike the in-process rate limiters in
 * rateLimit.ts, a spent quota does not recover within a window — it resets once per
 * calendar day and survives a process restart.
 *
 * bump_quota increments atomically and refuses (without counting) once the cap is met,
 * so a burst of parallel requests cannot all slip under the wire.
 */
export async function enforceQuota(
  userId: string,
  resource: QuotaResource,
  limit: number,
  res: Response
): Promise<void> {
  const allowed = await tryQuota(userId, resource, limit);
  if (!allowed) {
    res.setHeader("Retry-After", "43200");
    throw new HttpError(429, "QUOTA_EXCEEDED", "Daily usage limit reached. Try again tomorrow.");
  }
}

/**
 * Non-throwing variant for spend paths that can degrade instead of erroring (e.g. the
 * recap falls back to its template rather than 429ing a passive card). Returns true when
 * the budget was incremented and the call may proceed.
 */
export async function tryQuota(
  userId: string,
  resource: QuotaResource,
  limit: number
): Promise<boolean> {
  const { data, error } = await db().rpc("bump_quota", {
    p_user: userId,
    p_resource: resource,
    p_limit: limit,
  });

  if (error) {
    // If the RPC is unavailable (DB down, function not reloaded) fail open: the in-process
    // rate limiter is still between the caller and the spend, so the quota is a second
    // layer, not the only one.
    console.error(`bump_quota failed for ${resource}:`, error.message);
    return true;
  }

  return data === true;
}
