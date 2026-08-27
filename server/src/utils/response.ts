import type { Response } from "express";

/** { success, data } / { success, error } envelope from docs/API_STRUCTURE.md §1. */
export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function fail(
  res: Response,
  code: string,
  message: string,
  status = 400
) {
  return res.status(status).json({ success: false, error: { code, message } });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export const notImplemented = (feature: string) =>
  new HttpError(501, "NOT_IMPLEMENTED", `${feature} is not implemented yet.`);
