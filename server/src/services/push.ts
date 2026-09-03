import { db } from "../db/queries.js";
import { dbError } from "../utils/response.js";
import type { Language } from "../types.js";

/** Expo's token format; anything else is rejected before it reaches the API. */
export const EXPO_PUSH_TOKEN_RE = /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPT_URL = "https://exp.host/--/api/v2/push/getReceipts";

/** Expo accepts at most 100 messages per request. */
export const PUSH_CHUNK_SIZE = 100;

/**
 * A send only yields a ticket; whether the device actually got the notification shows up
 * on a receipt, and Expo needs minutes to produce one. Asking sooner just returns nothing.
 */
export const RECEIPT_DELAY_MS = 15 * 60 * 1000;

/** Receipts Expo never produced are dropped rather than retried forever. */
export const RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;

/** How many tickets one collection pass looks at. */
export const RECEIPT_BATCH_SIZE = 300;

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
  /** Present on an accepted ticket; the handle a receipt is later fetched by. */
  id?: string;
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
    const accepted: { ticket_id: string; token: string }[] = [];

    tickets.forEach((ticket, index) => {
      const token = batch[index]?.to;

      if (ticket.status === "ok") {
        delivered += 1;

        // Accepted only means Expo took it. The receipt says what the device did with it.
        if (ticket.id && token) accepted.push({ ticket_id: ticket.id, token });
        return;
      }

      console.error("Expo push rejected:", ticket.message ?? ticket.details?.error);

      if (ticket.details?.error === "DeviceNotRegistered" && token) {
        stale.push(token);
      }
    });

    if (stale.length > 0) await forgetTokens(stale);
    if (accepted.length > 0) await recordTickets(accepted);
  }

  return delivered;
}

/** Best-effort: a bookkeeping failure must not turn into a failed notification. */
async function recordTickets(rows: { ticket_id: string; token: string }[]) {
  const { error } = await db()
    .from("push_receipts")
    .upsert(rows, { onConflict: "ticket_id" });

  if (error) console.error("Could not record push tickets:", error.message);
}

interface ExpoReceipt {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

/**
 * Second half of Expo delivery. Tickets recorded by {@link sendPush} are read back once
 * they are old enough to have a receipt, and a token the device no longer holds is
 * retired — the case a ticket alone cannot report (docs/TRD.md §14).
 *
 * Returns the number of tickets resolved this pass.
 */
export async function collectPushReceipts(now = Date.now()): Promise<number> {
  const { data, error } = await db()
    .from("push_receipts")
    .select("ticket_id, token, created_at")
    .lte("created_at", new Date(now - RECEIPT_DELAY_MS).toISOString())
    .order("created_at", { ascending: true })
    .limit(RECEIPT_BATCH_SIZE);

  if (error) throw dbError(error);

  const tickets = (data ?? []) as {
    ticket_id: string;
    token: string;
    created_at: string;
  }[];

  if (tickets.length === 0) return 0;

  let receipts: Record<string, ExpoReceipt> = {};

  try {
    const response = await fetch(EXPO_RECEIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: tickets.map((ticket) => ticket.ticket_id) }),
    });

    if (!response.ok) {
      console.error("Expo receipt request failed:", response.status);
      return 0;
    }

    const payload = (await response.json()) as {
      data?: Record<string, ExpoReceipt>;
    };

    receipts = payload.data ?? {};
  } catch (fetchError) {
    console.error("Expo receipt request failed:", (fetchError as Error).message);
    return 0;
  }

  const stale: string[] = [];
  const resolved: string[] = [];

  for (const ticket of tickets) {
    const receipt = receipts[ticket.ticket_id];

    if (!receipt) {
      // Expo has no answer yet. Retried next pass, unless it has aged out entirely —
      // otherwise a receipt that never arrives keeps its row forever.
      if (Date.parse(ticket.created_at) <= now - RECEIPT_TTL_MS) {
        resolved.push(ticket.ticket_id);
      }
      continue;
    }

    if (receipt.status === "error") {
      console.error("Expo push failed:", receipt.message ?? receipt.details?.error);

      if (receipt.details?.error === "DeviceNotRegistered") stale.push(ticket.token);
    }

    resolved.push(ticket.ticket_id);
  }

  if (stale.length > 0) await forgetTokens(stale);

  if (resolved.length > 0) {
    const { error: deleteError } = await db()
      .from("push_receipts")
      .delete()
      .in("ticket_id", resolved);

    if (deleteError) console.error("Could not clear push tickets:", deleteError.message);
  }

  return resolved.length;
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
