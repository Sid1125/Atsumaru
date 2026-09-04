import assert from "node:assert/strict";
import { test } from "node:test";

import { memoryStore } from "../../services/ephemeral.js";
import { claimSession, isEmailTaken, stashSession, type AuthSession } from "./session.js";

const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);

const session: AuthSession = {
  access_token: "access",
  refresh_token: "refresh",
  user: null,
  is_new: true,
};

test("a handoff code works once and carries its origin", async () => {
  const store = memoryStore(() => NOW);
  const code = await stashSession(session, "email", store);

  const claimed = await claimSession(code, store);

  assert.equal(claimed?.origin, "email");
  assert.equal(claimed?.session.access_token, "access");
  // Replaying the code must not hand out the tokens again.
  assert.equal(await claimSession(code, store), null);
});

test("an OAuth stash is tagged oauth by default", async () => {
  const store = memoryStore(() => NOW);
  const code = await stashSession(session, "oauth", store);

  assert.equal((await claimSession(code, store))?.origin, "oauth");
});

test("a handoff code expires after a minute", async () => {
  let now = NOW;
  const store = memoryStore(() => now);
  const code = await stashSession(session, "oauth", store);

  now = NOW + 61_000;

  assert.equal(await claimSession(code, store), null);
});

test("an unknown code is rejected", async () => {
  assert.equal(await claimSession("made-up", memoryStore(() => NOW)), null);
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
