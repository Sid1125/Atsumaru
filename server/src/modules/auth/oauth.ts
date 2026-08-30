import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { env, hasLine, hasSupabase } from "../../config/env.js";

/** OAuth only — LINE and Google, no phone OTP (docs/TRD.md §5). */
export const PROVIDERS = ["line", "google"] as const;

export type Provider = (typeof PROVIDERS)[number];

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}

/**
 * Google is brokered by Supabase Auth, which holds the client id and secret, so this
 * server only needs Supabase to be reachable. Supabase has no LINE provider, so LINE
 * still exchanges its own code here and needs channel credentials.
 */
export function providerConfigured(provider: Provider): boolean {
  return provider === "line" ? hasLine : hasSupabase && !!env.SUPABASE_ANON_KEY;
}

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: () => string;
  clientSecret: () => string;
}

/** Only LINE is exchanged here; Google's client credentials live in Supabase. */
const CONFIG: Record<"line", ProviderConfig> = {
  line: {
    authorizeUrl: "https://access.line.me/oauth2/v2.1/authorize",
    tokenUrl: "https://api.line.me/oauth2/v2.1/token",
    scope: "openid profile email",
    clientId: () => env.LINE_CHANNEL_ID ?? "",
    clientSecret: () => env.LINE_CHANNEL_SECRET ?? "",
  },
};

export interface StatePayload {
  provider: Provider;
  nonce: string;
  /** Epoch seconds. */
  exp: number;
  /** Whether the callback should deep-link into the app instead of answering JSON. */
  app: boolean;
}

const STATE_TTL_SECONDS = 600;

function sign(body: string): string {
  return createHmac("sha256", env.AUTH_STATE_SECRET).update(body).digest("base64url");
}

/**
 * The `state` blob is HMAC-signed rather than stored, so login needs no Redis and
 * survives a restart. It carries the nonce that the id_token must echo back.
 */
export function signState(
  provider: Provider,
  app: boolean,
  now = Date.now()
): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString("base64url");

  const payload: StatePayload = {
    provider,
    nonce,
    exp: Math.floor(now / 1000) + STATE_TTL_SECONDS,
    app,
  };

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return { state: `${body}.${sign(body)}`, nonce };
}

export function verifyState(state: string, now = Date.now()): StatePayload | null {
  const [body, signature] = state.split(".");

  if (!body || !signature) return null;

  const expected = sign(body);

  if (
    expected.length !== signature.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }

  let payload: StatePayload;

  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!isProvider(payload.provider)) return null;
  if (typeof payload.nonce !== "string" || payload.nonce.length === 0) return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < now) return null;

  return { ...payload, app: payload.app === true };
}

/** LINE's own authorize endpoint; Google goes through {@link supabaseAuthorizeUrl}. */
export function authorizeUrl(provider: "line", state: string, nonce: string): string {
  const config = CONFIG[provider];
  const url = new URL(config.authorizeUrl);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId());
  url.searchParams.set("redirect_uri", env.OAUTH_CALLBACK_URL);
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);

  return url.toString();
}

/**
 * PKCE, because Supabase only returns an authorization code (rather than tokens in a URL
 * fragment) when the caller proves it started the flow. The verifier stays on this
 * server; only its SHA-256 digest travels.
 */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  return { verifier, challenge };
}

/**
 * Supabase brokers Google: it holds the client secret, talks to Google, and redirects
 * back to `redirectTo` with `?code=`. The signed `state` rides along in that URL because
 * GoTrue issues its own `state` to Google and forwards nothing of ours.
 *
 * Wire format mirrors supabase-js `_getUrlForProvider` / `?grant_type=pkce`.
 */
export function supabaseAuthorizeUrl(
  provider: "google",
  redirectTo: string,
  challenge: string
): string {
  const url = new URL(`${env.SUPABASE_URL}/auth/v1/authorize`);

  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect_to", redirectTo);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "s256");

  return url.toString();
}

/** `OAUTH_CALLBACK_URL` with the signed state attached, for Supabase to redirect back to. */
export function callbackWithState(state: string): string {
  const url = new URL(env.OAUTH_CALLBACK_URL);
  url.searchParams.set("st", state);

  return url.toString();
}

const VERIFIER_TTL_MS = STATE_TTL_SECONDS * 1000;

// ponytail: in-memory, keyed by the signed state, same single-instance caveat as the
// handoff codes in session.ts. A restart mid-login costs one retry.
const verifiers = new Map<string, { verifier: string; expiresAt: number }>();

export function stashVerifier(state: string, verifier: string, now = Date.now()): void {
  pruneVerifiers(now);
  verifiers.set(state, { verifier, expiresAt: now + VERIFIER_TTL_MS });
}

/** Single use: a replayed callback must not be able to exchange a second time. */
export function claimVerifier(state: string, now = Date.now()): string | null {
  pruneVerifiers(now);

  const entry = verifiers.get(state);

  if (!entry) return null;

  verifiers.delete(state);

  return entry.expiresAt >= now ? entry.verifier : null;
}

function pruneVerifiers(now: number) {
  for (const [state, entry] of verifiers) {
    if (entry.expiresAt < now) verifiers.delete(state);
  }
}

export interface Identity {
  provider: Provider;
  sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

/**
 * Supabase Auth keys users by email, but a LINE channel without the email scope never
 * returns one. The synthetic address is internal only and never leaves the server.
 */
export function emailForIdentity(identity: Identity): string {
  return identity.email ?? `${identity.provider}_${identity.sub}@oauth.atsumaru.invalid`;
}

export function isSyntheticEmail(email: string): boolean {
  return email.endsWith("@oauth.atsumaru.invalid");
}

async function postForm(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    throw new Error(`OAuth request to ${url} failed: ${response.status}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

/** Swaps LINE's authorization code for its `id_token`. */
async function exchangeCode(provider: "line", code: string): Promise<string> {
  const config = CONFIG[provider];

  const tokens = await postForm(config.tokenUrl, {
    grant_type: "authorization_code",
    code,
    redirect_uri: env.OAUTH_CALLBACK_URL,
    client_id: config.clientId(),
    client_secret: config.clientSecret(),
  });

  const idToken = tokens.id_token;

  if (typeof idToken !== "string" || idToken.length === 0) {
    throw new Error(`${provider} returned no id_token.`);
  }

  return idToken;
}

/**
 * LINE exposes an endpoint that validates the signature, audience, expiry and nonce of an
 * id_token, which keeps a JWKS implementation out of this codebase.
 */
async function verifyIdToken(
  provider: "line",
  idToken: string,
  nonce: string
): Promise<Identity> {
  const config = CONFIG[provider];

  const claims = await postForm("https://api.line.me/oauth2/v2.1/verify", {
    id_token: idToken,
    client_id: config.clientId(),
    nonce,
  });

  const sub = claims.sub;

  if (typeof sub !== "string" || sub.length === 0) {
    throw new Error(`${provider} id_token has no subject.`);
  }

  if (claims.aud !== config.clientId()) {
    throw new Error(`${provider} id_token was issued for another client.`);
  }

  return {
    provider,
    sub,
    email: typeof claims.email === "string" ? claims.email : null,
    name: typeof claims.name === "string" ? claims.name : null,
    picture: typeof claims.picture === "string" ? claims.picture : null,
  };
}

export async function identityFromCode(
  provider: "line",
  code: string,
  nonce: string
): Promise<Identity> {
  return verifyIdToken(provider, await exchangeCode(provider, code), nonce);
}
