import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { env, hasGoogle, hasLine } from "../../config/env.js";

/** OAuth only — LINE and Google, no phone OTP (docs/TRD.md §5). */
export const PROVIDERS = ["line", "google"] as const;

export type Provider = (typeof PROVIDERS)[number];

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}

export function providerConfigured(provider: Provider): boolean {
  return provider === "line" ? hasLine : hasGoogle;
}

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: () => string;
  clientSecret: () => string;
}

const CONFIG: Record<Provider, ProviderConfig> = {
  line: {
    authorizeUrl: "https://access.line.me/oauth2/v2.1/authorize",
    tokenUrl: "https://api.line.me/oauth2/v2.1/token",
    scope: "openid profile email",
    clientId: () => env.LINE_CHANNEL_ID ?? "",
    clientSecret: () => env.LINE_CHANNEL_SECRET ?? "",
  },
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid profile email",
    clientId: () => env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: () => env.GOOGLE_CLIENT_SECRET ?? "",
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

export function authorizeUrl(provider: Provider, state: string, nonce: string): string {
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

/** Swaps the authorization code for the provider's `id_token`. */
async function exchangeCode(provider: Provider, code: string): Promise<string> {
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
 * Both providers expose an endpoint that validates the signature, audience and expiry
 * of an id_token, which keeps a JWKS implementation out of this codebase.
 */
async function verifyIdToken(
  provider: Provider,
  idToken: string,
  nonce: string
): Promise<Identity> {
  const config = CONFIG[provider];

  const claims =
    provider === "line"
      ? await postForm("https://api.line.me/oauth2/v2.1/verify", {
          id_token: idToken,
          client_id: config.clientId(),
          nonce,
        })
      : await googleTokenInfo(idToken);

  const sub = claims.sub;

  if (typeof sub !== "string" || sub.length === 0) {
    throw new Error(`${provider} id_token has no subject.`);
  }

  if (claims.aud !== config.clientId()) {
    throw new Error(`${provider} id_token was issued for another client.`);
  }

  // Google's tokeninfo does not accept a nonce parameter, so it is checked here.
  if (provider === "google" && claims.nonce !== nonce) {
    throw new Error("google id_token nonce mismatch.");
  }

  return {
    provider,
    sub,
    email: typeof claims.email === "string" ? claims.email : null,
    name: typeof claims.name === "string" ? claims.name : null,
    picture: typeof claims.picture === "string" ? claims.picture : null,
  };
}

async function googleTokenInfo(idToken: string): Promise<Record<string, unknown>> {
  const url = new URL("https://oauth2.googleapis.com/tokeninfo");
  url.searchParams.set("id_token", idToken);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`google tokeninfo failed: ${response.status}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

export async function identityFromCode(
  provider: Provider,
  code: string,
  nonce: string
): Promise<Identity> {
  return verifyIdToken(provider, await exchangeCode(provider, code), nonce);
}
