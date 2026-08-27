import type { Request } from "express";

/** Express 5 types params as `string | string[]`; routes here only use single values. */
export function param(req: Request, name: string): string {
  const value = req.params[name];

  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
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
