import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  callbackWithState,
  claimVerifier,
  emailForIdentity,
  isProvider,
  isSyntheticEmail,
  pkcePair,
  signState,
  stashVerifier,
  supabaseAuthorizeUrl,
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

test("the PKCE challenge is the SHA-256 digest of the verifier, and only the digest travels", () => {
  const { verifier, challenge } = pkcePair();

  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
  assert.notEqual(verifier, challenge);

  const url = new URL(supabaseAuthorizeUrl("google", "http://host/cb", challenge));

  assert.equal(url.pathname, "/auth/v1/authorize");
  assert.equal(url.searchParams.get("provider"), "google");
  assert.equal(url.searchParams.get("code_challenge"), challenge);
  assert.equal(url.searchParams.get("code_challenge_method"), "s256");
  assert.equal(url.searchParams.get("redirect_to"), "http://host/cb");
  assert.equal(url.toString().includes(verifier), false);
});

test("the callback carries the signed state, so Supabase can hand it back", () => {
  const { state } = signState("google", true, NOW);
  const url = new URL(callbackWithState(state));

  assert.equal(url.searchParams.get("st"), state);
  assert.equal(verifyState(url.searchParams.get("st")!, NOW)?.provider, "google");
});

test("a stashed verifier is returned once, then never again", () => {
  const { state } = signState("google", true, NOW);

  stashVerifier(state, "verifier-1", NOW);

  assert.equal(claimVerifier(state, NOW), "verifier-1");
  // Replayed callback: the code cannot be redeemed a second time.
  assert.equal(claimVerifier(state, NOW), null);
});

test("a verifier expires with its state window", () => {
  const { state } = signState("google", true, NOW);

  stashVerifier(state, "verifier-2", NOW);

  assert.equal(claimVerifier(state, NOW + 601_000), null);
});
