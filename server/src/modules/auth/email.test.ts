import assert from "node:assert/strict";
import { test } from "node:test";

import { emailSchema, passwordSchema } from "./email.js";

test("password policy rejects weak passwords (docs/TRD.md)", () => {
  const rejects = [
    "Short1!",
    "alllowercase1",
    "ALLUPPERCASE1",
    "NoDigitsHere!",
    "Aa1",
    "          ",
  ];
  for (const value of rejects) {
    assert.equal(
      passwordSchema.safeParse(value).success,
      false,
      `should reject: ${JSON.stringify(value)}`
    );
  }
});

test("password policy accepts a strong password", () => {
  assert.equal(passwordSchema.safeParse("Str0ng-Pass!").success, true);
});

test("emailSchema rejects malformed addresses", () => {
  assert.equal(emailSchema.safeParse("not-an-email").success, false);
  assert.equal(emailSchema.safeParse("a@b").success, false);
  assert.equal(emailSchema.safeParse("user@example.com").success, true);
});
