import assert from "node:assert/strict";
import { test } from "node:test";

import { parseVector, serializeVector } from "./vector.ts";

test("parseVector accepts arrays and pgvector strings", () => {
  assert.deepEqual(parseVector([0.1, 0.2]), [0.1, 0.2]);
  assert.deepEqual(parseVector("[0.1,0.2]"), [0.1, 0.2]);
});

test("parseVector rejects anything that is not a numeric vector", () => {
  assert.equal(parseVector(null), null);
  assert.equal(parseVector("not json"), null);
  assert.equal(parseVector("[]"), null);
  assert.equal(parseVector('["a",1]'), null);
  assert.equal(parseVector([1, null]), null);
});

test("serializeVector round-trips", () => {
  assert.deepEqual(parseVector(serializeVector([1, 2, 3])), [1, 2, 3]);
});
