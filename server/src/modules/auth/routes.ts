import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import { createRateLimiter } from "../../utils/rateLimit.js";
import { verifyTurnstile } from "./turnstile.js";
import { db, PUBLIC_USER_COLUMNS, type PublicUser } from "../../db/queries.js";
import { env } from "../../config/env.js";
import { dbError, HttpError, ok } from "../../utils/response.js";
import { param } from "../../utils/request.js";
import {
  authorizeUrl,
  callbackWithState,
  claimVerifier,
  identityFromCode,
  isProvider,
  pkcePair,
  providerConfigured,
  signState,
  stashVerifier,
  supabaseAuthorizeUrl,
  verifyState,
} from "./oauth.js";
import {
  claimSession,
  sessionForIdentity,
  sessionFromSupabaseCode,
  stashSession,
  type AuthSession,
} from "./session.js";
import {
  completePasswordReset,
  emailSchema,
  logIn,
  passwordSchema,
  requestPasswordReset,
  signUp,
} from "./email.js";

export const authRouter = Router();

// Auth endpoints have no user context yet, so they rate-limit by IP. The handoff-code
// exchange is the tightest budget: it is an unauthenticated brute-force surface for the
// 60-second, single-use codes that mint full sessions (docs/ATSUMARU_SECURITY_COMPLETE §19.1
// marks session exchange "Very strict"). OAuth initiation and callback are looser so a
// legitimately flaky provider round-trip is not collateral damage.
export const AUTH_RATE_LIMITS = {
  session: { limit: 20, windowMs: 60 * 1000 },
  callback: { limit: 30, windowMs: 60 * 1000 },
  provider: { limit: 30, windowMs: 60 * 1000 },
} as const;

const sessionLimiter = createRateLimiter(AUTH_RATE_LIMITS.session);
const callbackLimiter = createRateLimiter(AUTH_RATE_LIMITS.callback);
const providerLimiter = createRateLimiter(AUTH_RATE_LIMITS.provider);

// Email/password surfaces (modules/auth/email.ts). signup/reset are captcha-gated and
// fail closed; login is a direct credential check, so it gets a modest per-IP budget to
// blunt password spraying (§19.1).
const signupLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });
const loginLimiter = createRateLimiter({ limit: 20, windowMs: 60 * 1000 });
const resetLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });
const resetCompleteLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });

function clientIp(req: import("express").Request): string {
  // Only trust X-Forwarded-For when a reverse proxy is actually in front; otherwise the
  // header is attacker-controlled and keying the limiter on it would let anyone rotate
  // or redirect budgets (docs/ATSUMARU_SECURITY_COMPLETE §19.3).
  if (env.TRUST_PROXY) {
    const forwarded = req.headers["x-forwarded-for"];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (first) return first.slice(0, 64);
  }
  return (req.socket.remoteAddress ?? "").slice(0, 64);
}

/** Throws 429 when the client is over budget; the caller can short-circuit before work. */
function enforceLimit(
  limiter: ReturnType<typeof createRateLimiter>,
  req: import("express").Request,
  res: import("express").Response
) {
  const key = clientIp(req);

  if (!limiter.take(key)) {
    res.setHeader("Retry-After", limiter.retryAfter(key));
    throw new HttpError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
  }
}

authRouter.get(
  "/me",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    // Unlike /users/me this may legitimately be empty: the row appears only once
    // onboarding completes, and the client uses `user: null` to route there.
    const { data, error } = await db()
      .from("users")
      .select(PUBLIC_USER_COLUMNS)
      .eq("id", req.userId!)
      .maybeSingle<PublicUser>();

    if (error) throw dbError(error);

    return ok(res, { user: data ?? null });
  })
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    // Revoke the refresh token upstream; the client also clears SecureStore.
    const token = req.headers.authorization!.slice("Bearer ".length);
    const { error } = await db().auth.admin.signOut(token);

    if (error) {
      console.warn("Sign-out could not be confirmed upstream:", error.message);
    }

    return ok(res, { success: true });
  })
);

