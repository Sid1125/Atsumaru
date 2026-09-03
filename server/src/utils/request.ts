import type { Request } from "express";

import { HttpError } from "./response.js";

/** Express 5 types params as `string | string[]`; routes here only use single values. */
export function param(req: Request, name: string): string {
  const value = req.params[name];

  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/** The shape Postgres itself accepts; version and variant bits are not our business. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every id in a path goes straight into a query, and Postgres answers an unparseable
 * uuid with an error — which `dbError` correctly swallows into `500 DB_ERROR`. Nothing
 * leaked, but a malformed request is the caller's fault, so it answers 400 instead.
 */
export function uuidParam(req: Request, name: string): string {
  const value = param(req, name);

  if (!UUID_RE.test(value)) {
    throw new HttpError(400, "INVALID_ID", `${name} must be a UUID.`);
  }

  return value;
}

/** `?page&limit` for every list endpoint (docs/API_STRUCTURE.md §1). */
export function pageParams(query: Record<string, unknown>) {
  const page = Number(query.page);
  const limit = Number(query.limit);

  return {
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    limit: Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.floor(limit))) : 30,
  };
}
