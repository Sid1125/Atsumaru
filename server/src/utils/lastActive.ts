/**
 * "When did this member last use the app?"
 *
 * There was no answer to that before this file: `users` carried only `created_at`, and the
 * one activity-shaped timestamp in the schema — `device_keys.last_seen_at` — is written when
 * a device registers its key, not when someone opens the app. The re-engagement nudge needs
 * the difference between a quiet member and a departed one.
 *
 * Written from the auth middleware, so it covers every authenticated request without any
 * screen having to remember to ping. Throttled, because the point is a coarse "still
 * around" signal and a write per request would be a write per request.
 */

import { db } from "../db/queries.js";
import { ephemeral } from "../services/ephemeral.js";

/**
 * Resolution of the stored value. Inactivity is measured in days, so a quarter-hour of
 * slack costs nothing and turns a per-request write into at most four an hour per member.
 */
const TOUCH_WINDOW_MS = 15 * 60 * 1000;

/**
 * Records that `userId` is active, at most once per window.
 *
 * The window lives in the shared ephemeral store, so two API instances throttle against one
 * window rather than one each — the convention for anything short-lived and keyed.
 *
 * Never throws and never awaited by the request path: a failed write means the member looks
 * slightly staler than they are, which costs at worst one unwanted nudge. Making a request
 * fail over an activity timestamp would be a far worse trade.
 */
export function touchLastActive(userId: string): void {
  void (async () => {
    try {
      const { count } = await ephemeral.bump(
        `last-active:${userId}`,
        TOUCH_WINDOW_MS
      );

      // Only the first caller in the window writes; the rest of the window is free.
      if (count !== 1) return;

      const { error } = await db()
        .from("users")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", userId);

      if (error) console.warn("Could not record activity:", error.message);
    } catch (error) {
      console.warn("Could not record activity:", (error as Error).message);
    }
  })();
}
