import "dotenv/config";
import { z } from "zod";

// Fail fast at boot rather than at the first request with a missing key.
const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("*"),

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
  /** Signs the OAuth `state` blob. Random per deployment; a default keeps dev simple. */
  AUTH_STATE_SECRET: z.string().min(16).default("atsumaru-dev-state-secret"),

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
export const hasRedis = !!env.REDIS_URL;

if (env.NODE_ENV === "production" && env.AUTH_STATE_SECRET.startsWith("atsumaru-dev")) {
  console.warn("AUTH_STATE_SECRET is still the development default — set a real one.");
}
