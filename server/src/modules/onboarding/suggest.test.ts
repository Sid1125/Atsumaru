import assert from "node:assert/strict";
import { test } from "node:test";

import { handleVariants, sanitizeBase } from "./suggest.js";

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

test("sanitizeBase lowercases and strips disallowed characters", () => {
  assert.equal(sanitizeBase("Driving Games!"), "drivinggames");
  assert.equal(sanitizeBase("  Trail-Brew "), "trailbrew");
  assert.equal(sanitizeBase("___"), "");
  assert.equal(sanitizeBase("日本語"), "");
});

test("handleVariants returns valid distinct alphanumeric-suffixed handles", () => {
  const variants = handleVariants("drivinggames");
  assert.ok(variants.length > 0);
  assert.ok(variants.length <= 4);
  for (const variant of variants) {
    assert.match(variant, HANDLE_RE);
    assert.ok(variant.startsWith("drivinggames_"));
    assert.ok(variant.length > "drivinggames_".length);
  }
  assert.equal(Array.from(new Set(variants)).length, variants.length, "no duplicate variants");
});

test("handleVariants yields nothing for an unusable base", () => {
  assert.deepEqual(handleVariants("___"), []);
  assert.deepEqual(handleVariants("日本語"), []);
});

test("an over-long base is trimmed so the suffix keeps it under 20 chars", () => {
  const long = "a".repeat(30);
  const variants = handleVariants(long);
  assert.ok(variants.length > 0);
  for (const variant of variants) {
    assert.ok(variant.length <= 20);
    assert.match(variant, HANDLE_RE);
  }
});
