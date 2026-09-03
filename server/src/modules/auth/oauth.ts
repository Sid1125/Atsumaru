import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { env, hasLine, hasSupabase } from "../../config/env.js";
import { ephemeral, type EphemeralStore } from "../../services/ephemeral.js";

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
  /**
   * Whether an address this provider hands back can be trusted to belong to the person
   * signing in. Linking a second identity onto an existing account rests entirely on
   * this, so a new provider has to assert it deliberately rather than inherit a default.
   */
  emailIsVerified: boolean;
}

/** Only LINE is exchanged here; Google's client credentials live in Supabase. */
const CONFIG: Record<"line", ProviderConfig> = {
  line: {
    authorizeUrl: "https://access.line.me/oauth2/v2.1/authorize",
    tokenUrl: "https://api.line.me/oauth2/v2.1/token",
    scope: "openid profile email",
    clientId: () => env.LINE_CHANNEL_ID ?? "",
    clientSecret: () => env.LINE_CHANNEL_SECRET ?? "",
    // LINE releases an address only after verifying it, and only to a channel granted
    // the email permission.
    emailIsVerified: true,
  },
};

export interface StatePayload {
  provider: Provider;
  nonce: string;
  /** Epoch seconds. */
  exp: number;
  /** Whether the callback should deep-link into the app instead of answering JSON. */
  app: boolean;
  /** SHA-256 of the value held in the binding cookie — see {@link bindingMatches}. */
  bind: string;
}

const STATE_TTL_SECONDS = 600;

/** httpOnly cookie that ties a `state` blob to the browser it was issued to. */
export const BINDING_COOKIE = "atsumaru_oauth";

function sign(body: string): string {
  return createHmac("sha256", env.AUTH_STATE_SECRET).update(body).digest("base64url");
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

/**
 * The `state` blob is HMAC-signed rather than stored, so login needs no Redis and
 * survives a restart. It carries the nonce that the id_token must echo back, and the
 * digest of the binding value returned alongside it.
 */
export function signState(
  provider: Provider,
  app: boolean,
  now = Date.now()
): { state: string; nonce: string; binding: string } {
  const nonce = randomBytes(16).toString("base64url");
  const binding = randomBytes(32).toString("base64url");

  const payload: StatePayload = {
    provider,
    nonce,
    exp: Math.floor(now / 1000) + STATE_TTL_SECONDS,
    app,
    bind: digest(binding),
  };

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return { state: `${body}.${sign(body)}`, nonce, binding };
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
  if (typeof payload.bind !== "string" || payload.bind.length === 0) return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < now) return null;

  return { ...payload, app: payload.app === true };
}

/**
 * A valid signature proves *this server* issued the state, not that the browser handing
 * it back is the one that asked for it. Without the second half an attacker can start a
 * login, then get a victim's browser to hit the callback carrying the attacker's code, and
 * the victim ends up signed into the attacker's account — login CSRF.
 *
 * Only the digest rides in the state; the value itself exists solely in an httpOnly cookie
 * in the browser that began the flow, so another client cannot produce it.
 */
export function bindingMatches(payload: StatePayload, cookie: string | null): boolean {
  if (!cookie) return false;

  const expected = Buffer.from(payload.bind);
  const actual = Buffer.from(digest(cookie));

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * SameSite=Lax, not Strict: the callback arrives as a top-level GET navigation from the
 * provider, which is cross-site but is exactly the case Lax still sends a cookie on.
 * Strict would withhold it and break every login.
 */
export function bindingCookie(binding: string): string {
  const parts = [
    `${BINDING_COOKIE}=${binding}`,
    "Path=/api/auth",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${STATE_TTL_SECONDS}`,
  ];

  if (env.NODE_ENV === "production") parts.push("Secure");

  return parts.join("; ");
}

/** Cleared as soon as it is redeemed, so one browser cannot replay the same login. */
export function clearedBindingCookie(): string {
  return `${BINDING_COOKIE}=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Express parses no cookies without middleware, and this is the only one the API sets. */
export function readBinding(header: string | undefined): string | null {
  if (!header) return null;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");

    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== BINDING_COOKIE) continue;

    return part.slice(separator + 1).trim() || null;
  }

  return null;
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

/**
 * Verifiers live in the shared ephemeral store, keyed by a digest of the signed state
 * rather than the state itself — the state carries its own payload, and there is no reason
 * to write that into a Redis key. Moving them out of a Map is half of what let this API run
 * more than one instance (TRACKER.md §5); the handoff codes in session.ts are the other.
 *
 * `store` is injectable so a test can drive its own clock.
 */
export async function stashVerifier(
  state: string,
  verifier: string,
  store: EphemeralStore = ephemeral
): Promise<void> {
  await store.put(`pkce:${digest(state)}`, verifier, VERIFIER_TTL_MS);
}

/** Single use: a replayed callback must not be able to exchange a second time. */
export async function claimVerifier(
  state: string,
  store: EphemeralStore = ephemeral
): Promise<string | null> {
  return store.take(`pkce:${digest(state)}`);
}

export interface Identity {
  provider: Provider;
  sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  /**
   * True only when the provider vouches for the address. Linking this identity onto an
   * account that already holds the same address is gated on it (see session.ts): without
   * the guarantee, a provider that let anyone claim any address could hand over someone
   * else's account.
   */
  emailVerified: boolean;
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

  const email = typeof claims.email === "string" ? claims.email : null;

  return {
    provider,
    sub,
    email,
    name: typeof claims.name === "string" ? claims.name : null,
    picture: typeof claims.picture === "string" ? claims.picture : null,
    emailVerified: email !== null && config.emailIsVerified,
  };
}

export async function identityFromCode(
  provider: "line",
  code: string,
  nonce: string
): Promise<Identity> {
  return verifyIdToken(provider, await exchangeCode(provider, code), nonce);
}
