import { useEffect, useRef } from "react";

import { usersApi } from "../../services/api/users";
import type { Coords } from "../../types/api";

/**
 * Persists the one-shot location fix Discover already took, once per session.
 *
 * Until this existed `users.location` was write-only: `PATCH /users/me` accepted it but no
 * client ever sent it, so the column held nothing but seed data. The "meetup near you"
 * notice reads it (server/src/services/notifications.ts), which is the only reason it now
 * needs to be saved.
 *
 * This does **not** change what is collected. Discover takes exactly one fix, for
 * discovery, and this stores that same fix — no watcher, no background task, nothing
 * repeating (docs/RULES.md). The server stamps `location_updated_at` alongside it so a
 * point that has gone stale can be refused rather than acted on.
 *
 * Best-effort: a failed save costs a nudge, never the screen.
 */
export function usePersistLocation(coords: Coords | null, isRealFix: boolean) {
  const saved = useRef(false);

  useEffect(() => {
    // A fallback coordinate is not where the user is, so saving it would make the nearby
    // notice confidently wrong for everyone who denied permission.
    if (!coords || !isRealFix || saved.current) return;

    saved.current = true;

    void usersApi.updateMe({ location: coords }).catch(() => {
      // Let the next session try again.
      saved.current = false;
    });
  }, [coords, isRealFix]);
}
