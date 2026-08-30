import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_RECAP_CHARS,
  MAX_RECAP_TRAITS,
  recapPrompt,
  sanitizeRecap,
  templateRecap,
  traitsFromRatings,
  type RatedMember,
} from "./vibe.js";

const hiker: RatedMember = {
  rating: "fire",
  traits: ["Hiking", "coffee", "chill"],
};

test("weights sum across members, so a shared trait outranks a solo one", () => {
  const summary = traitsFromRatings([
    { rating: "good", traits: ["hiking"] },
    { rating: "good", traits: ["hiking"] },
    { rating: "fire", traits: ["art"] },
  ]);

  // hiking = 1 + 1 = 2, art = 2, and "art" wins the tie alphabetically.
  assert.deepEqual(summary.liked, ["art", "hiking"]);
});

test("traits are normalised, and a repeat on one member counts once", () => {
  const summary = traitsFromRatings([
    { rating: "good", traits: [" Coffee ", "coffee", "COFFEE"] },
  ]);

  assert.deepEqual(summary.liked, ["coffee"]);
});

test("a single good still names the trait — weight 1 clears the MIN threshold", () => {
  const summary = traitsFromRatings([{ rating: "good", traits: ["ramen"] }]);

  assert.deepEqual(summary.liked, ["ramen"]);
  assert.deepEqual(summary.cooled, []);
});

test("meh pushes a trait into cooled rather than liked", () => {
  const summary = traitsFromRatings([
    { rating: "meh", traits: ["karaoke"] },
    { rating: "fire", traits: ["hiking"] },
  ]);

  assert.deepEqual(summary.liked, ["hiking"]);
  assert.deepEqual(summary.cooled, ["karaoke"]);
});

test("a trait both liked and disliked cancels out of both buckets", () => {
  const summary = traitsFromRatings([
    { rating: "good", traits: ["ramen"] },
    { rating: "meh", traits: ["ramen"] },
  ]);

  // Weight 0: not strong enough to name, not negative enough to cool.
  assert.deepEqual(summary.liked, []);
  assert.deepEqual(summary.cooled, []);
});

test("no more than MAX_RECAP_TRAITS are named", () => {
  const summary = traitsFromRatings([
    { rating: "fire", traits: ["a", "b", "c", "d", "e", "f"] },
  ]);

  assert.equal(summary.liked.length, MAX_RECAP_TRAITS);
});

test("ordering is weight-then-alphabetical, never member order", () => {
  const forward = traitsFromRatings([
    { rating: "fire", traits: ["zebra"] },
    { rating: "fire", traits: ["apple"] },
  ]);
  const reversed = traitsFromRatings([
    { rating: "fire", traits: ["apple"] },
    { rating: "fire", traits: ["zebra"] },
  ]);

  // Equal weights must not let join order hint at who was rated (docs/RULES.md §8).
  assert.deepEqual(forward.liked, reversed.liked);
  assert.deepEqual(forward.liked, ["apple", "zebra"]);
});

test("the template names one trait plainly and joins several", () => {
  const one = templateRecap("en", traitsFromRatings([{ rating: "fire", traits: ["hiking"] }]));
  assert.equal(one, "You clicked with people who love hiking.");

  // "a, b and c" — not "a and b and c", which one shared separator produced.
  const three = templateRecap(
    "en",
    traitsFromRatings([{ rating: "fire", traits: ["apple", "banana", "cherry"] }])
  );
  assert.equal(
    three,
    "You clicked with people who love apple, banana and cherry."
  );

  const two = templateRecap("en", traitsFromRatings([hiker]));
  assert.match(two, /^You clicked with people who love .+ and .+\.$/);
});

test("the template answers in the member's own language", () => {
  const summary = traitsFromRatings([{ rating: "fire", traits: ["ramen"] }]);

  assert.match(templateRecap("ja", summary), /ramen.*好き/);
  assert.match(templateRecap("zh", summary), /喜欢ramen/);

  // An unknown language must not produce an empty card.
  assert.equal(
    templateRecap("de" as never, summary),
    templateRecap("en", summary)
  );
});

test("rating nobody, or nothing positive, still yields a sentence", () => {
  const none = templateRecap("en", traitsFromRatings([]));
  const negative = templateRecap(
    "en",
    traitsFromRatings([{ rating: "meh", traits: ["karaoke"] }])
  );

  assert.ok(none.length > 0);
  assert.ok(negative.length > 0);
  // "meh" must not surface as a claim about the people rated.
  assert.doesNotMatch(negative, /karaoke/);
});

test("the prompt cannot carry an identity", () => {
  const summary = traitsFromRatings([hiker]);
  const prompt = recapPrompt("en", "outdoor", summary);

  assert.deepEqual(Object.keys(prompt).sort(), [
    "category",
    "cooled",
    "language",
    "liked",
    "ratedCount",
  ]);

  // Serialised, because that is how it reaches Groq — no id may survive the round trip.
  const wire = JSON.stringify(prompt);
  assert.doesNotMatch(wire, /handle|user_id|display_name|@/);
});

test("sanitizeRecap collapses whitespace and keeps the sentence", () => {
  assert.equal(
    sanitizeRecap("  You clicked with\npeople who love hiking.  "),
    "You clicked with people who love hiking."
  );
});

test("sanitizeRecap rejects a hallucinated handle", () => {
  assert.equal(sanitizeRecap("You and @harucafe both love coffee."), null);
});

test("sanitizeRecap rejects a banned term regardless of case", () => {
  assert.equal(sanitizeRecap("Haru loved the coffee too.", ["haru"]), null);

  // Too short to match safely — a 2-letter handle would false-positive constantly.
  assert.equal(
    sanitizeRecap("You clicked with people who love art.", ["yu"]),
    "You clicked with people who love art."
  );
});

test("sanitizeRecap rejects empty and over-long output", () => {
  assert.equal(sanitizeRecap("   "), null);
  assert.equal(sanitizeRecap("x".repeat(MAX_RECAP_CHARS + 1)), null);
  assert.equal(
    sanitizeRecap("x".repeat(MAX_RECAP_CHARS)),
    "x".repeat(MAX_RECAP_CHARS)
  );
});
