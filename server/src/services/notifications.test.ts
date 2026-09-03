import assert from "node:assert/strict";
import { test } from "node:test";

import { isQuietHour, policyFor } from "./notifications.js";
import {
  deepLink,
  dmChatMessage,
  groupChatMessage,
  meetupSoonMessage,
  nearbyMessage,
  reengagementMessage,
} from "./push.js";
import { LANGUAGES } from "../types.js";

const TOKEN = "ExponentPushToken[abc123]";

/** JST is UTC+9, so 22:00 JST is 13:00 UTC. */
const jst = (hour: number, minute = 0) =>
  Date.UTC(2026, 8, 3, hour - 9, minute);

test("quiet hours run 22:00–08:00 JST and wrap midnight", () => {
  assert.equal(isQuietHour(jst(21, 59)), false);
  assert.equal(isQuietHour(jst(22)), true);
  assert.equal(isQuietHour(jst(23, 30)), true);
  // Past midnight JST — the wrap is where an OR/AND slip would show up.
  assert.equal(isQuietHour(jst(24)), true);
  assert.equal(isQuietHour(jst(24 + 3)), true);
  assert.equal(isQuietHour(jst(24 + 7, 59)), true);
  assert.equal(isQuietHour(jst(24 + 8)), false);
  assert.equal(isQuietHour(jst(12)), false);
});

test("only the notifications nobody asked for wait for morning", () => {
  // A consequence of something the member did: send it. `feedback` and `meetup_soon` are
  // both tied to a meetup they joined, and a reminder held until morning can arrive after
  // the thing it was reminding about.
  assert.equal(policyFor("feedback").quietHours, false);
  assert.equal(policyFor("meetup_soon").quietHours, false);
  // A real message, like any messaging app.
  assert.equal(policyFor("chat").quietHours, false);

  // The two the member never asked for.
  assert.equal(policyFor("nearby").quietHours, true);
  assert.equal(policyFor("reengagement").quietHours, true);
});

test("the unsolicited types carry a daily ceiling, and the bounded ones do not", () => {
  // meetup_soon cannot repeat: it is gated by a per-event stamp, so a quota would be dead
  // configuration. feedback is the same, once per event.
  assert.equal(policyFor("meetup_soon").quota, undefined);
  assert.equal(policyFor("feedback").quota, undefined);

  assert.equal(policyFor("nearby").quota?.resource, "notif_nearby");
  assert.equal(policyFor("reengagement").quota?.resource, "notif_reengagement");
  assert.equal(policyFor("chat").quota?.resource, "notif_chat");

  // Re-engagement is the most intrusive, so it is the tightest.
  assert.ok(
    policyFor("reengagement").quota!.perDay <= policyFor("nearby").quota!.perDay
  );
  assert.ok(policyFor("nearby").quota!.perDay < policyFor("chat").quota!.perDay);
});

test("every notification type carries a deep link the app can route", () => {
  // A payload without a url lands in the tray and opens wherever the user last was, which
  // is the defect this whole surface exists to avoid.
  const messages = [
    meetupSoonMessage(TOKEN, "e1", "Ramen night", "en"),
    groupChatMessage(TOKEN, "e1", "Ramen night", "Yuki", "hello", 1, "en"),
    dmChatMessage(TOKEN, "c1", "Yuki", "hello", 1, "en"),
    nearbyMessage(TOKEN, "e1", "Ramen night", "Nonbei Yokocho", "en"),
    reengagementMessage(TOKEN, "e1", "Yuki", 3, "Ramen night", "en"),
  ];

  for (const message of messages) {
    assert.ok(message.url, `${message.data?.type} has no url`);
    assert.ok(message.url!.startsWith("atsumaru://"));
    assert.ok(message.title.length > 0);
    assert.ok(message.body.length > 0);
  }
});

test("deep links match the paths declared in the app's linking config", () => {
  assert.equal(deepLink.meetup("e1"), "atsumaru://meetup/e1");
  assert.equal(deepLink.dm("c1"), "atsumaru://dm/c1");
  assert.equal(deepLink.discover(), "atsumaru://discover");

  // Group chat has no route of its own; it lives inside the meetup screen.
  assert.equal(
    groupChatMessage(TOKEN, "e1", "t", "Yuki", "hi", 1, "en").url,
    deepLink.meetup("e1")
  );
});

test("every type has copy in all three languages (docs/RULES.md §12)", () => {
  for (const language of LANGUAGES) {
    const built = [
      meetupSoonMessage(TOKEN, "e1", "Ramen night", language),
      groupChatMessage(TOKEN, "e1", "Ramen night", "Yuki", "hello", 2, language),
      dmChatMessage(TOKEN, "c1", "Yuki", "hello", 2, language),
      nearbyMessage(TOKEN, "e1", "Ramen night", "Nonbei Yokocho", language),
      reengagementMessage(TOKEN, "e1", "Yuki", 3, "Ramen night", language),
    ];

    for (const message of built) {
      assert.ok(message.title.length > 0, `${language} title missing`);
      assert.ok(message.body.length > 0, `${language} body missing`);
    }
  }

  // Not merely present — actually translated, so a missing entry cannot hide behind the
  // English fallback.
  assert.notEqual(
    meetupSoonMessage(TOKEN, "e1", "x", "ja").title,
    meetupSoonMessage(TOKEN, "e1", "x", "en").title
  );
  assert.notEqual(
    nearbyMessage(TOKEN, "e1", "x", "y", "zh").title,
    nearbyMessage(TOKEN, "e1", "x", "y", "en").title
  );
});

test("the re-engagement line states only what is known", () => {
  const withOthers = reengagementMessage(TOKEN, "e1", "riya", 3, "Coffee", "en");

  assert.equal(withOthers.body, "riya and 3 others are in Coffee");

  // Nobody is waiting, missing anyone, or asking after them — none of that is knowable.
  for (const claim of ["waiting", "misses", "asked about you", "wants to see"]) {
    assert.ok(!withOthers.body.toLowerCase().includes(claim));
  }

  // A lone co-member must not read "and 0 others".
  const alone = reengagementMessage(TOKEN, "e1", "riya", 0, "Coffee", "en");

  assert.equal(alone.body, "riya is in Coffee");
  assert.ok(!alone.body.includes("0"));
});

test("long titles and previews are truncated rather than trailing off", () => {
  const long = "x".repeat(300);
  const message = groupChatMessage(TOKEN, "e1", long, "Yuki", long, 1, "en");

  assert.ok(message.title.length < 80);
  assert.ok(message.body.length < 160);
  assert.ok(message.title.includes("…"));
});
