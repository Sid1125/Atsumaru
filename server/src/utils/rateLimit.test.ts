import assert from "node:assert/strict";
import { test } from "node:test";

import { memoryStore } from "../services/ephemeral.js";
import { createRateLimiter } from "./rateLimit.js";

const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);

/** Steppable clock, so a window can pass without the test sleeping through it. */
function fakeClock(start = NOW) {
  let now = start;

  return {
    store: memoryStore(() => now),
    at: (value: number) => {
      now = value;
      return now;
    },
  };
}

test("a caller is limited inside the window and freed after it", async () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000 }, "test", clock.store);

  assert.equal((await limiter.take("user", NOW)).allowed, true);
  assert.equal((await limiter.take("user", NOW)).allowed, true);

  const denied = await limiter.take("user", NOW);

  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 1);

  clock.at(NOW + 1000);

  assert.equal((await limiter.take("user", NOW + 1000)).allowed, true);
});

test("callers are counted separately", async () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000 }, "test", clock.store);

  assert.equal((await limiter.take("a", NOW)).allowed, true);
  assert.equal((await limiter.take("b", NOW)).allowed, true);
  assert.equal((await limiter.take("a", NOW)).allowed, false);
});

test("two limiters do not share a budget now that they share a store", async () => {
  const clock = fakeClock();
  const chat = createRateLimiter({ limit: 1, windowMs: 1000 }, "chat", clock.store);
  const recap = createRateLimiter({ limit: 1, windowMs: 1000 }, "recap", clock.store);

  assert.equal((await chat.take("user", NOW)).allowed, true);
  assert.equal((await chat.take("user", NOW)).allowed, false);
  // Same caller, different namespace: its own budget.
  assert.equal((await recap.take("user", NOW)).allowed, true);
});

test("the counter map does not grow once its callers' windows have passed", async () => {
  const clock = fakeClock();
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000 }, "test", clock.store);

  // Well past the store's internal prune threshold, so `bump` has to be the thing that
  // clears them: nothing else ever prunes in the running server.
  for (let i = 0; i < 2000; i += 1) {
    await limiter.take(`caller-${i}`, NOW);
  }

  assert.equal(clock.store.size!() > 0, true);

  clock.at(NOW + 5000);
  await limiter.take("late", NOW + 5000);

  assert.equal(clock.store.size!(), 1);
});
