import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env, hasSupabase } from "../config/env.js";

let client: SupabaseClient | null = null;

/**
 * Service-role client: bypasses RLS, so it must never be exposed to the app.
 * Returns null until Supabase credentials are configured.
 *
 * Never call `auth.signIn*` / `auth.verifyOtp` on this client. supabase-js resolves
 * PostgREST's Authorization header through `auth.getSession()` and only falls back to
 * the supabase key when no session is held, so minting a session here would make every
 * later query run as that user — straight into the deny-all RLS in schema.sql. Use
 * `authClient()` for anything that establishes a session.
 */
export function supabase(): SupabaseClient | null {
  if (!hasSupabase) return null;

  client ??= createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  return client;
}

/**
 * A throwaway service-role client for session minting. Not cached: the session it picks
 * up dies with the instance, which is the whole point — see the warning above.
 */
export function authClient(): SupabaseClient | null {
  if (!hasSupabase) return null;

  return createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
