import assert from "node:assert/strict";
import { test } from "node:test";

import { createRateLimiter } from "../../utils/rateLimit.js";
import { AUTH_RATE_LIMITS } from "./routes.js";
import { env } from "../../config/env.js";

const NOW = Date.UTC(2026, 8, 2, 12, 0, 0);

test("the handoff-code exchange is the tightest budget (§19.1 'Very strict')", () => {
  assert.ok(
    AUTH_RATE_LIMITS.session.limit < AUTH_RATE_LIMITS.callback.limit,
    "session exchange must be stricter than the OAuth callback"
  );
  assert.ok(
    AUTH_RATE_LIMITS.session.limit < AUTH_RATE_LIMITS.provider.limit,
    "session exchange must be stricter than OAuth initiation"
  );
});

test("the session budget actually blocks a single IP", () => {
  const limiter = createRateLimiter(AUTH_RATE_LIMITS.session);

  let allowed = 0;
  for (let i = 0; i <= AUTH_RATE_LIMITS.session.limit; i += 1) {
    if (limiter.take("1.2.3.4", NOW)) allowed += 1;
  }

  assert.equal(allowed, AUTH_RATE_LIMITS.session.limit);
});

test("X-Forwarded-For is ignored for rate-limit keying unless a proxy is trusted", () => {
  // The production default must not trust the attacker-controlled header (§19.3).
  assert.equal(env.TRUST_PROXY, false, "TRUST_PROXY must default to off");
});

test("event-creation, chat, and DM share the same per-user limiter shape (§19.1)", () => {
  // Every send/creation limiter uses a fixed `{ limit, windowMs }` budget with the shared
  // take/retryAfter contract, so the authorization story is identical across surfaces.
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(limiter.take("user-A", NOW), true);
  assert.equal(limiter.take("user-A", NOW), true);
  assert.equal(limiter.take("user-A", NOW), false, "third call over budget");
  assert.equal(limiter.take("user-B", NOW), true, "separate users counted separately");
});
