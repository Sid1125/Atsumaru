/**
 * The one place `@rnmapbox/maps` is loaded, and the one place that decides whether
 * the real map can run at all.
 *
 * Two things gate it, and both are hard requirements:
 *
 *   1. **A public token.** Mapbox will not serve tiles without one, and a
 *      tokenless MapView renders as an empty grey rectangle rather than failing
 *      loudly — the worst possible outcome for the app's primary surface.
 *   2. **A build that links the native module.** `@rnmapbox/maps` throws from
 *      *module scope* when `NativeModules.RNMBXModule` is null (see the package's
 *      `RNMBXModule.ts`), which is exactly the case in Expo Go. That throw is
 *      synchronous, so a `try/catch` around `require()` does contain it — unlike
 *      `expo-notifications`, which reports its Expo Go failure through the global
 *      error handler and has to be gated on the environment instead. What is *not*
 *      safe is a top-level `import`: it runs before any of our code and takes the
 *      whole bundle down with it. Hence the deferred require below, and hence no
 *      other module in `src/` may import `@rnmapbox/maps` directly.
 *
 * Failing either, Discover renders the hand-authored vector city
 * (`InteractiveMap`), which is a complete map rather than a placeholder — so the
 * absence of a token is a change of renderer, never a broken screen.
 */

import { MAPBOX_PUBLIC_TOKEN } from "../../config/env";

type MapboxModule = typeof import("@rnmapbox/maps");

/** `undefined` = not tried yet, `null` = tried and unavailable. */
let cached: MapboxModule | null | undefined;

/**
 * Loads the module once, or returns null where it cannot work. Never throws:
 * every caller treats null as "use the vector map".
 */
export function loadMapbox(): MapboxModule | null {
  if (cached !== undefined) return cached;

  if (MAPBOX_PUBLIC_TOKEN.length === 0) {
    cached = null;
    return cached;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mapbox = require("@rnmapbox/maps") as MapboxModule;

    mapbox.setAccessToken(MAPBOX_PUBLIC_TOKEN);
    // Telemetry is opt-out, and this app has no reason to send any.
    mapbox.setTelemetryEnabled(false);

    cached = mapbox;
  } catch {
    // No native module in this build — Expo Go, or a token without a dev build.
    cached = null;
  }

  return cached;
}

/** Whether the Mapbox surface is usable in this build, with this configuration. */
export function hasMapbox(): boolean {
  return loadMapbox() !== null;
}
