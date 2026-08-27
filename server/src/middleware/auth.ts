import type { NextFunction, Request, Response } from "express";

import { supabase } from "../db/supabase.js";
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

  req.userId = data.user.id;
  return next();
}

/** Verifies a socket handshake token; returns the user id. */
export async function verifySocketToken(token?: string): Promise<string> {
  const client = supabase();

  if (!token || !client) throw new Error("unauthorized");

  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) throw new Error("unauthorized");

  return data.user.id;
}
