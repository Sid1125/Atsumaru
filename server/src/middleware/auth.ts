import type { NextFunction, Request, Response } from "express";

import { supabase } from "../db/supabase.js";
import { isUuid } from "../utils/request.js";
import { HttpError } from "../utils/response.js";

export interface AuthedRequest extends Request {
  userId?: string;
}

/** Verifies the Supabase access token on every protected route. */
export async function requireAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "UNAUTHORIZED", "Missing bearer token."));
  }

  const token = header.slice("Bearer ".length);
  const client = supabase();

  if (!client) {
    return next(
      new HttpError(503, "AUTH_UNAVAILABLE", "Supabase is not configured.")
    );
  }

  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    return next(new HttpError(401, "UNAUTHORIZED", "Invalid or expired token."));
  }

  // GoTrue only ever issues uuid subjects, so this is belt and braces — but `userId` is
  // interpolated into a PostgREST `.or()` filter in connections/routes.ts, which takes a
  // raw filter string rather than a bound parameter. Asserting the shape here means no
  // route has to trust it, and a change upstream cannot turn that into an injection point.
  if (!isUuid(data.user.id)) {
    return next(new HttpError(401, "UNAUTHORIZED", "Malformed token subject."));
  }

  req.userId = data.user.id;
  return next();
}

/** Verifies a socket handshake token; returns the user id. */
export async function verifySocketToken(token?: string): Promise<string> {
  const client = supabase();

  if (!token || !client) throw new Error("unauthorized");

  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) throw new Error("unauthorized");
  if (!isUuid(data.user.id)) throw new Error("unauthorized");

  return data.user.id;
}
