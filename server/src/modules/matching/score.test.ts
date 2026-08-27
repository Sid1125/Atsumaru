import assert from "node:assert/strict";
import { test } from "node:test";

import {
  centroid,
  cosineSimilarity,
  groupBalance,
  matchScore,
  normalizeReputation,
  updatePreferenceVector,
} from "./score.ts";

test("cosine similarity handles identical, orthogonal and degenerate input", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);
  assert.equal(cosineSimilarity([1, 2, 3], [1, 2]), 0);
});

test("group balance favours a nearly-full group and rejects a full one", () => {
  assert.equal(groupBalance(5, 6), 1);
  assert.equal(groupBalance(6, 6), 0);
  assert.ok(groupBalance(4, 6) < groupBalance(5, 6));
});

test("reputation is clamped into 0..1", () => {
  assert.equal(normalizeReputation(150), 1);
  assert.equal(normalizeReputation(-10), 0);
  assert.equal(normalizeReputation(50), 0.5);
});

test("match score follows the 0.6/0.2/0.2 weighting", () => {
  const perfect = matchScore({
    userVector: [1, 0],
    groupVector: [1, 0],
    currentSize: 5,
    maxSize: 6,
    reputation: 100,
  });
  assert.equal(Math.round(perfect * 1000) / 1000, 1);

  const worst = matchScore({
    userVector: [1, 0],
    groupVector: [0, 1],
    currentSize: 6,
    maxSize: 6,
    reputation: 0,
  });
  assert.equal(worst, 0);
});

test("feedback pulls the preference vector toward liked profiles", () => {
  const updated = updatePreferenceVector([0, 0], [[1, 0]], [[0, 1]], 0.1);
  assert.deepEqual(updated, [0.1, -0.1]);
});

test("centroid averages member vectors", () => {
  assert.deepEqual(centroid([[0, 2], [2, 0]]), [1, 1]);
  assert.deepEqual(centroid([]), []);
});
