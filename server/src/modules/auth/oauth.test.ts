import assert from "node:assert/strict";
import { test } from "node:test";

import {
  emailForIdentity,
  isProvider,
  isSyntheticEmail,
  signState,
  verifyState,
  type Identity,
} from "./oauth.js";

const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);

test("state round-trips with its provider, nonce and app flag", () => {
  const { state, nonce } = signState("line", true, NOW);
  const payload = verifyState(state, NOW);

  assert.equal(payload?.provider, "line");
  assert.equal(payload?.nonce, nonce);
  assert.equal(payload?.app, true);
});

test("state defaults the app flag to false", () => {
  const { state } = signState("google", false, NOW);

  assert.equal(verifyState(state, NOW)?.app, false);
});

test("state is rejected once tampered with or expired", () => {
  const { state } = signState("google", false, NOW);
  const [body, signature] = state.split(".");

  // A different payload under the same signature must not verify.
  const forged = `${Buffer.from(
    JSON.stringify({ provider: "line", nonce: "x", exp: 9e9, app: true })
  ).toString("base64url")}.${signature}`;

  assert.equal(verifyState(forged, NOW), null);
  assert.equal(verifyState(`${body}.deadbeef`, NOW), null);
  assert.equal(verifyState("nonsense", NOW), null);
  assert.equal(verifyState(state, NOW + 601_000), null);
});

test("only LINE and Google are providers", () => {
  assert.ok(isProvider("line"));
  assert.ok(isProvider("google"));
  assert.equal(isProvider("callback"), false);
  assert.equal(isProvider("facebook"), false);
});

test("identities without an email get an internal synthetic one", () => {
  const base: Identity = {
    provider: "line",
    sub: "U123",
    email: null,
    name: null,
    picture: null,
  };

  const synthetic = emailForIdentity(base);

  assert.equal(synthetic, "line_U123@oauth.atsumaru.invalid");
  assert.ok(isSyntheticEmail(synthetic));

  const real = emailForIdentity({ ...base, email: "yuki@example.com" });

  assert.equal(real, "yuki@example.com");
  assert.equal(isSyntheticEmail(real), false);
});
