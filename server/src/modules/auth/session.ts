import { randomBytes } from "node:crypto";

import { env } from "../../config/env.js";
import { authDb, db, publicUser, type PublicUser } from "../../db/queries.js";
import { ephemeral, type EphemeralStore } from "../../services/ephemeral.js";
import { HttpError, dbError } from "../../utils/response.js";
import { emailForIdentity, isSyntheticEmail, type Identity } from "./oauth.js";

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: PublicUser | null;
  is_new: boolean;
}

/**
 * Google path: Supabase already verified the provider and created the auth user, so the
 * authorization code only has to be redeemed. Done with a bare `fetch` rather than
 * supabase-js on purpose — `exchangeCodeForSession` saves the session onto whichever
 * client runs it, which is the same trap `verifyOtp` sets (see below).
 */
export async function sessionFromSupabaseCode(
  code: string,
  verifier: string
): Promise<AuthSession> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new HttpError(
      503,
      "AUTH_PROVIDER_UNAVAILABLE",
      "Supabase Auth is not configured on this server."
    );
  }

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
  });

  if (!response.ok) {
    // The body can echo the code; only the status is safe to surface.
    console.error("Supabase PKCE exchange failed:", response.status);
    throw new HttpError(502, "AUTH_PROVIDER_ERROR", "Sign-in failed. Please retry.");
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    user?: { id?: string };
  };

  return sessionFromTokenPayload(payload);
}

/**
 * Shared tail of both GoTrue token grants. Supabase owns the provider→user mapping, so
 * "new" here means "no public profile row yet" — exactly what the app routes on.
 */
async function sessionFromTokenPayload(payload: {
  access_token?: string;
  refresh_token?: string;
  user?: { id?: string };
}): Promise<AuthSession> {
  const userId = payload.user?.id;

  if (!payload.access_token || !payload.refresh_token || !userId) {
    throw new HttpError(502, "AUTH_PROVIDER_ERROR", "Could not start a session.");
  }

  const profile = await profileOrNull(userId);

  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    user: profile,
    is_new: profile === null,
  };
}

/**
 * Keeps a signed-in app signed in. Supabase access tokens are short-lived, and the client
 * used to keep only the access token with no 401 path at all, so an expired one dead-ended
 * every request with no way back (TRACKER.md §5).
 *
 * Supabase rotates the refresh token on use, so the response carries a *new* one and the
 * caller must replace what it holds. Redeeming the same token twice fails by design.
 */
