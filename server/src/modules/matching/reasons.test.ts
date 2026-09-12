import assert from "node:assert/strict";
import { test } from "node:test";

import { matchReasons, connectionReasons } from "./reasons.js";

const base = {
  sharedInterests: ["ramen"],
  currentSize: 4,
  maxSize: 6,
  isMember: false,
  hasPreferenceVector: true,
};

test("match reasons answer in the member's language", () => {
  assert.deepEqual(matchReasons("en", base), [
    "Shared interests: ramen",
    "4/6 spots taken",
  ]);
  assert.deepEqual(matchReasons("ja", base), ["共通の興味: ramen", "6人中4人が参加"]);
  assert.equal(matchReasons("zh", base)[0], "共同兴趣：ramen");
});

test("match reasons drop empty overlap and add state hints", () => {
  const reasons = matchReasons("en", {
    ...base,
    sharedInterests: [],
    isMember: true,
    hasPreferenceVector: false,
  });

  assert.deepEqual(reasons, [
    "4/6 spots taken",
    "You are already in this group",
    "Finish onboarding for a sharper match",
  ]);
});

test("connection reasons answer in the member's language", () => {
  const withShared = connectionReasons("en", {
    sharedInterests: ["ramen", "coffee"],
    hasPreferenceVector: true,
  });
  assert.deepEqual(withShared, ["Shared interests: ramen, coffee"]);

  const noShared = connectionReasons("ja", {
    sharedInterests: [],
    hasPreferenceVector: true,
  });
  assert.deepEqual(noShared, ["相性抜群"]);

  const noVector = connectionReasons("zh", {
    sharedInterests: [],
    hasPreferenceVector: false,
  });
  assert.deepEqual(noVector, ["完成引导后匹配会更准确"]);
});
