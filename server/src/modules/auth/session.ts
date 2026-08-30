import { randomBytes } from "node:crypto";

import { env } from "../../config/env.js";
import { authDb, db, publicUser, type PublicUser } from "../../db/queries.js";
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

  const userId = payload.user?.id;

  if (!payload.access_token || !payload.refresh_token || !userId) {
    throw new HttpError(502, "AUTH_PROVIDER_ERROR", "Could not start a session.");
  }

  // Supabase owns the provider→user mapping for Google (auth.identities), so "new" here
  // means "no public profile row yet", which is exactly what the app routes on.
  const profile = await profileOrNull(userId);

  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    user: profile,
    is_new: profile === null,
  };
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
    } else if (createError && isEmailTaken(createError) && !isSyntheticEmail(email)) {
      // One human, second provider: the address already has an account (e.g. they signed
      // in with Google first), so this identity is linked to it below rather than creating
      // a twin. Only ever for an address the provider actually returned — a synthetic one
      // is unique per provider subject and cannot legitimately collide, so a collision
      // there would mean something is wrong, not that it is the same person.
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

interface PendingSession {
  session: AuthSession;
  expiresAt: number;
}

const PENDING_TTL_MS = 60_000;

// ponytail: in-memory handoff codes, move to Redis if the API ever runs more than one
// instance. They live for a minute and are consumed once, so a restart costs a re-login.
const pending = new Map<string, PendingSession>();

/** Hands the app a code instead of putting tokens in a redirect URL. */
export function stashSession(session: AuthSession, now = Date.now()): string {
  prune(now);

  const code = randomBytes(32).toString("base64url");
  pending.set(code, { session, expiresAt: now + PENDING_TTL_MS });

  return code;
}

export function claimSession(code: string, now = Date.now()): AuthSession | null {
  prune(now);

  const entry = pending.get(code);

  if (!entry) return null;

  // Single use: a replayed code must not return the same tokens twice.
  pending.delete(code);

  return entry.expiresAt >= now ? entry.session : null;
}

function prune(now: number) {
  for (const [code, entry] of pending) {
    if (entry.expiresAt < now) pending.delete(code);
  }
}
