import Groq from "groq-sdk";
import { z } from "zod";

import { env, hasGroq } from "../config/env.js";
import type { Language } from "../types.js";

/** `preference_vector` is `vector(384)` in schema.sql (MiniLM all-MiniLM-L6-v2). */
export const EMBEDDING_DIMS = 384;

const SYSTEM_PROMPT = `You are the onboarding host for Atsumaru, a friendship-first
group meetup app in Japan. Have a short, warm conversation (3-4 exchanges) to learn
what the user enjoys doing and how they socialise. Reply in the user's language.
Never ask for real names, contact details, or romantic preferences.

When you have enough to describe them, reply with JSON only:
{"reply": "...", "done": true, "extracted": {"interests": ["..."], "personality": ["..."]}}
Otherwise reply with JSON only:
{"reply": "...", "done": false}`;

// AI output is untrusted input: validate before it touches the profile (docs/RULES.md §13).
const extractionSchema = z.object({
  reply: z.string().min(1),
  done: z.boolean(),
  extracted: z
    .object({
      interests: z.array(z.string().min(1).max(40)).max(12),
      personality: z.array(z.string().min(1).max(40)).max(8),
    })
    .optional(),
});

export type OnboardingTurn = { role: "user" | "assistant"; content: string };
export type OnboardingResult = z.infer<typeof extractionSchema>;

/** Shown when the model returns something unusable, in the user's own language. */
const RETRY_REPLY: Record<Language, string> = {
  en: "Sorry, could you say that again?",
  ja: "すみません、もう一度お願いできますか？",
  zh: "抱歉，可以再说一次吗？",
};

let groq: Groq | null = null;

function client(): Groq {
  if (!hasGroq) throw new Error("GROQ_API_KEY is not configured.");
  groq ??= new Groq({ apiKey: env.GROQ_API_KEY });
  return groq;
}

export async function onboardingChat(
  messages: OnboardingTurn[],
  language?: Language
): Promise<OnboardingResult> {
  const completion = await client().chat.completions.create({
    model: env.GROQ_MODEL,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...(language
        ? [{ role: "system" as const, content: `Reply in language: ${language}` }]
        : []),
      ...messages,
    ],
  });

  const retry: OnboardingResult = {
    reply: RETRY_REPLY[language ?? "en"],
    done: false,
  };

  // Model output is untrusted: malformed JSON must not surface as a 500.
  let raw: unknown;

  try {
    raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  } catch {
    return retry;
  }

  const parsed = extractionSchema.safeParse(raw);

  // Never forward unvalidated model output to the client.
  return parsed.success ? parsed.data : retry;
}

/** MiniLM embedding via the HuggingFace inference API (docs/AI.md §4). */
export async function embed(text: string): Promise<number[]> {
  if (!env.HUGGINGFACE_API_KEY) {
    throw new Error("HUGGINGFACE_API_KEY is not configured.");
  }

  const response = await fetch(
    `https://api-inference.huggingface.co/pipeline/feature-extraction/${env.EMBEDDING_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    }
  );

  if (!response.ok) {
    throw new Error(`Embedding request failed: ${response.status}`);
  }

  const data = (await response.json()) as number[] | number[][];
  const vector = Array.isArray(data[0]) ? (data as number[][])[0]! : (data as number[]);

  // The column is vector(384); a different width would fail deep inside Postgres.
  if (vector.length !== EMBEDDING_DIMS) {
    throw new Error(
      `Embedding has ${vector.length} dims, expected ${EMBEDDING_DIMS}.`
    );
  }

  return vector;
}
