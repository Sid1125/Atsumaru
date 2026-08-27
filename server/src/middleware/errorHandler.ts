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

  if (env.NODE_ENV !== "test") {
    console.error("Unhandled error:", error);
  }

  return fail(res, "INTERNAL_ERROR", "Something went wrong.", 500);
}

/** Wraps async handlers so rejections reach errorHandler instead of hanging. */
export function asyncRoute<T extends Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as T, res, next).catch(next);
  };
}
