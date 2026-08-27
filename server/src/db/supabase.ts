import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env, hasSupabase } from "../config/env.js";

let client: SupabaseClient | null = null;

/**
 * Service-role client: bypasses RLS, so it must never be exposed to the app.
 * Returns null until Supabase credentials are configured.
 */
export function supabase(): SupabaseClient | null {
  if (!hasSupabase) return null;

  client ??= createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  return client;
}
