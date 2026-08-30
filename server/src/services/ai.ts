import Groq from "groq-sdk";
import { z } from "zod";

import { env, hasEmbeddings, hasGroq } from "../config/env.js";
import type { Language } from "../types.js";
import { HttpError } from "../utils/response.js";
import {
  MAX_RECAP_CHARS,
  sanitizeRecap,
  type RecapPrompt,
} from "../modules/recap/vibe.js";

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

/**
 * MiniLM embedding via the HuggingFace inference router (docs/AI.md §4).
 *
 * The legacy `api-inference.huggingface.co` host was retired and no longer resolves,
 * so this goes through `router.huggingface.co`, which does not accept the old
 * `options.wait_for_model` flag. all-MiniLM-L6-v2 returns 384 L2-normalized floats,
 * so cosine similarity in modules/matching/score.ts is effectively a dot product.
 */
export async function embed(text: string): Promise<number[]> {
  if (!hasEmbeddings) {
    throw new HttpError(
      503,
      "EMBEDDING_UNAVAILABLE",
      "Embeddings are not configured."
    );
  }

  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${env.EMBEDDING_MODEL}/pipeline/feature-extraction`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
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

const RECAP_SYSTEM_PROMPT = `You write one-sentence recaps for Atsumaru, a
friendship-first group meetup app in Japan.

You receive anonymised traits from one member's private post-meetup ratings. Write a
single warm sentence, under 160 characters, telling that member what kind of people they
clicked with. Address them as "you".

Rules:
- Never invent or mention a name, handle, or person. You are given none.
- Never say how many people were rated, or that anyone was rated negatively.
- Never imply anyone disliked the reader.
- Reply in the requested language.

Reply with JSON only: {"recap": "..."}`;

const recapSchema = z.object({ recap: z.string().min(1).max(MAX_RECAP_CHARS) });

/**
 * Groq's second and only other job: the post-meetup vibe recap (docs/AI.md §6a).
 *
 * Returns null rather than throwing, because a recap is passive — the member did not ask
 * for it and is not waiting on it, so the route answers with `templateRecap()` instead of
 * an error. A 503 here would render an empty card that looks like a bug.
 *
 * The `RecapPrompt` shape is the privacy boundary: it holds anonymised traits, a count,
 * and the meetup category, and there is no field a handle or user id could occupy. Output
 * still goes through `sanitizeRecap`, since a model can hallucinate a name it was never
 * given.
 */
export async function vibeRecap(prompt: RecapPrompt): Promise<string | null> {
  if (!hasGroq) return null;

  try {
    const completion = await client().chat.completions.create({
      model: env.GROQ_MODEL,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: RECAP_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(prompt) },
      ],
    });

    const parsed = recapSchema.safeParse(
      JSON.parse(completion.choices[0]?.message?.content ?? "{}")
    );

    if (!parsed.success) return null;

    return sanitizeRecap(parsed.data.recap);
  } catch (error) {
    // Network failure, a decommissioned model id, malformed JSON — all the same to the
    // caller, which falls back to the deterministic template.
    console.warn("Vibe recap unavailable, using the template instead:", error);
    return null;
  }
}
