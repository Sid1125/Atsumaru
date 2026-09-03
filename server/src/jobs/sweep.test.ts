import assert from "node:assert/strict";
import { test } from "node:test";

import {
  dueForReminder,
  dueForSettlement,
  dueForStartReminder,
  membersMissingFeedback,
  MEETUP_DURATION_MS,
  REMINDER_DELAY_MS,
  START_REMINDER_LEAD_MS,
  START_REMINDER_WINDOW_MS,
  type SweepEvent,
  type UpcomingEvent,
} from "./sweep.js";

const START = Date.UTC(2026, 7, 28, 10, 0, 0);

const event: SweepEvent = {
  id: "e1",
  start_time: new Date(START).toISOString(),
  feedback_reminder_sent_at: null,
  reputation_settled_at: null,
};

test("a reminder is due an hour after the start and only once", () => {
  assert.equal(dueForReminder(event, START), false);
  assert.equal(dueForReminder(event, START + REMINDER_DELAY_MS - 1), false);
  assert.equal(dueForReminder(event, START + REMINDER_DELAY_MS), true);

  const reminded = { ...event, feedback_reminder_sent_at: new Date().toISOString() };

  assert.equal(dueForReminder(reminded, START + REMINDER_DELAY_MS), false);
});

test("reputation settles after the meetup window, once", () => {
  assert.equal(dueForSettlement(event, START + REMINDER_DELAY_MS), false);
  assert.equal(dueForSettlement(event, START + MEETUP_DURATION_MS), true);

  const settled = { ...event, reputation_settled_at: new Date().toISOString() };

  assert.equal(dueForSettlement(settled, START + MEETUP_DURATION_MS), false);
});

test("ghosts are the members who submitted nothing", () => {
  assert.deepEqual(
    membersMissingFeedback(["a", "b", "c"], ["b"]),
    ["a", "c"]
  );
  assert.deepEqual(membersMissingFeedback(["a"], ["a"]), []);
  assert.deepEqual(membersMissingFeedback([], ["a"]), []);
});

const upcoming: UpcomingEvent = {
  id: "e2",
  title: "Ramen & Retro Games",
  start_time: new Date(START).toISOString(),
  start_reminder_sent_at: null,
};

test("the starting-soon nudge fires inside its window and not before", () => {
  // A day out: nothing. This is the bound that stops every future meetup matching.
  assert.equal(dueForStartReminder(upcoming, START - 24 * 60 * 60 * 1000), false);

  // One millisecond before the window opens.
  assert.equal(
    dueForStartReminder(upcoming, START - START_REMINDER_WINDOW_MS - 1),
    false
  );

  assert.equal(dueForStartReminder(upcoming, START - START_REMINDER_WINDOW_MS), true);
  assert.equal(dueForStartReminder(upcoming, START - START_REMINDER_LEAD_MS), true);
  assert.equal(dueForStartReminder(upcoming, START - 1), true);
});

test("the window is wide enough that one sweep interval cannot skip a meetup", () => {
  // The reason the window is lead + interval: a meetup seen once per interval must still
  // be caught if its 15-minute mark fell between two runs.
  assert.ok(START_REMINDER_WINDOW_MS > START_REMINDER_LEAD_MS);
});

test("a meetup already under way gets no starting-soon nudge", () => {
  // "Starting soon" would simply be false, and the member is there or has missed it.
  assert.equal(dueForStartReminder(upcoming, START), false);
  assert.equal(dueForStartReminder(upcoming, START + 60_000), false);
});

test("the starting-soon nudge is sent at most once", () => {
  const reminded: UpcomingEvent = {
    ...upcoming,
    start_reminder_sent_at: new Date(START).toISOString(),
  };

  assert.equal(dueForStartReminder(reminded, START - START_REMINDER_LEAD_MS), false);
});
