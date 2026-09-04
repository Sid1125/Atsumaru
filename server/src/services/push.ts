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
  /**
   * Deep link for the tap. `data` alone is not enough: React Navigation's linking only
   * ever reads URLs, so a payload that carries only `{ type, event_id }` lands the user
   * on whatever screen they last had open. The app feeds this to `getInitialURL` /
   * `subscribe` (apps/mobile/src/app/navigation/linking.ts), which is what makes cold
   * start, warm start and background behave the same.
   *
   * `data` is kept alongside it — it is the older convention and still the cheaper thing
   * to read for analytics.
   */
  url?: string;
}

/**
 * The one place notification deep links are built, so a path cannot drift from
 * `linking.ts`'s `config.screens`. Group chat has no route of its own — it lives inside
 * the meetup screen — so a chat notification points at `meetup/:id`.
 */
export const deepLink = {
  meetup: (eventId: string) => `atsumaru://meetup/${eventId}`,
  dm: (connectionId: string) => `atsumaru://dm/${connectionId}`,
  discover: () => "atsumaru://discover",
} as const;


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
    url: deepLink.meetup(eventId),
  };
}

interface ExpoTicket {
  status: "ok" | "error";
  /** Present on an accepted ticket; the handle a receipt is later fetched by. */
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Keeps a title or preview inside what a notification tray will actually show. */
function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

const MEETUP_SOON: Record<Language, { title: string; body: (t: string) => string }> = {
  en: { title: "Starting soon", body: (t) => `${t} — heading out?` },
  ja: { title: "まもなく開始", body: (t) => `${t} — そろそろ出発しましょう` },
  zh: { title: "即将开始", body: (t) => `${t} — 准备出发了吗？` },
};

/**
 * The ~15-minutes-before nudge. Deliberately says "soon" rather than a number: the sweep
 * runs every 5 minutes, so this actually lands 15–20 minutes ahead and a precise claim
 * would sometimes be wrong.
 */
export function meetupSoonMessage(
  token: string,
  eventId: string,
  eventTitle: string,
  language: Language
): PushMessage {
  const copy = MEETUP_SOON[language] ?? MEETUP_SOON.en;

  return {
    to: token,
    title: copy.title,
    body: copy.body(truncate(eventTitle, 60)),
    data: { type: "meetup_soon", event_id: eventId },
    url: deepLink.meetup(eventId),
  };
}

/**
 * Group-chat title line. Naming the sender is safe here and everywhere else in this file
 * that does it: sender and recipient share a `group_members` row, so they are already in
 * the same chat. `display_name` only — `real_name` never leaves the server
 * (docs/RULES.md).
 */
const CHAT_GROUP: Record<Language, (count: number, where: string) => string> = {
  en: (count, where) =>
    count === 1 ? `New message in ${where}` : `${count} new messages in ${where}`,
  ja: (count, where) => (count === 1 ? `「${where}」に新着` : `「${where}」に新着${count}件`),
  zh: (count, where) =>
    count === 1 ? `「${where}」有新消息` : `「${where}」有 ${count} 条新消息`,
};

/** A group message the recipient was not connected to receive live. */
export function groupChatMessage(
  token: string,
  eventId: string,
  eventTitle: string,
  senderName: string,
  preview: string,
  count: number,
  language: Language
): PushMessage {
  const title = (CHAT_GROUP[language] ?? CHAT_GROUP.en)(
    count,
    truncate(eventTitle, 40)
  );

  return {
    to: token,
    title,
    body: `${truncate(senderName, 20)}: ${truncate(preview, 120)}`,
    data: { type: "chat", event_id: eventId },
    // Group chat has no route of its own; it lives inside the meetup screen.
    url: deepLink.meetup(eventId),
  };
}

/** A DM the recipient was not connected to receive live. */
export function dmChatMessage(
  token: string,
  connectionId: string,
  senderName: string,
  preview: string,
  count: number,
  language: Language
): PushMessage {
  const suffix =
    count === 1
      ? ""
      : language === "ja"
        ? `（${count}件）`
        : language === "zh"
          ? `（${count} 条）`
          : ` (${count})`;

  return {
    to: token,
    title: `${truncate(senderName, 24)}${suffix}`,
    body: truncate(preview, 120),
    data: { type: "chat", connection_id: connectionId },
    url: deepLink.dm(connectionId),
  };
}

const NEARBY: Record<
  Language,
  { title: string; body: (title: string, venue: string) => string }
> = {
  en: { title: "A meetup near you", body: (t, v) => `${t} · ${v}` },
  ja: { title: "近くでミートアップ", body: (t, v) => `${t}・${v}` },
  zh: { title: "附近有聚会", body: (t, v) => `${t}・${v}` },
};

/**
 * A newly opened meetup within range of the member's stored one-shot location. Says
 * nothing about distance: the stored point can be up to a week old, so "500m away" would
 * be a claim this cannot stand behind.
 */
export function nearbyMessage(
  token: string,
  eventId: string,
  eventTitle: string,
  venueName: string,
  language: Language
): PushMessage {
  const copy = NEARBY[language] ?? NEARBY.en;

  return {
    to: token,
    title: copy.title,
    body: copy.body(truncate(eventTitle, 44), truncate(venueName, 30)),
    data: { type: "nearby", event_id: eventId },
    url: deepLink.meetup(eventId),
  };
}

const REENGAGE: Record<
  Language,
  { title: string; body: (name: string, others: number, where: string) => string }
> = {
  en: {
    title: "Your group is still there",
    body: (name, others, where) =>
      others > 0
        ? `${name} and ${others} others are in ${where}`
        : `${name} is in ${where}`,
  },
  ja: {
    title: "グループはそのままです",
    body: (name, others, where) =>
      others > 0
        ? `${name}さんほか${others}人が「${where}」にいます`
        : `${name}さんが「${where}」にいます`,
  },
  zh: {
    title: "你的小组还在",
    body: (name, others, where) =>
      others > 0
        ? `${name} 和其他 ${others} 人还在「${where}」`
        : `${name} 还在「${where}」`,
  },
};

/**
 * Re-engagement nudge for someone who has not opened the app in a while.
 *
 * Every clause is a fact: `name` and `others` come from `group_members` rows the recipient
 * also belongs to, so this states who is in a group they are already in. It is drawn from
 * membership *only* — never from `feedback` or `connections`, which would leak who rated
 * or picked whom (docs/RULES.md) — and it never claims anyone is waiting for, missing, or
 * asking after the recipient, because none of that is known.
 */
export function reengagementMessage(
  token: string,
  eventId: string,
  memberName: string,
  otherCount: number,
  eventTitle: string,
  language: Language
): PushMessage {
  const copy = REENGAGE[language] ?? REENGAGE.en;

  return {
    to: token,
    title: copy.title,
    body: copy.body(
      truncate(memberName, 20),
      otherCount,
      truncate(eventTitle, 40)
    ),
    data: { type: "reengagement", event_id: eventId },
    url: deepLink.meetup(eventId),
  };
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
