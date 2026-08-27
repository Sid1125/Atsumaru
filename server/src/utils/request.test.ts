import assert from "node:assert/strict";
import { test } from "node:test";

import { pageParams } from "./request.ts";

test("page params default and clamp", () => {
  assert.deepEqual(pageParams({}), { page: 1, limit: 30 });
  assert.deepEqual(pageParams({ page: "3", limit: "10" }), { page: 3, limit: 10 });
  assert.deepEqual(pageParams({ page: "0", limit: "999" }), { page: 1, limit: 100 });
  assert.deepEqual(pageParams({ page: "abc", limit: "-5" }), { page: 1, limit: 1 });
});
