import assert from "node:assert/strict";
import { test } from "node:test";

import { errorHandler } from "./errorHandler.js";
import { HttpError } from "../utils/response.js";

type Json = { success: boolean; error?: { code: string; message: string } };

/** A fake Response that captures status + body without needing a server. */
function mockRes() {
  const state: { status: number; body: Json } = { status: 200, body: null as never };
  return {
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: Json) {
      state.body = body;
      return this;
    },
    get statusCode() {
      return state.status;
    },
    get body() {
      return state.body;
    },
  };
}

test("a body-parser malformed-JSON error answers 400, not 500 (§62 §43)", () => {
  // express.json() throws a SyntaxError tagged status 400 / type entity.parse.failed.
  const err = new SyntaxError("Unexpected token } in JSON at position 0") as Error & {
    status: number;
    type: string;
  };
  err.status = 400;
  err.type = "entity.parse.failed";

  const res = mockRes() as never;
  errorHandler(err, null as never, res as never, null as never);

  const out = (res as ReturnType<typeof mockRes>).body;
  assert.equal((res as ReturnType<typeof mockRes>).statusCode, 400);
  assert.equal(out.error?.code, "INVALID_JSON");
});

test("an HttpError keeps its mapped status and code", () => {
  const res = mockRes() as never;
  errorHandler(new HttpError(403, "NOT_A_MEMBER", "nope"), null as never, res as never, null as never);
  assert.equal((res as ReturnType<typeof mockRes>).statusCode, 403);
  assert.equal((res as ReturnType<typeof mockRes>).body.error?.code, "NOT_A_MEMBER");
});

test("an unknown error degrades to a generic 500 and never leaks the message", () => {
  const res = mockRes() as never;
  errorHandler(
    new Error("secret internal detail"),
    null as never,
    res as never,
    null as never
  );
  assert.equal((res as ReturnType<typeof mockRes>).statusCode, 500);
  assert.equal((res as ReturnType<typeof mockRes>).body.error?.code, "INTERNAL_ERROR");
  assert.notEqual((res as ReturnType<typeof mockRes>).body.error?.message, "secret internal detail");
});
