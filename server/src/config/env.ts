import "dotenv/config";
import { z } from "zod";

/**
 * Ships in the repo, so it is only ever a development convenience — production refuses
 * to boot on it (see the bottom of this file).
 */
const DEV_STATE_SECRET_PREFIX = "atsumaru-dev";

// Fail fast at boot rather than at the first request with a missing key.
const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("*"),

  /**
   * When set, the API trusts the leftmost `X-Forwarded-For` entry as the client IP
   * (behind a reverse proxy / load balancer). Off by default, so an attacker cannot
   * forge the header to reset or redirect the IP-keyed auth rate limits.
   */
  TRUST_PROXY: z
    .string()
    .default("false")
    .transform((value) => value === "true" || value === "1"),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  GROQ_API_KEY: z.string().optional(),
  /**
   * llama-3.3-70b-versatile was decommissioned by Groq and 404s on current keys;
   * gpt-oss-120b is the successor with the same 131k context and JSON-mode support.
   */
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),

  HUGGINGFACE_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default("sentence-transformers/all-MiniLM-L6-v2"),

  // OAuth (docs/TRD.md §5): LINE and Google only, no phone OTP.
  LINE_CHANNEL_ID: z.string().optional(),
  LINE_CHANNEL_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  /** Where the provider sends the user back; must match the provider console entry. */
  OAUTH_CALLBACK_URL: z.string().url().default("http://localhost:4000/api/auth/callback"),
  /** Deep link the app listens on when the callback is asked to redirect. */
  APP_AUTH_REDIRECT: z.string().default("atsumaru://auth"),
  /** Public URL of this API (e.g. https://atsumaru-6i3n.onrender.com). Used to build the
   *  confirmation-page link target for the Supabase email so the user lands on our branded
   *  page first, then returns to the app from it. When unset the email link goes straight to
   *  APP_AUTH_REDIRECT (the app scheme) and the user confirms inside the app instead. */
  APP_PUBLIC_URL: z.string().url().default("https://atsumaru-6i3n.onrender.com"),
  /** Signs the OAuth `state` blob. Random per deployment; a default keeps dev simple. */
  AUTH_STATE_SECRET: z.string().min(16).default(`${DEV_STATE_SECRET_PREFIX}-state-secret`),

  /**
   * Cloudflare Turnstile (docs/ATSUMARU_SECURITY_COMPLETE §22). Optional: when both keys
   * are absent the auth handoff runs without a challenge, matching the has* degrade
   * convention. When set, /auth/session and the OAuth provider initiation require a
   * valid turnstile token — the app's single code handoff is the brute-force surface.
   */
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  /** Env-flag (never a literal key in code): always-pass test mode. Set true alongside
   *  the Cloudflare testing keys so the gate is exercised but never blocks when the client
   *  widget cannot render (no dev build → no token). Leave unset in production. */
  TURNSTILE_ALWAYS_PASS: z
    .enum(["true", "1"])
    .optional()
    .transform((v) => v === "true" || v === "1"),

  /** Set to run the sweep through BullMQ instead of the in-process interval. */
  REDIS_URL: z.string().optional(),
});

// `.env.example` ships with blank values, and a blank is "not configured" rather than
// an invalid value — otherwise copying the example file would fail every URL check.
const provided = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== undefined && value !== "")
);

const parsed = schema.safeParse(provided);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const hasSupabase = !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
export const hasGroq = !!env.GROQ_API_KEY;
export const hasEmbeddings = !!env.HUGGINGFACE_API_KEY;
export const hasLine = !!(env.LINE_CHANNEL_ID && env.LINE_CHANNEL_SECRET);
export const hasGoogle = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const hasTurnstile = !!(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
export const hasRedis = !!env.REDIS_URL;

/**
 * Both of these are fine defaults in development and unsafe in production, so a
 * production boot fails on them instead of warning into a log nobody reads.
 *
 * `AUTH_STATE_SECRET` is the sharper one: it signs the OAuth `state` blob, and its
 * default is committed to this repo — leaving it in place makes that signature forgeable
 * by anyone who has read the source.
 */
if (env.NODE_ENV === "production") {
  const faults: string[] = [];

  if (env.AUTH_STATE_SECRET.startsWith(DEV_STATE_SECRET_PREFIX)) {
    faults.push(
      "AUTH_STATE_SECRET is still the development default, which is public in this repo."
    );
  }

  if (env.CORS_ORIGIN === "*") {
    faults.push("CORS_ORIGIN must name the allowed origin in production, not '*'.");
  }

  if (faults.length > 0) {
    console.error("Refusing to start in production:");
    for (const fault of faults) console.error(`  - ${fault}`);
    process.exit(1);
  }
}