authRouter.get(
  "/callback",
  asyncRoute(async (req, res) => {
    enforceLimit(callbackLimiter, req, res);

    // A provider-side denial arrives as ?error, not as a code. Supabase forwards Google's
    // refusal the same way.
    if (typeof req.query.error === "string") {
      throw new HttpError(400, "OAUTH_DENIED", "Sign-in was cancelled.");
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    // Google comes back through Supabase, which keeps its own `state` and hands ours back
    // in the redirect URL; LINE echoes ours directly.
    const rawState =
      typeof req.query.st === "string"
        ? req.query.st
        : typeof req.query.state === "string"
          ? req.query.state
          : "";
    const state = verifyState(rawState);

    if (!code || !state) {
      throw new HttpError(400, "INVALID_STATE", "Expired or invalid sign-in attempt.");
    }

    if (!providerConfigured(state.provider)) {
      throw new HttpError(
        503,
        "AUTH_PROVIDER_UNAVAILABLE",
        `${state.provider} OAuth is not configured on this server.`
      );
    }

    let session: AuthSession;

    try {
      if (state.provider === "google") {
        // Single-use: the verifier is consumed here, so a replayed callback cannot
        // redeem the code twice.
        const verifier = claimVerifier(rawState);

        if (!verifier) {
          throw new HttpError(400, "INVALID_STATE", "Expired or invalid sign-in attempt.");
        }

        session = await sessionFromSupabaseCode(code, verifier);
      } else {
        const identity = await identityFromCode(state.provider, code, state.nonce);
        session = await sessionForIdentity(identity);
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;

      // Provider payloads can carry tokens, so only the message is logged.
      console.error("OAuth exchange failed:", (error as Error).message);
      throw new HttpError(502, "AUTH_PROVIDER_ERROR", "Sign-in failed. Please retry.");
    }

    if (!state.app) return ok(res, session);

    // Tokens never travel in a URL: the app trades this code for them.
    const handoff = new URL(env.APP_AUTH_REDIRECT);
    handoff.searchParams.set("code", stashSession(session));

    return res.redirect(handoff.toString());
  })
);

const sessionSchema = z.object({
  code: z.string().min(1).max(200),
  /** Turnstile token; required only when TURNSTILE_SECRET_KEY is configured. */
  turnstile_token: z.string().min(1).max(2048).optional(),
});

/** Second half of the deep-link flow; single use, 60-second window. */
authRouter.post(
  "/session",
  asyncRoute(async (req, res) => {
    enforceLimit(sessionLimiter, req, res);

    const parsed = sessionSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", "code is required.");
    }

    // When Turnstile is configured, the handoff that mints a full session is gated on a
    // valid token — this is the unauthenticated brute-force surface (§22).
    if (!(await verifyTurnstile(parsed.data.turnstile_token ?? "", clientIp(req)))) {
      throw new HttpError(403, "CAPTCHA_FAILED", "Human verification failed.");
    }

    const session = claimSession(parsed.data.code);

    if (!session) {
      throw new HttpError(400, "INVALID_CODE", "That sign-in code is no longer valid.");
    }

    return ok(res, session);
  })
);

const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  turnstile_token: z.string().min(1).max(2048).optional(),
});

/**
 * Email/password signup (docs/TRD.md §17). Emails are always sent to confirm the address
 * before the account is usable, and the endpoint is gated on CAPTCHA — an ungated
 * account-creation surface is exactly what Turnstile exists for. Returns no tokens: the
 * user confirms from the email link, then signs in.
 */
authRouter.post(
  "/signup",
  asyncRoute(async (req, res) => {
    enforceLimit(signupLimiter, req, res);

    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", parsed.error.issues[0]!.message);
    }

    const { email, password, turnstile_token } = parsed.data;
    return ok(res, await signUp(email, password, turnstile_token, clientIp(req)));
  })
);

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) });

/**
 * Email/password sign-in. Returns a single-use handoff code, not tokens — the client
 * redeems it via POST /auth/session, the only endpoint that ever returns tokens. Wrong
 * credentials are 401. Login itself is not captcha-gated (it is a credential check, not
 * an account-creation/email-storm surface); the /auth/session redeem still carries the
 * CAPTCHA gate when Turnstile is configured.
 */
authRouter.post(
  "/login",
  asyncRoute(async (req, res) => {
    enforceLimit(loginLimiter, req, res);

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", parsed.error.issues[0]!.message);
    }

    const { email, password } = parsed.data;
    return ok(res, await logIn(email, password));
  })
);

const resetSchema = z.object({
  email: emailSchema,
  turnstile_token: z.string().min(1).max(2048).optional(),
});

/** Send a password-reset email. Always reports success (anti-enumeration); captcha-gated. */
authRouter.post(
  "/password/reset",
  asyncRoute(async (req, res) => {
    enforceLimit(resetLimiter, req, res);

    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", parsed.error.issues[0]!.message);
    }

    const { email, turnstile_token } = parsed.data;
    return ok(res, await requestPasswordReset(email, turnstile_token, clientIp(req)));
  })
);

const resetCompleteSchema = z.object({
  token_hash: z.string().min(1).max(500),
  password: passwordSchema,
});

/** Exchange the recovery link token for a session and set a new password. */
authRouter.post(
  "/password/reset-complete",
  asyncRoute(async (req, res) => {
    enforceLimit(resetCompleteLimiter, req, res);

    const parsed = resetCompleteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", parsed.error.issues[0]!.message);
    }

    const { token_hash, password } = parsed.data;
    return ok(res, await completePasswordReset(token_hash, password));
  })
);

/**
 * `GET /auth/line` and `GET /auth/google` (docs/API_STRUCTURE.md §3.1). Add
 * `?redirect_to=app` to come back through the app deep link instead of JSON.
 * Declared last so the parameter cannot shadow `/me`, `/callback`, or `/session`.
 *
 * Google is handed to Supabase Auth (PKCE); LINE is exchanged by this server.
 */
authRouter.get(
  "/:provider",
  asyncRoute(async (req, res, next) => {
    enforceLimit(providerLimiter, req, res);

    const provider = param(req, "provider");

    if (!isProvider(provider)) return next();

    if (!providerConfigured(provider)) {
      throw new HttpError(
        503,
        "AUTH_PROVIDER_UNAVAILABLE",
        `${provider} OAuth is not configured on this server.`
      );
    }

    const { state, nonce } = signState(provider, req.query.redirect_to === "app");

    if (provider === "google") {
      const { verifier, challenge } = pkcePair();
      stashVerifier(state, verifier);

      return res.redirect(
        supabaseAuthorizeUrl(provider, callbackWithState(state), challenge)
      );
    }

    return res.redirect(authorizeUrl(provider, state, nonce));
  })
);
