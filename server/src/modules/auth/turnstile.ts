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
    const json = (await res.json()) as {
      success?: boolean;
      hostname?: string;
      "error-codes"?: string[];
    };

    if (json.success !== true || !res.ok) {
      // A rejected token is otherwise invisible — the client only ever sees a generic
      // 403. Log Cloudflare's reason (invalid-input-secret = secret/site key mismatch,
      // invalid-domain = widget hostname not allowed, timeout-or-duplicate = replay)
      // so a login failure is diagnosable from the server logs instead of a black box.
      console.warn(
        "Turnstile siteverify rejected:",
        JSON.stringify({
          status: res.status,
          errorCodes: json["error-codes"] ?? null,
          hostname: json.hostname ?? null,
        })
      );
    }

    return json.success === true && res.ok;
  } catch (error) {
    console.warn("Turnstile siteverify failed to reach Cloudflare:", (error as Error).message);

    return false;
  }
}

/**
 * The widget page the mobile WebView loads, served by this API at `GET /auth/turnstile`.
 * It lives server-side — not shipped inline in the app — because Cloudflare hostname-checks
 * the page that renders the widget against the widget's dashboard hostname list: an inline
 * `about:blank` document has no hostname and can never match, so no token would ever mint.
 * Loading the page from the API's real https hostname is what makes that check pass, and the
 * hostname registered in the Cloudflare widget settings must be the API's own (bare FQDN,
 * e.g. `atsumaru-6i3n.onrender.com`). The site key is injected from server env here, so it
 * never has to ship in the app bundle at all.
 *
 * The page self-executes once api.js is ready (with a bounded retry so the first execute
 * cannot race `api.js`), and exposes `window.__turnstileExecute` so the native side can kick
 * a fresh challenge after a token is consumed or the app returns to the foreground. Tokens
 * are posted to the React Native bridge as JSON `{ type: "token" | "expired" | "error" }`.
 */
export function turnstilePageHtml(siteKey: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onLoadTurnstile&render=explicit"></script>
</head><body style="margin:0;padding:0;background:transparent">
<div id="container"></div>
<script>
  var widgetId = null;
  var attempts = 0;
  function tryExecute() {
    // The first execute can race api.js finishing its load — retry briefly until the
    // widget exists rather than letting a lost kick leave no token at all.
    if (widgetId) { turnstile.execute(widgetId); return; }
    if (attempts++ < 40) { setTimeout(tryExecute, 250); }
  }
  function onLoadTurnstile() {
    widgetId = turnstile.render('container', {
      sitekey: '${siteKey}',
      size: 'invisible',
      callback: function (token) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token: token }));
      },
      'expired-callback': function () { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'expired' })); },
      'error-callback': function () { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error' })); }
    });
    tryExecute();
  }
  window.__turnstileExecute = tryExecute;
</script>
</body></html>`;
}
