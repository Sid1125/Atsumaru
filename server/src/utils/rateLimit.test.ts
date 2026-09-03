import assert from "node:assert/strict";
import { test } from "node:test";

import { createRateLimiter } from "./rateLimit.js";

const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);

test("a caller is limited inside the window and freed after it", () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });

  assert.equal(limiter.take("user", NOW), true);
  assert.equal(limiter.take("user", NOW), true);
  assert.equal(limiter.take("user", NOW), false);
  assert.equal(limiter.retryAfter("user", NOW), 1);

  assert.equal(limiter.take("user", NOW + 1000), true);
  assert.equal(limiter.retryAfter("other", NOW), 0);
});

test("callers are counted separately and expired counters are pruned", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });

  assert.equal(limiter.take("a", NOW), true);
  assert.equal(limiter.take("b", NOW), true);
  assert.equal(limiter.take("a", NOW), false);

  limiter.prune(NOW + 2000);

  assert.equal(limiter.take("a", NOW + 2000), true);
});

test("the counter map does not grow once its callers' windows have passed", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });

  // Well past the internal prune threshold, so `take` has to be the thing that clears
  // them: nothing else ever calls prune in the running server.
  for (let i = 0; i < 2000; i += 1) {
    limiter.take(`caller-${i}`, NOW);
  }

  assert.equal(limiter.size() > 0, true);

  // Every window above has expired by now, so the next call should walk them out.
  limiter.take("late", NOW + 5000);

  assert.equal(limiter.size(), 1);
});
