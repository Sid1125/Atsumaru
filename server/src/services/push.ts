import { db } from "../db/queries.js";
import { dbError } from "../utils/response.js";
import type { Language } from "../types.js";

/** Expo's token format; anything else is rejected before it reaches the API. */
export const EXPO_PUSH_TOKEN_RE = /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Expo accepts at most 100 messages per request. */
export const PUSH_CHUNK_SIZE = 100;

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export function chunk<T>(items: T[], size = PUSH_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

const FEEDBACK_PROMPT: Record<Language, { title: string; body: string }> = {
  en: { title: "How was the meetup?", body: "Rate your group — it stays private." },
  ja: { title: "ミートアップはどうでした？", body: "グループを評価しましょう（非公開です）" },
  zh: { title: "聚会怎么样？", body: "为小组评分吧，你的选择保持私密。" },
};

/** Feedback reminder copy, in the member's language (docs/RULES.md §12). */
export function feedbackMessage(
  token: string,
  eventId: string,
  language: Language
): PushMessage {
  const copy = FEEDBACK_PROMPT[language] ?? FEEDBACK_PROMPT.en;

  return {
    to: token,
    title: copy.title,
    body: copy.body,
    // The app deep-links to the feedback screen from this payload.
    data: { type: "feedback", event_id: eventId },
  };
}

interface ExpoTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

/**
 * Fire-and-forget delivery: a push failure must never fail the request or job that
 * triggered it. Tokens Expo reports as unregistered are dropped so the table stays clean.
 */
export async function sendPush(messages: PushMessage[]): Promise<number> {
  const valid = messages.filter((message) => EXPO_PUSH_TOKEN_RE.test(message.to));
  let delivered = 0;

  for (const batch of chunk(valid)) {
    let tickets: ExpoTicket[];

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        console.error("Expo push request failed:", response.status);
        continue;
      }

      const payload = (await response.json()) as { data?: ExpoTicket[] };
      tickets = payload.data ?? [];
    } catch (error) {
      console.error("Expo push request failed:", (error as Error).message);
      continue;
    }

    const stale: string[] = [];

    tickets.forEach((ticket, index) => {
      if (ticket.status === "ok") {
        delivered += 1;
        return;
      }

      console.error("Expo push rejected:", ticket.message ?? ticket.details?.error);

      if (ticket.details?.error === "DeviceNotRegistered") {
        const token = batch[index]?.to;
        if (token) stale.push(token);
      }
    });

    if (stale.length > 0) await forgetTokens(stale);
  }

  return delivered;
}

async function forgetTokens(tokens: string[]) {
  const { error } = await db().from("push_tokens").delete().in("token", tokens);

  if (error) console.error("Could not remove stale push tokens:", error.message);
}

export interface PushTarget {
  user_id: string;
  token: string;
  language: Language;
}

/** Push targets for a set of users, skipping anyone with no registered device. */
export async function pushTargets(userIds: string[]): Promise<PushTarget[]> {
  if (userIds.length === 0) return [];

  const { data, error } = await db()
    .from("push_tokens")
    .select("user_id, token, user:users (language)")
    .in("user_id", userIds);

  if (error) throw dbError(error);

  return ((data ?? []) as unknown as {
    user_id: string;
    token: string;
    user: { language: Language } | null;
  }[]).map((row) => ({
    user_id: row.user_id,
    token: row.token,
    language: row.user?.language ?? "en",
  }));
}
