/**
 * The chat notification: a push for a message the recipient was not connected to receive.
 *
 * Deliberately *not* an unread digest. `messages` has no read state — no `last_read_at`, no
 * receipts — so "unread" cannot be computed without new schema and a mark-as-read write
 * path. Live-socket presence answers the question that actually matters ("did they already
 * see it?") with what the socket layer already knows.
 *
 * Two guards keep this from becoming spam:
 *   * presence — someone with the thread open got the message over the socket already;
 *   * a per-thread debounce — twenty messages in a burst are one notification, not twenty.
 *
 * Nothing here reads or writes a model. `docs/AI.md` §10 keeps chat free of summarisation,
 * sentiment and embeddings, and a notification is none of those: the body is the sender's
 * own text, truncated.
 */

import { db } from "../db/queries.js";
import { dbError } from "../utils/response.js";
import { ephemeral } from "./ephemeral.js";
import { onlineUserIds } from "../socket/presence.js";
import { notify } from "./notifications.js";
import { groupChatMessage, dmChatMessage } from "./push.js";

/**
 * One notification per member per thread per window.
 *
 * Runs on the shared ephemeral store rather than a `Map` of its own, so two API instances
 * agree on the window instead of each keeping their own — the same reason the rate limiters
 * and OAuth handoff codes live there. A budget of one *is* a rate limit, so this reuses
 * `bump` rather than inventing a second kind of counter.
 */
const DEBOUNCE_MS = 5 * 60 * 1000;

/** True the first time a (member, thread) pair is seen in the window, false after. */
async function firstInWindow(userId: string, threadKey: string): Promise<boolean> {
  const { count } = await ephemeral.bump(
    `chat-notice:${threadKey}:${userId}`,
    DEBOUNCE_MS
  );

  return count === 1;
}


/** Members who are neither the sender nor currently connected. */
async function absentRecipients(
  candidateIds: string[],
  senderId: string
): Promise<string[]> {
  const others = candidateIds.filter((id) => id !== senderId);

  if (others.length === 0) return [];

  const online = await onlineUserIds(others);

  return others.filter((id) => !online.has(id));
}

/** Drops anyone already notified about this thread inside the window. */
async function withinDebounce(
  userIds: string[],
  threadKey: string
): Promise<string[]> {
  const verdicts = await Promise.all(
    userIds.map(async (userId) => ({
      userId,
      first: await firstInWindow(userId, threadKey),
    }))
  );

  return verdicts.filter((v) => v.first).map((v) => v.userId);
}

async function senderName(senderId: string): Promise<string> {
  const { data, error } = await db()
    .from("users")
    // `display_name` only. `real_name` never leaves the server (docs/RULES.md).
    .select("display_name")
    .eq("id", senderId)
    .maybeSingle<{ display_name: string }>();

  if (error) throw dbError(error);

  return data?.display_name ?? "";
}

/**
 * Notifies group members who were not connected when `message` was sent.
 *
 * Best-effort by contract: the message is already persisted and broadcast before this runs,
 * so a failure here costs a notification and never a message.
 */
export async function notifyGroupMessage(
  eventId: string,
  senderId: string,
  message: string
): Promise<number> {
  const { data: members, error } = await db()
    .from("group_members")
    .select("user_id")
    .eq("event_id", eventId);

  if (error) throw dbError(error);

  const absent = await absentRecipients(
    ((members ?? []) as { user_id: string }[]).map((row) => row.user_id),
    senderId
  );

  const recipients = await withinDebounce(absent, `event:${eventId}`);

  if (recipients.length === 0) return 0;

  const { data: event, error: eventError } = await db()
    .from("events")
    .select("title")
    .eq("id", eventId)
    .maybeSingle<{ title: string }>();

  if (eventError) throw dbError(eventError);

  const name = await senderName(senderId);

  return await notify("chat", recipients, (target) =>
    groupChatMessage(
      target.token,
      eventId,
      event?.title ?? "",
      name,
      message,
      // The debounce collapses a burst, so a count would be a number this cannot know
      // without read state. One notification, one message.
      1,
      target.language
    )
  );
}

/** The same, for a 1:1 thread. Only the two participants exist, so there is no fan-out. */
export async function notifyDmMessage(
  connectionId: string,
  senderId: string,
  message: string
): Promise<number> {
  const { data: connection, error } = await db()
    .from("connections")
    .select("user_a, user_b")
    .eq("id", connectionId)
    .maybeSingle<{ user_a: string; user_b: string }>();

  if (error) throw dbError(error);
  if (!connection) return 0;

  const absent = await absentRecipients(
    [connection.user_a, connection.user_b],
    senderId
  );

  const recipients = await withinDebounce(absent, `dm:${connectionId}`);

  if (recipients.length === 0) return 0;

  const name = await senderName(senderId);

  return await notify("chat", recipients, (target) =>
    dmChatMessage(target.token, connectionId, name, message, 1, target.language)
  );
}
