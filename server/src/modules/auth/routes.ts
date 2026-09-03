import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import { db, PUBLIC_USER_COLUMNS, type PublicUser } from "../../db/queries.js";
import { env } from "../../config/env.js";
import { dbError, HttpError, ok } from "../../utils/response.js";
import { param } from "../../utils/request.js";
import {
  authorizeUrl,
  bindingCookie,
  bindingMatches,
  callbackWithState,
  claimVerifier,
  clearedBindingCookie,
  identityFromCode,
  isProvider,
  pkcePair,
  providerConfigured,
  readBinding,
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

export const authRouter = Router();

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

    // A signature only proves this server minted the state. The cookie proves the browser
    // presenting it is the one that started the flow, which is what stops an attacker's
    // code being redeemed in a victim's browser.
    if (!bindingMatches(state, readBinding(req.headers.cookie))) {
      throw new HttpError(400, "INVALID_STATE", "Expired or invalid sign-in attempt.");
    }

    // Single use, whichever way this response ends.
    res.setHeader("Set-Cookie", clearedBindingCookie());

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

const sessionSchema = z.object({ code: z.string().min(1).max(200) });

/** Second half of the deep-link flow; single use, 60-second window. */
authRouter.post(
  "/session",
  asyncRoute(async (req, res) => {
    const parsed = sessionSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", "code is required.");
    }

    const session = claimSession(parsed.data.code);

    if (!session) {
      throw new HttpError(400, "INVALID_CODE", "That sign-in code is no longer valid.");
    }

    return ok(res, session);
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
    const provider = param(req, "provider");

    if (!isProvider(provider)) return next();

    if (!providerConfigured(provider)) {
      throw new HttpError(
        503,
        "AUTH_PROVIDER_UNAVAILABLE",
        `${provider} OAuth is not configured on this server.`
      );
    }

    const { state, nonce, binding } = signState(provider, req.query.redirect_to === "app");

    // The browser keeps the binding value; only its digest travels inside `state`, so a
    // state blob lifted off the wire is useless in any other client.
    res.setHeader("Set-Cookie", bindingCookie(binding));

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
