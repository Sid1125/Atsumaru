// Public runtime config. EXPO_PUBLIC_* vars are inlined by Expo at build time.
// Secrets must never be placed here — they are public in the app bundle.

import { Platform } from "react-native";

/**
 * An Android emulator resolves `localhost` to the emulator itself, not the host
 * machine — the host is reachable at 10.0.2.2. Getting this wrong makes every REST
 * call and the Socket.io handshake fail on-device with a generic network error, so
 * the default is platform-aware and only overridden when the env var is set.
 *
 * A physical device needs the machine's LAN IP in EXPO_PUBLIC_API_URL instead.
 */
const devHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";

/** Treats an unset *or blank* env var as "not configured" — `.env` ships blank keys. */
function fromEnv(value: string | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

export const API_URL = fromEnv(
  process.env.EXPO_PUBLIC_API_URL,
  `http://${devHost}:4000/api`
);

export const WS_URL = fromEnv(
  process.env.EXPO_PUBLIC_WS_URL,
  `http://${devHost}:4000`
);

/**
 * Runs the app against the in-app demo layer instead of the API, so the meetup loop
 * is demonstrable with no server, database, or credentials. See `services/api/demo/`.
 * Off unless explicitly enabled — production builds must never ship it on.
 */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === "1";

export const MAPBOX_PUBLIC_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
