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

  if (!token) {
    // Distinguish "no token presented" from "token rejected": a widget that failed to
    // mint (network, WebView quirk, or a challenge that needed interaction it could not
    // show) is otherwise invisible — the client only ever reports the generic 403.
    console.warn("Turnstile gate: no token presented (the widget failed to mint one).");
    return false;
  }

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
 * The page renders a VISIBLE widget. It must render in the widget's **Managed** mode
 * (a dashboard setting on the widget — not a render option): Managed auto-passes a trusted
 * session silently, and when Cloudflare decides more proof is needed it shows a checkbox the
 * visitor ticks. Invisible/Non-Interactive widgets can never present that checkbox, so on a
 * network Cloudflare distrusts (datacenter, VPN, emulator) they simply never mint a token —
 * which is exactly the failure an invisible widget in a hidden WebView produced. A Managed
 * widget only works when the visitor can see and click it, so this page is rendered at real
 * size and the native side gives it a tappable area on the auth screen.
 *
 * api.js availability is polled (bounded retry, so the first render cannot race the script
 * load), and `window.__turnstileRefresh` (reset + auto re-run) lets the native side arm the
 * next token after one is consumed or the app returns to the foreground. State is shown in a
 * status line under the widget — it doubles as the browser self-test: open this URL in a
 * normal browser and it should show the widget solving to "Verified" (or a checkbox to tick)
 * rather than an error. Tokens are posted to the React Native bridge as JSON
 * `{ type: "token" | "expired" | "timeout" | "error", ... }`.
 */
export function turnstilePageHtml(siteKey: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: transparent; }
  body { display: flex; align-items: center; justify-content: center; }
  #status { margin-top: 10px; font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #888; text-align: center; }
</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>
</head><body>
<div>
  <div id="container"></div>
  <div id="status">Verifying…</div>
</div>
<script>
  var widgetId = null;
  var tries = 0;
  function post(msg) { try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {} }
  function setStatus(text) { var el = document.getElementById('status'); if (el) el.textContent = text; }
  function refresh() { if (!widgetId) return; try { turnstile.reset(widgetId); } catch (e) {} }
  function boot() {
    if (typeof turnstile === 'undefined') {
      // api.js may still be loading — bounded retry, then a visible failure instead of a
      // silent no-token timeout on the native side.
      if (tries++ < 40) { setTimeout(boot, 250); return; }
      setStatus('Turnstile could not load — check the network, or the widget\'s hostname settings in Cloudflare.');
      return;
    }
    if (widgetId) return;
    // Managed-mode widget: runs automatically once rendered (spinner, then auto-pass or a
    // checkbox if Cloudflare wants interaction). No explicit execute() — that is only for
    // Invisible-mode widgets, which are exactly the mode that cannot mint here.
    widgetId = turnstile.render('container', {
      sitekey: '${siteKey}',
      appearance: 'light',
      callback: function (token) { setStatus('Verified'); post({ type: 'token', token: token }); },
      'expired-callback': function () { setStatus('Verification expired — re-running…'); post({ type: 'expired' }); refresh(); },
      'timeout-callback': function () { setStatus('Verification timed out — re-running…'); post({ type: 'timeout' }); refresh(); },
      'error-callback': function (code) { setStatus('Verification failed (' + (code || 'unknown') + ')'); post({ type: 'error', code: code || 'unknown' }); }
    });
  }
  window.__turnstileRefresh = refresh;
  boot();
</script>
</body></html>`;
}
