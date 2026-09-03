import { env, hasTurnstile } from "../../config/env.js";

const TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Server-side Turnstile verification (docs/ATSUMARU_SECURITY_COMPLETE §22). The client
 * presents a token minted by the Turnstile widget; this exchanges it with Cloudflare for
 * a pass/fail. Never trust the widget's own success state — only this server-side check
 * means anything.
 *
 * When Turnstile is not configured (no keys), the caller is NOT challenged: the endpoint
 * is still protected by the tight, single-use handoff-code and IP rate limits. Only set
 * TURNSTILE_SECRET_KEY to start enforcing it.
 */
export async function verifyTurnstile(
  token: string,
  remoteIp?: string
): Promise<boolean> {
  if (!hasTurnstile) return true;

  // Test config via env flag (never keys in source): the widget cannot render without a
  // dev build / client token, so "verify" always passes rather than killing every sign-in
  // behind a token that is never produced. Real deployments leave this unset → strict.
  if (env.TURNSTILE_ALWAYS_PASS === true) return true;

  if (!token) return false;

  try {
    const body = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY!,
      response: token,
    });
    if (remoteIp) body.set("remoteip", remoteIp);

    const res = await fetch(TURNSTILE_VERIFY, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true && res.ok;
  } catch {
    return false;
  }
}
