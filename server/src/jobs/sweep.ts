/**
 * Everything that has to happen around a meetup, on a timer: remind the members shortly
 * before it starts, close it out, remind them to leave feedback (docs/TRD.md §14), and
 * settle reputation for the people who never did (docs/IDEA.md §6). Every pass is
 * idempotent, so running it twice is safe.
 */

import { db } from "../db/queries.js";
import { applyReputation, REPUTATION_DELTA } from "../modules/matching/score.js";
import { notify, isQuietHour } from "../services/notifications.js";
import {
  collectPushReceipts,
  feedbackMessage,
  meetupSoonMessage,
  reengagementMessage,
  pushTargets,
  sendPush,
} from "../services/push.js";
import { dbError } from "../utils/response.js";

/** Matches `event_status()` in schema.sql; the two must stay in step. */
export const MEETUP_DURATION_MS = 2 * 60 * 60 * 1000;

/** Feedback is asked for roughly an hour into the meetup (docs/API_STRUCTURE.md §8). */
export const REMINDER_DELAY_MS = 60 * 60 * 1000;

/** How far ahead of `start_time` the "starting soon" nudge is aimed. */
export const START_REMINDER_LEAD_MS = 15 * 60 * 1000;

/** The sweep's own cadence; the reminder window has to be at least this wide. */
export const SWEEP_GRAIN_MS = 5 * 60 * 1000;

/**
 * A meetup is only seen once per sweep, so aiming at exactly 15 minutes would miss any
 * meetup whose 15-minute mark fell between two runs. The window is the lead time plus one
 * interval — and it is bounded above for the obvious reason: without that, every meetup
 * next week would match.
 */
export const START_REMINDER_WINDOW_MS = START_REMINDER_LEAD_MS + SWEEP_GRAIN_MS;


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

/**
 * A meetup that has not started yet, for the pre-start nudge. Its own shape rather than
 * `SweepEvent`: this pass needs the title for the copy and none of the settle stamps, and
 * it reads events on the *other* side of `start_time`.
 */
export interface UpcomingEvent {
  id: string;
  title: string;
  start_time: string;
  start_reminder_sent_at: string | null;
}

export function dueForStartReminder(event: UpcomingEvent, now: number): boolean {
  if (event.start_reminder_sent_at) return false;

  const start = Date.parse(event.start_time);

  // Already under way. "Starting soon" would simply be false, and the member is either
  // there or has already missed it.
  if (start <= now) return false;

  return start - now <= START_REMINDER_WINDOW_MS;
}

export interface SweepResult {
  completed: number;
  startRemindersSent: number;
  remindersSent: number;
  eventsSettled: number;
  receiptsChecked: number;
  reengaged: number;
}

