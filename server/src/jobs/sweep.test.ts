import assert from "node:assert/strict";
import { test } from "node:test";

import {
  dueForReminder,
  dueForSettlement,
  membersMissingFeedback,
  MEETUP_DURATION_MS,
  REMINDER_DELAY_MS,
  type SweepEvent,
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
