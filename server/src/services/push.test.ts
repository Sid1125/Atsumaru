import assert from "node:assert/strict";
import { test } from "node:test";

import {
  chunk,
  EXPO_PUSH_TOKEN_RE,
  feedbackMessage,
  PUSH_CHUNK_SIZE,
} from "./push.js";

test("only Expo push tokens are accepted", () => {
  assert.ok(EXPO_PUSH_TOKEN_RE.test("ExponentPushToken[abc-123_XYZ]"));
  assert.equal(EXPO_PUSH_TOKEN_RE.test("ExponentPushToken[]"), false);
  assert.equal(EXPO_PUSH_TOKEN_RE.test("not-a-token"), false);
  assert.equal(EXPO_PUSH_TOKEN_RE.test("fcm:abc"), false);
  // No trailing junk: a smuggled second token must not slip through.
  assert.equal(EXPO_PUSH_TOKEN_RE.test("ExponentPushToken[a] extra"), false);
});

test("messages are chunked to Expo's per-request limit", () => {
  const items = Array.from({ length: PUSH_CHUNK_SIZE * 2 + 5 }, (_, i) => i);
  const chunks = chunk(items);

  assert.equal(chunks.length, 3);
  assert.equal(chunks[0]!.length, PUSH_CHUNK_SIZE);
  assert.equal(chunks[2]!.length, 5);
  assert.deepEqual(chunk([]), []);
});

test("the feedback prompt is localized and carries the deep link payload", () => {
  const ja = feedbackMessage("ExponentPushToken[abc]", "event-1", "ja");

  assert.equal(ja.title, "ミートアップはどうでした？");
  assert.deepEqual(ja.data, { type: "feedback", event_id: "event-1" });

  const en = feedbackMessage("ExponentPushToken[abc]", "event-1", "en");

  assert.equal(en.title, "How was the meetup?");
});
