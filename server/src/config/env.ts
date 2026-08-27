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
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),

  HUGGINGFACE_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default("sentence-transformers/all-MiniLM-L6-v2"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const hasSupabase = !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
export const hasGroq = !!env.GROQ_API_KEY;
