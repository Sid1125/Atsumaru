// Public runtime config. EXPO_PUBLIC_* vars are inlined by Expo at build time.
// Secrets must never be placed here — they are public in the app bundle.

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api";

export const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? "http://localhost:4000";

export const MAPBOX_PUBLIC_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
