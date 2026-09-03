/**
 * Everything that has to happen after a meetup, on a timer: close it out, remind the
 * members to leave feedback (docs/TRD.md §14), and settle reputation for the people who
 * never did (docs/IDEA.md §6). Every pass is idempotent, so running it twice is safe.
 */

import { db } from "../db/queries.js";
import { applyReputation, REPUTATION_DELTA } from "../modules/matching/score.js";
import {
  collectPushReceipts,
  feedbackMessage,
  pushTargets,
  sendPush,
} from "../services/push.js";
import { dbError } from "../utils/response.js";

/** Matches `event_status()` in schema.sql; the two must stay in step. */
export const MEETUP_DURATION_MS = 2 * 60 * 60 * 1000;

/** Feedback is asked for roughly an hour into the meetup (docs/API_STRUCTURE.md §8). */
export const REMINDER_DELAY_MS = 60 * 60 * 1000;

export interface SweepEvent {
  id: string;
  start_time: string;
  feedback_reminder_sent_at: string | null;
  reputation_settled_at: string | null;
}

export function dueForReminder(event: SweepEvent, now: number): boolean {
  if (event.feedback_reminder_sent_at) return false;

  return now >= Date.parse(event.start_time) + REMINDER_DELAY_MS;
}

export function dueForSettlement(event: SweepEvent, now: number): boolean {
  if (event.reputation_settled_at) return false;

  return now >= Date.parse(event.start_time) + MEETUP_DURATION_MS;
}

/** Members with no feedback row of their own for this event — the ghosts. */
export function membersMissingFeedback(
  memberIds: string[],
  submitters: string[]
): string[] {
  const submitted = new Set(submitters);

  return memberIds.filter((id) => !submitted.has(id));
}

export interface SweepResult {
  completed: number;
  remindersSent: number;
  eventsSettled: number;
  receiptsChecked: number;
}

export async function runSweep(now = Date.now()): Promise<SweepResult> {
  const result: SweepResult = {
    completed: 0,
    remindersSent: 0,
    eventsSettled: 0,
    receiptsChecked: 0,
  };
  const cutoff = new Date(now - MEETUP_DURATION_MS).toISOString();

  // 1. Stored status catches up with what event_status() already reports.
  const { data: closed, error: closeError } = await db()
    .from("events")
    .update({ status: "completed" })
    .lte("start_time", cutoff)
    .neq("status", "completed")
    .select("id");

  if (closeError) throw dbError(closeError);

  result.completed = (closed ?? []).length;

  // 2 & 3. Only events that are past their reminder time can need either pass.
  const { data: events, error: eventsError } = await db()
    .from("events")
    .select("id, start_time, feedback_reminder_sent_at, reputation_settled_at")
    .lte("start_time", new Date(now - REMINDER_DELAY_MS).toISOString())
    .or("feedback_reminder_sent_at.is.null,reputation_settled_at.is.null");

  if (eventsError) throw dbError(eventsError);

  for (const event of (events ?? []) as SweepEvent[]) {
    if (dueForReminder(event, now)) {
      result.remindersSent += await remind(event);
    }

    if (dueForSettlement(event, now) && (await settle(event))) {
      result.eventsSettled += 1;
    }
  }

  // 4. Expo answers a send with a ticket and the real outcome only minutes later, so
  //    receipts are their own pass. Isolated on purpose: a receipt problem must never
  //    fail the stamped work above, which is what the sweep exists for.
  try {
    result.receiptsChecked = await collectPushReceipts(now);
  } catch (error) {
    console.error("Push receipt collection failed:", (error as Error).message);
  }

  return result;
}

async function memberIds(eventId: string): Promise<string[]> {
  const { data, error } = await db()
    .from("group_members")
    .select("user_id")
    .eq("event_id", eventId);

  if (error) throw dbError(error);

  return ((data ?? []) as { user_id: string }[]).map((row) => row.user_id);
}

async function submitterIds(eventId: string): Promise<string[]> {
  const { data, error } = await db()
    .from("feedback")
    .select("from_user")
    .eq("event_id", eventId);

  if (error) throw dbError(error);

  return ((data ?? []) as { from_user: string }[]).map((row) => row.from_user);
}

/**
 * Takes ownership of one of the two idempotency stamps. The update only matches while the
 * column is still null, so when two drivers race — BullMQ alongside the boot-time
 * `sweepOnce()`, or two API instances — exactly one gets a row back and does the work.
 *
 * Deliberately stamped *before* the side effect rather than after. Stamping afterwards is
 * what let both drivers send the same reminder and dock the same ghosts twice. The cost of
 * this order is the opposite failure: a crash between the claim and the effect skips that
 * event instead of repeating it. That is the right way round — a missed reminder costs one
 * notification, while a double dock permanently alters someone's reputation.
 */
async function claim(
  eventId: string,
  column: "feedback_reminder_sent_at" | "reputation_settled_at"
): Promise<boolean> {
  const { data, error } = await db()
    .from("events")
    .update({ [column]: new Date().toISOString() })
    .eq("id", eventId)
    .is(column, null)
    .select("id");

  if (error) throw dbError(error);

  return (data ?? []).length > 0;
}

/** Nudges everyone who has not submitted yet. Claims the event first. */
async function remind(event: SweepEvent): Promise<number> {
  if (!(await claim(event.id, "feedback_reminder_sent_at"))) return 0;

  const members = await memberIds(event.id);

  // A solo group has nobody to rate, so there is nothing worth a notification. The claim
  // above already stamped it: the window has passed either way.
  if (members.length < 2) return 0;

  const pending = membersMissingFeedback(members, await submitterIds(event.id));
  const targets = await pushTargets(pending);

  return sendPush(
    targets.map((target) => feedbackMessage(target.token, event.id, target.language))
  );
}

/**
 * Reputation reflects reliability, so skipping feedback costs a little. Applied once per
 * event, after the meetup window closes. Returns false when another driver got there
 * first.
 */
async function settle(event: SweepEvent): Promise<boolean> {
  if (!(await claim(event.id, "reputation_settled_at"))) return false;

  const members = await memberIds(event.id);
  const ghosts = membersMissingFeedback(members, await submitterIds(event.id));

  if (ghosts.length > 0) {
    const { data, error } = await db()
      .from("users")
      .select("id, reputation_score")
      .in("id", ghosts);

    if (error) throw dbError(error);

    for (const row of (data ?? []) as { id: string; reputation_score: number }[]) {
      const next = applyReputation(
        Number(row.reputation_score),
        REPUTATION_DELTA.missedFeedback
      );

      const { error: updateError } = await db()
        .from("users")
        .update({ reputation_score: next })
        .eq("id", row.id);

      if (updateError) throw dbError(updateError);
    }
  }

  return true;
}