export async function sessionFromRefreshToken(
  refreshToken: string
): Promise<AuthSession> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new HttpError(
      503,
      "AUTH_PROVIDER_UNAVAILABLE",
      "Supabase Auth is not configured on this server."
    );
  }

  const response = await fetch(
    `${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }
  );

  if (!response.ok) {
    // Expired, revoked, or already rotated. Nothing upstream is broken and retrying will
    // not help, so this is a 401 the app answers by signing out — not a 502.
    console.error("Supabase refresh rejected:", response.status);

    throw new HttpError(401, "REFRESH_REJECTED", "That session could not be refreshed.");
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    user?: { id?: string };
  };

  return sessionFromTokenPayload(payload);
}

/**
 * True when Supabase refused `createUser` because the address already has an account.
 * GoTrue reports it as `email_exists` (older builds only as prose), so both are checked.
 */
export function isEmailTaken(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "email_exists" ||
    /already (been )?registered|already exists/i.test(error.message ?? "")
  );
}

/**
 * LINE path. Supabase has no LINE provider, so the API mints the session itself: create
 * (or find) the auth user, then turn a single-use magic-link token into a real session.
 * The service-role key never leaves the server.
 */
export async function sessionForIdentity(identity: Identity): Promise<AuthSession> {
  const client = db();
  const email = emailForIdentity(identity);

  const { data: existing, error: lookupError } = await client
    .from("oauth_identities")
    .select("user_id")
    .eq("provider", identity.provider)
    .eq("provider_sub", identity.sub)
    .maybeSingle<{ user_id: string }>();

  if (lookupError) throw dbError(lookupError);

  let userId = existing?.user_id ?? null;

  if (!userId) {
    const { data: created, error: createError } = await client.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        provider: identity.provider,
        name: identity.name,
        picture: identity.picture,
      },
    });

    if (created?.user) {
      userId = created.user.id;
    } else if (createError && isEmailTaken(createError)) {
      // One human, second provider: the address already has an account (e.g. they signed
      // in with Google first), so this identity is linked to it below rather than creating
      // a twin.
      //
      // Linking hands over an existing account, so it takes two guarantees. The address
      // must be one the provider actually returned — a synthetic one is unique per provider
      // subject and cannot legitimately collide, so a collision there means something is
      // wrong, not that it is the same person. And the provider must vouch for the address:
      // one that let a user claim any address unchecked would let them claim the account
      // behind it too.
      if (isSyntheticEmail(email) || !identity.emailVerified) {
        throw new HttpError(
          409,
          "IDENTITY_NOT_LINKABLE",
          "This sign-in could not be linked to an existing account."
        );
      }

      userId = null;
    } else {
      throw new HttpError(
        502,
        "AUTH_PROVIDER_ERROR",
        createError?.message ?? "Could not create the account."
      );
    }
  }

  const { data: link, error: linkError } = await client.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !link.properties?.hashed_token) {
    throw new HttpError(
      502,
      "AUTH_PROVIDER_ERROR",
      linkError?.message ?? "Could not start a session."
    );
  }

  // For the link-an-existing-account path this is where the id comes from: generateLink
  // resolves the address to its account, so no extra admin lookup is needed.
  userId = userId ?? link.user?.id ?? null;

  if (!userId) {
    throw new HttpError(502, "AUTH_PROVIDER_ERROR", "Could not resolve the account.");
  }

  if (!existing) {
    const { error: identityError } = await client.from("oauth_identities").insert({
      provider: identity.provider,
      provider_sub: identity.sub,
      user_id: userId,
    });

    if (identityError) throw dbError(identityError);
  }

  // verifyOtp stores a session on whichever client runs it, and supabase-js then sends
  // that user's JWT on every subsequent PostgREST call from the same client. Doing this
  // on the shared db() singleton would silently demote the whole process to the user's
  // own privileges and hit the deny-all RLS in schema.sql, so it gets its own client.
  const { data: verified, error: verifyError } = await authDb().auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });

  if (verifyError || !verified.session) {
    throw new HttpError(
      502,
      "AUTH_PROVIDER_ERROR",
      verifyError?.message ?? "Could not start a session."
    );
  }

  // Null until onboarding writes the profile row (docs/API_STRUCTURE.md §3.1). "New" means
  // exactly that — the same meaning the Supabase-brokered path reports — so linking a
  // second provider to an onboarded account does not send the user back to onboarding.
  const profile = await profileOrNull(userId);

  return {
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
    user: profile,
    is_new: profile === null,
  };
}

async function profileOrNull(userId: string): Promise<PublicUser | null> {
  try {
    return await publicUser(userId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

const PENDING_TTL_MS = 60_000;

/**
 * Where a handoff code came from. OAuth codes are produced behind a provider round trip
 * (PKCE + binding cookie + state signature) and are therefore already human-gated, while
 * email/password codes are minted by a direct-hit credential call. The CAPTCHA gate on
 * `POST /auth/session` applies to the latter only (docs/SECURITY_AUDIT.md §22).
 */
export type HandoffOrigin = "oauth" | "email";

export interface StashedHandoff {
  origin: HandoffOrigin;
  session: AuthSession;
}

/**
 * Hands the app a code instead of putting tokens in a redirect URL.
 *
 * Codes live in the shared ephemeral store, not a Map, so the instance that redeems one
 * does not have to be the instance that issued it — which is what kept this API to a single
 * process (TRACKER.md §5). `store` is injectable so a test can drive its own clock.
 */
export async function stashSession(
  session: AuthSession,
  origin: HandoffOrigin = "oauth",
  store: EphemeralStore = ephemeral
): Promise<string> {
  const code = randomBytes(32).toString("base64url");

  await store.put(`handoff:${code}`, JSON.stringify({ origin, session }), PENDING_TTL_MS);

  return code;
}

/** Single use: `take` reads and deletes, so a replay gets nothing. */
export async function claimSession(
  code: string,
  store: EphemeralStore = ephemeral
): Promise<StashedHandoff | null> {
  const raw = await store.take(`handoff:${code}`);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as StashedHandoff;
  } catch {
    // Only this module ever writes these values, so a parse failure means a corrupted
    // store rather than a client problem. Treated as "no such code".
    console.error("Discarded an unreadable handoff session.");

    return null;
  }
}
