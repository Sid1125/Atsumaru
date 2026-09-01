import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";

import { verifyDeviceSignature } from "./deviceIdentity.js";

// The device never sends its private key — verify using only what it uploads (SPKI)
// and what it signs (the challenge nonce), exactly like the API route does.
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const spki = publicKey.export({ type: "spki", format: "der" }).toString("base64");
const nonce = Array.from({ length: 32 }, (_, i) => (i % 16).toString(16)).join("");

function sigOf(nonceHex: string): string {
  return sign("sha256", Buffer.from(nonceHex, "hex"), privateKey).toString("base64");
}

test("a fresh signature over the challenge bytes verifies against the uploaded SPKI", () => {
  assert.equal(verifyDeviceSignature(spki, nonce, sigOf(nonce)), true);
});

test("a signature over a different challenge is rejected", () => {
  const otherNonce = nonce.slice(0, -2) + "ff";
  assert.equal(verifyDeviceSignature(spki, nonce, sigOf(otherNonce)), false);
});

test("a random signature is rejected", () => {
  assert.equal(verifyDeviceSignature(spki, nonce, Buffer.alloc(64, 7).toString("base64")), false);
});

test("malformed SPKI or base64 never throws, just fails", () => {
  assert.equal(verifyDeviceSignature("not-base64!!", nonce, sigOf(nonce)), false);
  assert.equal(verifyDeviceSignature(spki, "zz", sigOf(nonce)), false);
  assert.equal(verifyDeviceSignature(spki, nonce, "not-base64!!"), false);
});