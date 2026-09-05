import assert from "node:assert/strict";
import { test } from "node:test";

import { containsBlockedTerm } from "./moderation.js";

test("blocks the term that actually reached production", () => {
  // The observed live rows (TRACKER §5j): a display name and two event titles.
  assert.equal(containsBlockedTerm("Nigga"), true);
  assert.equal(containsBlockedTerm("Nigga's Hideout"), true);
  assert.equal(containsBlockedTerm("Official nigga"), true);
});

test("folds case, separators and homoglyph substitutions", () => {
  assert.equal(containsBlockedTerm("N I G G A"), true);
  assert.equal(containsBlockedTerm("n-i-g-g-a"), true);
  assert.equal(containsBlockedTerm("n1gg4"), true);
  assert.equal(containsBlockedTerm("NÌGGA"), true);
});

test("leaves ordinary names alone", () => {
  // Guarding against false positives is the whole reason the list is short.
  for (const name of [
    "Yuki",
    "Kenji",
    "Ramen & Retro Games",
    "Shibuya Café Crawl",
    "Morning Hike & Coffee",
    "集まる",
    "trailbrew",
    "Board Game Night",
  ]) {
    assert.equal(containsBlockedTerm(name), false, name);
  }
});
