import { useEffect, useRef } from "react";
import { AppState, View } from "react-native";

import { API_URL } from "../../config/env";
import { setTurnstileTokenHandler, setToken, clearToken } from "./turnstileToken";

// `react-native-webview` is a native module — Expo Go cannot load it, so a
// module-scope `import` kills the bundle, exactly like `mapbox.ts`/`keystore.ts`.
// Deferred `require` + the native-module guard keep the auth screen alive in Expo Go,
// where the widget simply never renders (and the server, unconfigured there anyway,
// accepts the missing token).
declare const require: (name: string) => unknown;

let WebViewComponent: unknown = null;
try {
  WebViewComponent = (require("react-native-webview") as unknown as {
    WebView: React.ComponentType;
  }).WebView;
} catch {
  WebViewComponent = null;
}

// The widget page is served by the API at GET /api/auth/turnstile, not shipped inline.
// Cloudflare hostname-checks the page that renders the widget against the widget's
// dashboard hostname list, and an inline `about:blank` document has no hostname to match
// — loading a real https URL on the API's own host is what makes the check pass. The page
// self-executes once api.js is ready and exposes window.__turnstileExecute, which this
// side calls to mint the next token after a consume or on foreground.
const TURNSTILE_PAGE_URL = `${API_URL}/auth/turnstile`;

const EXECUTE_JS =
  "(function(){ try{ if (window.__turnstileExecute) window.__turnstileExecute(); }catch(e){} })(); true;";

/**
 * The client half of the Cloudflare Turnstile auth gate (docs/SECURITY_AUDIT.md §22),
 * mounted only on the email auth screen. Google/LINE OAuth codes are exempt from the
 * gate — they already travelled through a provider round trip — so this widget exists
 * for the direct-hit email surfaces: login, signup and password reset.
 *
 * Renders an invisible, managed Turnstile widget inside a WebView loading the API-served
 * widget page (`server/src/modules/auth/turnstile.ts turnstilePageHtml`) and forwards each
 * freshly-minted token to `turnstileToken.ts`. Turnstile's invisible mode auto-solves the
 * challenge without a visible puzzle for low-risk sessions, so a normal login is never
 * interrupted; a challenged session shows its own interstitial.
 *
 * The widget page re-executes when the app returns to the foreground, so a token is fresh
 * even after the app was backgrounded mid-flow.
 *
 * Rendering a zero-sized WebView keeps it out of the layout. The widget is a native
 * module, so this only works in a dev build (`expo run:android` / the release APK) —
 * in Expo Go it renders nothing and `acquireTurnstileToken` degrades.
 */
export function TurnstileWidget() {
  const webviewRef = useRef<unknown>(null);

  useEffect(() => {
    setTurnstileTokenHandler(() => {
      // A token was consumed by an auth attempt; mint the next one so the following
      // attempt has a fresh token. Turnstile tokens are single-use + short-lived.
      try {
        (webviewRef.current as any)?.injectJavaScript?.(EXECUTE_JS);
      } catch {
        /* best effort */
      }
    });

    // Re-execute whenever the app comes back to the foreground: the challenge may have
    // been paused or torn down while backgrounded, and a token minted before the
    // backgrounding may have aged out. Cheap — execute is idempotent.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        try {
          (webviewRef.current as any)?.injectJavaScript?.(EXECUTE_JS);
        } catch {
          /* best effort */
        }
      }
    });

    return () => {
      setTurnstileTokenHandler(undefined);
      sub.remove();
    };
  }, []);

  if (!WebViewComponent) return null;

  const WebView = WebViewComponent as React.ComponentType<any>;

  return (
    <View pointerEvents="none" style={{ width: 0, height: 0, overflow: "hidden" }}>
      <WebView
        ref={webviewRef as any}
        originWhitelist={["*"]}
        source={{ uri: TURNSTILE_PAGE_URL }}
        javaScriptEnabled
        javaScriptCanOpenWindowsAutomatically={false}
        domStorageEnabled
        onMessage={(event: { nativeEvent: { data: string } }) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg.type === "token" && msg.token) {
              setToken(msg.token);
            } else if (msg.type === "error" || msg.type === "expired") {
              clearToken();
            }
          } catch {
            /* ignore malformed frames */
          }
        }}
        androidLayerType="none"
        style={{ width: 1, height: 1, opacity: 0.01 }}
      />
    </View>
  );
}