export async function runSweep(now = Date.now()): Promise<SweepResult> {
  const result: SweepResult = {
    completed: 0,
    startRemindersSent: 0,
    remindersSent: 0,
    eventsSettled: 0,
    receiptsChecked: 0,
    reengaged: 0,
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

  // 2. Meetups about to start. Its own query on purpose: the candidate select below can
  //    only ever return events already past their start time, so a pre-start pass cannot
  //    ride along with it. Isolated in a try/catch for the same reason the receipt pass
  //    is — a nudge is the least important thing the sweep does, and it must not be able
  //    to fail the stamped work that follows.
  try {
    const { data: upcoming, error: upcomingError } = await db()
      .from("events")
      .select("id, title, start_time, start_reminder_sent_at")
      .is("start_reminder_sent_at", null)
      .gt("start_time", new Date(now).toISOString())
      .lte("start_time", new Date(now + START_REMINDER_WINDOW_MS).toISOString());

    if (upcomingError) throw dbError(upcomingError);

    for (const event of (upcoming ?? []) as UpcomingEvent[]) {
      if (dueForStartReminder(event, now)) {
        result.startRemindersSent += await remindBeforeStart(event);
      }
    }
  } catch (error) {
    console.error("Pre-start reminder pass failed:", (error as Error).message);
  }

  // 3 & 4. Only events that are past their reminder time can need either pass.
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

  // 5. Expo answers a send with a ticket and the real outcome only minutes later, so
  //    receipts are their own pass. Isolated on purpose: a receipt problem must never
  //    fail the stamped work above, which is what the sweep exists for.
  try {
    result.receiptsChecked = await collectPushReceipts(now);
  } catch (error) {
    console.error("Push receipt collection failed:", (error as Error).message);
  }

  // 6. Members who have drifted away. Last, and isolated, because it is the only pass that
  //    is purely optional — everything above is either a state transition or a promise the
  //    product made.
  try {
    result.reengaged = await reengage(now);
  } catch (error) {
    console.error("Re-engagement pass failed:", (error as Error).message);
  }

  return result;
}

/**
 * Nudges the group shortly before the meetup starts.
 *
 * Claims its stamp before sending, like every other pass here: a crash between the claim
 * and the send costs one notification, whereas stamping afterwards lets two drivers — BullMQ
 * alongside the boot-time run, or two API instances — send the same reminder to the same
 * group. For a reminder that is the cheap mistake to make.
 */
async function remindBeforeStart(event: UpcomingEvent): Promise<number> {
  if (!(await claim(event.id, "start_reminder_sent_at"))) return 0;

  const members = await memberIds(event.id);

  if (members.length === 0) return 0;

  return await notify("meetup_soon", members, (target) =>
    meetupSoonMessage(target.token, event.id, event.title, target.language)
  );
}

/** How long away someone has to be before the app says anything about it. */
export const INACTIVE_DAYS = 7;

/** And how long it then waits before saying anything again. */
export const REENGAGE_GAP_DAYS = 14;

/** Bounded per pass: this is the one thing here nobody is waiting for. */
const REENGAGE_BATCH = 50;

interface ReengageCandidate {
  user_id: string;
  event_id: string;
  event_title: string;
  member_name: string | null;
  other_count: number;
}

/**
 * One nudge to members who have not opened the app in a while, naming someone from a group
 * they are in.
 *
 * Every word of that notification is a fact `reengagement_candidates` can prove: the member
 * is in that group, and so is the person named. Nothing claims anyone is waiting for them,
 * missing them, or asked after them — none of which is knowable, and the last of which
 * would leak feedback (docs/RULES.md).
 *
 * The gap is stamped *before* the send, for the same reason the pre-start reminder claims
 * before sending: a crash after stamping costs one nudge, a crash before it means nudging
 * the same person on the next tick, every tick.
 */
async function reengage(now: number): Promise<number> {
  // Checked here rather than left to notify(), which would drop the notification *after*
  // the gap had been stamped — burning someone's 14 days on a send that never happened.
  if (isQuietHour(now)) return 0;

  const { data, error } = await db().rpc("reengagement_candidates", {
    p_inactive_days: INACTIVE_DAYS,
    p_gap_days: REENGAGE_GAP_DAYS,
    p_limit: REENGAGE_BATCH,
  });

  if (error) throw dbError(error);

  const candidates = ((data ?? []) as ReengageCandidate[]).filter(
    // No co-member to name means no honest version of this notification exists.
    (row) => !!row.member_name
  );

  let sent = 0;

  for (const candidate of candidates) {
    const { error: stampError } = await db()
      .from("users")
      .update({ last_reengaged_at: new Date(now).toISOString() })
      .eq("id", candidate.user_id);

    if (stampError) throw dbError(stampError);

    sent += await notify(
      "reengagement",
      [candidate.user_id],
      (target) =>
        reengagementMessage(
          target.token,
          candidate.event_id,
          candidate.member_name!,
          Number(candidate.other_count),
          candidate.event_title,
          target.language
        ),
      now
    );
  }

  return sent;
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
  column:
    | "start_reminder_sent_at"
    | "feedback_reminder_sent_at"
    | "reputation_settled_at"
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
