import assert from "node:assert/strict";
import { test } from "node:test";

import type { Request } from "express";

import { pageParams, uuidParam } from "./request.js";
import { HttpError } from "./response.js";

test("page params default and clamp", () => {
  assert.deepEqual(pageParams({}), { page: 1, limit: 30 });
  assert.deepEqual(pageParams({ page: "3", limit: "10" }), { page: 3, limit: 10 });
  assert.deepEqual(pageParams({ page: "0", limit: "999" }), { page: 1, limit: 100 });
  assert.deepEqual(pageParams({ page: "abc", limit: "-5" }), { page: 1, limit: 1 });
});

const asRequest = (params: Record<string, string>) =>
  ({ params }) as unknown as Request;

test("a malformed path id is a 400, not a database error", () => {
  const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

  assert.equal(uuidParam(asRequest({ id }), "id"), id);
  // Postgres accepts either case, so neither should be turned away here.
  assert.equal(uuidParam(asRequest({ id: id.toUpperCase() }), "id"), id.toUpperCase());

  for (const bad of ["not-a-uuid", "", "3f2504e0-4f89-41d3-9a0c", `${id}0`]) {
    assert.throws(
      () => uuidParam(asRequest({ id: bad }), "id"),
      (error: unknown) =>
        error instanceof HttpError &&
        error.status === 400 &&
        error.code === "INVALID_ID",
      `expected "${bad}" to be rejected`
    );
  }
});
