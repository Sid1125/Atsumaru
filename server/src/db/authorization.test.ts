import assert from "node:assert/strict";
import { test } from "node:test";

import { canAccessConnection } from "./queries.js";

const alice = "alice-uuid";
const bob = "bob-uuid";
const eve = "eve-uuid";

const mutualPair = { id: "c1", user_a: alice, user_b: bob, mutual: true };

test("a participant of a mutual connection may read the DMs", () => {
  assert.equal(canAccessConnection(alice, mutualPair), true);
  assert.equal(canAccessConnection(bob, mutualPair), true);
});

test("a non-participant may never read the DMs", () => {
  assert.equal(canAccessConnection(eve, mutualPair), false);
});

test("a missing connection resolves to no access", () => {
  assert.equal(canAccessConnection(alice, null), false);
});

test("a connection that is not yet mutual stays locked to everyone", () => {
  const pending = { id: "c2", user_a: alice, user_b: bob, mutual: false };
  assert.equal(canAccessConnection(alice, pending), false);
  assert.equal(canAccessConnection(bob, pending), false);
  assert.equal(canAccessConnection(eve, pending), false);
});
