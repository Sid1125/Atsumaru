import assert from "node:assert/strict";
import { test } from "node:test";

import { claimSession, isEmailTaken, stashSession, type AuthSession } from "./session.js";

const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);

const session: AuthSession = {
  access_token: "access",
  refresh_token: "refresh",
  user: null,
  is_new: true,
};

test("a handoff code works once", () => {
  const code = stashSession(session, NOW);

  assert.equal(claimSession(code, NOW)?.access_token, "access");
  // Replaying the code must not hand out the tokens again.
  assert.equal(claimSession(code, NOW), null);
});

test("a handoff code expires after a minute", () => {
  const code = stashSession(session, NOW);

  assert.equal(claimSession(code, NOW + 61_000), null);
});

test("an unknown code is rejected", () => {
  assert.equal(claimSession("made-up", NOW), null);
});

test("a taken address is recognised so a second provider links instead of twinning", () => {
  assert.ok(isEmailTaken({ code: "email_exists" }));
  assert.ok(
    isEmailTaken({
      message: "A user with this email address has already been registered",
    })
  );

  // Anything else must keep bubbling up as a provider error rather than silently
  // adopting an account.
  assert.equal(isEmailTaken({ code: "weak_password", message: "Password too short" }), false);
  assert.equal(isEmailTaken({}), false);
});
