import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyReputation,
  centroid,
  cosineSimilarity,
  groupBalance,
  matchScore,
  normalizeReputation,
  pairwiseFit,
  ratingDelta,
  tagFit,
  tagSimilarity,
  updatePreferenceVector,
} from "./score.js";

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
    userTags: ["hiking"],
    memberVectors: [[1, 0], [1, 0]],
    memberTags: [["hiking"], ["hiking"]],
    currentSize: 5,
    maxSize: 6,
    reputation: 100,
  });
  assert.equal(Math.round(perfect * 1000) / 1000, 1);

  const worst = matchScore({
    userVector: [1, 0],
    userTags: ["hiking"],
    memberVectors: [[0, 1], [0, 1]],
    memberTags: [["ramen"], ["ramen"]],
    currentSize: 6,
    maxSize: 6,
    reputation: 0,
  });
  assert.equal(worst, 0);
});

test("pairwise fit is the mean over members, so an outlier drags it down", () => {
  assert.equal(pairwiseFit([1, 0], [[1, 0], [1, 0]]), 1);
  assert.equal(pairwiseFit([1, 0], [[1, 0], [0, 1]]), 0.5);
  // Opposite members are clamped to 0 for the mean, never negative.
  assert.equal(pairwiseFit([1, 0], [[0, 1]]), 0);
  // No user vector, or no usable member vectors, means no signal.
  assert.equal(pairwiseFit(null, [[1, 0]]), 0);
  assert.equal(pairwiseFit([1, 0], [null, null]), 0);
});

test("tag similarity is set-overlap over normalized tags", () => {
  assert.equal(tagSimilarity(["Hiking", "Coffee"], ["hiking", "coffee"]), 1);
  assert.equal(tagSimilarity(["a", "b"], ["a", "c"]), 1 / 2);
  assert.equal(tagSimilarity(["a"], ["b"]), 0);
  assert.equal(tagSimilarity([], ["a"]), 0);
});

test("tag fit is the mean pairwise tag similarity", () => {
  assert.equal(tagFit(["a", "b"], [["a", "b"]]), 1);
  assert.equal(tagFit(["a", "b"], [["a", "c"]]), 0.5);
  assert.equal(tagFit([], [["hiking"]]), 0);
  assert.equal(tagFit(["hiking"], [[]]), 0);
});

test("cold-start (no vectors) match score beats the old 0.40 ceiling", () => {
  const coldStart = matchScore({
    userVector: null,
    userTags: ["hiking", "coffee", "board games"],
    memberVectors: [null, null],
    memberTags: [["hiking", "ramen"], ["coffee", "photography"]],
    currentSize: 2,
    maxSize: 6,
    reputation: 50,
  });

  // fit = 1/sqrt(6) ≈ 0.408 (one shared tag of three against two 2-tag members),
  // so the score is 0.6*0.408 + 0.2*0.5 + 0.2*0.5 ≈ 0.44 — above the 0.40 ceiling
  // an unembedded user was hard-capped at when cosine had no fallback.
  assert.equal(Math.round(coldStart * 100) / 100, 0.44);
});

test("feedback pulls the preference vector toward liked profiles", () => {
  const updated = updatePreferenceVector([0, 0], [[1, 0]], [[0, 1]], 0.1);
  assert.deepEqual(updated, [0.1, -0.1]);
});

test("centroid averages member vectors", () => {
  assert.deepEqual(centroid([[0, 2], [2, 0]]), [1, 1]);
  assert.deepEqual(centroid([]), []);
});

test("reputation moves by rating and stays inside 0..100", () => {
  assert.equal(ratingDelta("fire"), 3);
  assert.equal(ratingDelta("meh"), -2);
  assert.equal(applyReputation(99, 3), 100);
  assert.equal(applyReputation(1, -5), 0);
  assert.equal(applyReputation(50, 2), 52);
});
