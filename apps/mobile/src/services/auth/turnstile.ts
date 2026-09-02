/**
 * Client half of the Cloudflare Turnstile auth gate (docs/ATSUMARU_SECURITY_COMPLETE §22).
 *
 * The server only challenges `POST /auth/session` when TURNSTILE_SECRET_KEY is set, so
 * the client must present a widget-minted token exactly then. This file is the single
 * place that touches the widget, mirroring the `mapbox.ts` / `keystore.ts` convention:
 * when neither a site key nor the native WebView module is present, it degrades to
 * "no token", which the server (also unconfigured) accepts.
 *
 * A real Turnstile widget needs `react-native-webview` and a dev build, and neither
 * exists here yet — Expo Go can never load it. So like Mapbox and the Keystore, this
 * path is written but has never run; `acquireTurnstileToken` returns undefined until a
 * site key AND the native module are both present.
 */
import { TURNSTILE_SITE_KEY } from "../../config/env";

declare const require: (name: string) => unknown;

let webview: unknown = null;
try {
  webview = require("react-native-webview");
} catch {
  webview = null;
}

/**
 * Best-effort: returns a Turnstile token ready to send as `turnstile_token`, or
 * undefined when Turnstile is not configured/available. Never throws — a missing
 * widget must not block sign-in (the server skips the check when unconfigured).
 */
export async function acquireTurnstileToken(): Promise<string | undefined> {
  if (!TURNSTILE_SITE_KEY) return undefined;
  // ponytail: real widget acquisition needs react-native-webview + dev build. Returning
  // undefined keeps the flow working until that integration lands (same status as Mapbox
  // / Keystore — written, unexercised). See docs/SECURITY_AUDIT.md §22.
  if (!webview) return undefined;
  return undefined;
}
