import assert from "node:assert/strict";
import { test } from "node:test";

import { BloomFilter } from "./bloom.js";

test("a fresh bloom says everything is absent", () => {
  const bloom = new BloomFilter();
  assert.equal(bloom.maybePresent("anything"), false);
});

test("an added value is reported as may-be-present", () => {
  const bloom = new BloomFilter();
  bloom.add("trailbrew");
  assert.equal(bloom.maybePresent("trailbrew"), true);
});

test("distinct values collide rarely; one present does not claim a far-away absent one", () => {
  const bloom = new BloomFilter();
  for (const h of ["trailbrew", "ramenkenji", "harucafe", "yokohama", "kisee"]) {
    bloom.add(h);
  }
  assert.equal(bloom.maybePresent("trailbrew"), true);
  assert.equal(bloom.maybePresent("ramenkenji"), true);
  // An unrelated handle is, with overwhelming probability, not claimed by five inserts.
  assert.equal(bloom.maybePresent("nobody-uses-this-handle-at-all"), false);
});

test("under heavy collision a filter leans 'maybe' (true), never 'absent' for a saturated cell", () => {
  // m=64 is deliberately tiny to saturate it. Saturating must not produce false
  // "absent" answers for any value — that would let a live handle slip through as
  // available. Callers treat `true` as "maybe" and fall through to the DB confirm.
  const bloom = new BloomFilter(64, 2);
  for (let i = 0; i < 60; i++) bloom.add(`user${i}`);
  assert.equal(bloom.maybePresent("user0"), true);
  assert.equal(bloom.maybePresent("user42"), true);
  // With the whole bit space set, an arbitrary value is also 'maybe' (not 'absent').
  assert.equal(bloom.maybePresent("anything-before-db-check"), true);
});
