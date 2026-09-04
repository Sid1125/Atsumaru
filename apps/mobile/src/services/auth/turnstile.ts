/**
 * Client half of the Cloudflare Turnstile auth gate (docs/SECURITY_AUDIT.md §22), used by
 * the email auth flows only — Google/LINE OAuth codes are exempt server-side, so no widget
 * token travels the deep-link handoff.
 *
 * The email hook calls `acquireTurnstileToken()` right before the server call. The actual
 * widget lives in `TurnstileWidget.tsx` (a native WebView — rendered only in a dev build /
 * the release APK); it mints tokens into `turnstileToken.ts`. This module is the thin,
 * imperative entry point the hooks already use: it returns whatever the widget currently
 * holds. In Expo Go the widget never mounts and this returns undefined, which the server
 * (only configured with a secret key on real deployments) would reject — so email auth on
 * the webview-less client surfaces the server's `CAPTCHA_FAILED` explicitly rather than
 * failing silently, and the site key is what turns the flow on.
 */
import { TURNSTILE_SITE_KEY } from "../../config/env";
import { takeTurnstileToken } from "./turnstileToken";

/**
 * Best-effort: returns a widget-minted Turnstile token ready to send as `turnstile_token`,
 * or undefined when the widget is not configured/available. Never throws — a missing
 * widget must not crash sign-in (it degrades to the server's own decision).
 */
export async function acquireTurnstileToken(): Promise<string | undefined> {
  if (!TURNSTILE_SITE_KEY) return undefined;
  return takeTurnstileToken();
}
