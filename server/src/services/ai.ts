import Groq from "groq-sdk";
import { z } from "zod";

import { env, hasGroq } from "../config/env.js";

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

let groq: Groq | null = null;

function client(): Groq {
  if (!hasGroq) throw new Error("GROQ_API_KEY is not configured.");
  groq ??= new Groq({ apiKey: env.GROQ_API_KEY });
  return groq;
}

export async function onboardingChat(
  messages: OnboardingTurn[],
  language?: string
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

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = extractionSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    // Never forward unvalidated model output to the client.
    return { reply: "Sorry, could you say that again?", done: false };
  }

  return parsed.data;
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

  return Array.isArray(data[0]) ? (data as number[][])[0]! : (data as number[]);
}
