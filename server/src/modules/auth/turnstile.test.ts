import assert from "node:assert/strict";
import { test } from "node:test";

import { verifyTurnstile } from "./turnstile.js";
import { hasTurnstile } from "../../config/env.js";

test("Turnstile is skipped (passes) when no secret key is configured (§22 degrade)", async (t) => {
  // Without TURNSTILE_SECRET_KEY the auth handoff must not be blocked: hasTurnstile
  // gates enforcement, and verifyTurnstile returns true even for an empty token.
  // Skipped (not failed) when the developer's .env configures keys — this asserts the
  // unconfigured path only, and must not depend on whatever is in the ambient .env.
  if (hasTurnstile) {
    t.skip("Turnstile is configured in env; unconfigured degrade path not exercised");
    return;
  }
  assert.equal(hasTurnstile, false, "test env has no Turnstile keys");
  assert.equal(await verifyTurnstile(""), true, "unconfigured means no challenge");
});
