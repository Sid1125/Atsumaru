import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { fail, HttpError } from "../utils/response.js";

// Errors are always reported; never swallowed silently (docs/RULES.md §14).
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof HttpError) {
    return fail(res, error.code, error.message, error.status);
  }

  // express.json() throws a body-parser SyntaxError for malformed JSON with its own 400
  // status — that is a client mistake, not a server fault, so it must not read as a 500.
  if (isBodyParserError(error)) {
    return fail(res, "INVALID_JSON", "Request body is not valid JSON.", 400);
  }

  if (env.NODE_ENV !== "test") {
    console.error("Unhandled error:", error);
  }

  return fail(res, "INTERNAL_ERROR", "Something went wrong.", 500);
}

/** Matches body-parser's `entity.parse.failed` SyntaxError (status 400). */
function isBodyParserError(error: unknown): boolean {
  if (!(error instanceof SyntaxError)) return false;
  const status = (error as { status?: unknown }).status;
  const type = (error as { type?: unknown }).type;
  return status === 400 && type === "entity.parse.failed";
}

/** Wraps async handlers so rejections reach errorHandler instead of hanging. */
export function asyncRoute<T extends Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as T, res, next).catch(next);
  };
}
