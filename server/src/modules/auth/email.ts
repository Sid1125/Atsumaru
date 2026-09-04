import { z } from "zod";

import { env, hasSupabase } from "../../config/env.js";
import { authDb, publicUser } from "../../db/queries.js";
import type { PublicUser } from "../../db/queries.js";
import { HttpError } from "../../utils/response.js";
import { stashSession } from "./session.js";

/**
 * Email/password auth via Supabase Auth (docs/TRD.md §17 — OAuth was canonical; email is
 * added alongside it, not replacing it).
 *
 * Unlike OAuth, these are direct-hit surfaces: an attacker can call them without a
 * provider round-trip. signup and password-reset are therefore gated on Cloudflare
 * Turnstile (docs/ATSUMARU_SECURITY_COMPLETE §22) and FAIL CLOSED — they refuse to run
 * until TURNSTILE_SECRET_KEY is set, because an ungated account-creation/email-storm
 * surface is exactly what CAPTCHA exists for. Login is not captcha-gated: it is a
 * credential check that already carries per-IP rate limits, and forcing a widget on it
 * makes legitimate sign-ins brittle.
 */

/** Strong password policy: min 8, at least one upper, lower, and digit (docs/TRD.md). */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(200, "Password is too long.")
  .refine((value) => /[A-Z]/.test(value), "Password needs an uppercase letter.")
  .refine((value) => /[a-z]/.test(value), "Password needs a lowercase letter.")
  .refine((value) => /[0-9]/.test(value), "Password needs a digit.");


export const emailSchema = z.string().email("Enter a valid email address.").max(254);

export interface PasswordAuthSession {
  access_token: string;
  refresh_token: string;
  user: PublicUser | null;
  is_new: boolean;
}

function requireSupabaseAuth() {
  if (!hasSupabase) {
    throw new HttpError(
      503,
      "AUTH_PROVIDER_UNAVAILABLE",
      "Supabase Auth is not configured on this server."
    );
  }
}

/**
 * Fail-closed CAPTCHA gate for the direct-hit surfaces (signup, password reset).
 * Without Turnstile configured there is no human/bot gate, so these refuse to run.
 * With it configured, the token is verified server-side — never trust the widget's own
 * success state.
 */
async function requireCaptcha(
  token: string | undefined,
  remoteIp: string | undefined
): Promise<void> {
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new HttpError(
      503,
      "CAPTCHA_REQUIRED",
      "Human verification is not configured on this server yet."
    );
  }
  const { verifyTurnstile } = await import("./turnstile.js");
  const ok = await verifyTurnstile(token ?? "", remoteIp);
  if (!ok) {
    throw new HttpError(403, "CAPTCHA_FAILED", "Human verification failed.");
  }
}

/**
 * Create an account. Email confirmation is required by the project's Supabase Auth
 * settings, so signUp only sends the confirmation email and returns no tokens — the user
 * confirms from the link, then signs in. Never mint a pre-confirmation session: that is
 * what would let an attacker squat an address and walk into onboarding.
 */
export async function signUp(
  email: string,
  password: string,
  turnstileToken: string | undefined,
  remoteIp?: string
): Promise<{ sent: boolean }> {
  requireSupabaseAuth();
  await requireCaptcha(turnstileToken, remoteIp);

  // Bring the confirmation link back through the app's branded confirmation page
  // (GET /auth/confirm) instead of straight into the app. The user confirms on that web
  // page, then signs in from the app — see docs/API_STRUCTURE.md §3.1 / LORE/SECURITY_AUDIT.md §4.
  const { error } = await authDb().auth.signUp({
    email,
    password,
    options: {
      // Point the confirmation email link at our branded confirmation page (GET
      // /auth/confirm) instead of straight into the app. The user confirms on that web
      // page, then signs in from the app. When APP_PUBLIC_URL is unset the link falls back
      // to APP_AUTH_REDIRECT (the app scheme) so the user confirms inside the app instead.
      emailRedirectTo:
        env.APP_PUBLIC_URL
          ? `${env.APP_PUBLIC_URL}/api/auth/confirm`
          : env.APP_AUTH_REDIRECT,
    },
  });

  if (error) {
    // Anti-enumeration: never leak whether the address is already registered. An
    // "email_exists" error is expected and invisible to the caller.
    if (error.code === "email_exists" || /already been registered/i.test(error.message)) {
      console.warn("Signup attempt for existing email:", error.code);
      return { sent: true };
    }
    throw new HttpError(502, "AUTH_PROVIDER_ERROR", error.message ?? "Could not sign up.");
  }

  return { sent: true };
}

/**
 * Sign in with email + password. On success the Supabase session is stashed behind a
 * single-use handoff code, so the client redeems it via POST /auth/session — the only
 * endpoint that ever returns tokens. Wrong credentials are 401, never 502.
 */
export async function logIn(
  email: string,
  password: string
): Promise<{ code: string }> {
  requireSupabaseAuth();

  const { data, error } = await authDb().auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Invalid_credentials covers bad password AND unknown email; do not distinguish.
    throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const session = data.session;
  if (!session) {
    throw new HttpError(502, "AUTH_PROVIDER_ERROR", "Could not start a session.");
  }

  const profile = await profileOrNull(session.user.id);

  const code = await stashSession(
    {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user: profile,
      // Email/password creates the auth user at signup; "new" means no profile row yet,
      // same meaning as OAuth.
      is_new: profile === null,
    },
    // The code is minted by a direct-hit credential call, so its redeem carries the
    // CAPTCHA gate (the OAuth callback tags its codes "oauth" and passes through).
    "email"
  );

  return { code };
}

/**
 * Send a password-reset email. Always reports success regardless of whether the address
 * has an account, so the endpoint cannot be used to enumerate valid emails. Supabase
 * returns an error for an unknown address, which is deliberately suppressed.
 */
export async function requestPasswordReset(
  email: string,
  turnstileToken: string | undefined,
  remoteIp?: string
): Promise<{ sent: boolean }> {
  requireSupabaseAuth();
  await requireCaptcha(turnstileToken, remoteIp);

  const recoveryUrl = new URL(env.APP_AUTH_REDIRECT);
  recoveryUrl.searchParams.set("action", "recovery");

  const { error } = await authDb().auth.resetPasswordForEmail(email, {
    redirectTo: recoveryUrl.toString(),
  });

  // Anti-enumeration: never leak whether the address exists. A failure to send for an
  // unknown email is expected and invisible to the caller.
  if (error) {
    console.warn("Password reset could not be sent:", error.code ?? error.message);
  }
  return { sent: true };
}

/**
 * Exchange the recovery token (from the password-reset email link) for a session, then
 * set a new password. The recovery link carries `?token_hash=` + type=recovery, which the
 * client passes here along with the new password.
 */
export async function completePasswordReset(
  tokenHash: string,
  password: string
): Promise<{ done: boolean }> {
  requireSupabaseAuth();

  // One throwaway client for both calls: verifyOtp stores the recovery session on the
  // client it runs on, and updateUser needs that same session. Calling authDb() twice
  // would give two different clients and the password update would run unauthenticated.
  const client = authDb();

  const verified = await client.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });

  if (verified.error || !verified.data.session) {
    throw new HttpError(
      400,
      "INVALID_RESET_TOKEN",
      "That recovery link is invalid or has expired."
    );
  }

  const { error: updateError } = await client.auth.updateUser({ password });
  if (updateError) {
    throw new HttpError(502, "AUTH_PROVIDER_ERROR", "Could not update the password.");
  }

  return { done: true };
}

async function profileOrNull(userId: string): Promise<PublicUser | null> {
  try {
    return await publicUser(userId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}
