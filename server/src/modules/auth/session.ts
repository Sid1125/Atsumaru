import { randomBytes } from "node:crypto";

import { db, publicUser, type PublicUser } from "../../db/queries.js";
import { HttpError, dbError } from "../../utils/response.js";
import { emailForIdentity, type Identity } from "./oauth.js";

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: PublicUser | null;
  is_new: boolean;
}

/**
 * Supabase has no LINE provider and we exchange Google's code ourselves, so the API
 * mints the session: create (or find) the auth user, then turn a single-use magic-link
 * token into a real session. The service-role key never leaves the server.
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
  const isNew = userId === null;

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

    if (createError || !created.user) {
      throw new HttpError(
        502,
        "AUTH_PROVIDER_ERROR",
        createError?.message ?? "Could not create the account."
      );
    }

    userId = created.user.id;

    const { error: identityError } = await client.from("oauth_identities").insert({
      provider: identity.provider,
      provider_sub: identity.sub,
      user_id: userId,
    });

    if (identityError) throw dbError(identityError);
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

  const { data: verified, error: verifyError } = await client.auth.verifyOtp({
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

  return {
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
    // Null until onboarding writes the profile row (docs/API_STRUCTURE.md §3.1).
    user: await profileOrNull(userId),
    is_new: isNew,
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
