import { useEffect, useRef } from "react";
import { AppState, StyleSheet, View } from "react-native";

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
// renders a VISIBLE widget and exposes window.__turnstileRefresh, which this side calls to
// arm the next token after a consume or on foreground.
const TURNSTILE_PAGE_URL = `${API_URL}/auth/turnstile`;

const REFRESH_JS =
  "(function(){ try{ if (window.__turnstileRefresh) window.__turnstileRefresh(); }catch(e){} })(); true;";

/**
 * The client half of the Cloudflare Turnstile auth gate (docs/SECURITY_AUDIT.md §22),
 * mounted only on the email auth screen. Google/LINE OAuth codes are exempt from the
 * gate — they already travelled through a provider round trip — so this widget exists
 * for the direct-hit email surfaces: login, signup and password reset.
 *
 * Renders the API-served widget page (`server/src/modules/auth/turnstile.ts
 * turnstilePageHtml`) at a visible, tappable size and forwards each freshly-minted token
 * to `turnstileToken.ts`. The widget's Cloudflare mode must be **Managed** (dashboard
 * setting, not a render option): a trusted session auto-passes silently, and when
 * Cloudflare wants more proof it shows a checkbox the visitor ticks. Invisible/Non-
 * Interactive widgets can never present that checkbox, so on a network Cloudflare
 * distrusts (datacenter, VPN, emulator) they never mint a token at all — the failure this
 * whole flow kept hitting. A Managed widget needs to be seen and clicked, which is why
 * this is a real, interactive WebView area in the form rather than a hidden one.
 *
 * The page re-arms (reset) when the app returns to the foreground, so a token is fresh
 * even after the app was backgrounded mid-flow.
 *
 * The widget is a native module, so this only works in a dev build (`expo run:android` /
 * the release APK) — in Expo Go it renders nothing and `acquireTurnstileToken` degrades.
 */
export function TurnstileWidget() {
  const webviewRef = useRef<unknown>(null);

  useEffect(() => {
    setTurnstileTokenHandler(() => {
      // A token was consumed by an auth attempt; arm the widget to mint the next one so
      // the following attempt has a fresh token. Turnstile tokens are single-use.
      try {
        (webviewRef.current as any)?.injectJavaScript?.(REFRESH_JS);
      } catch {
        /* best effort */
      }
    });

    // Re-arm whenever the app comes back to the foreground: a token minted before the
    // backgrounding may have aged out, and a paused challenge needs a kick.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        try {
          (webviewRef.current as any)?.injectJavaScript?.(REFRESH_JS);
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
    <View style={styles.host} accessible accessibilityLabel="Human verification">
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
            } else if (msg.type === "error" || msg.type === "expired" || msg.type === "timeout") {
              clearToken();
            }
          } catch {
            /* ignore malformed frames */
          }
        }}
        onError={(event: { nativeEvent?: { description?: string; url?: string } }) =>
          console.warn(
            "Turnstile page failed to load:",
            event.nativeEvent?.description ?? "unknown",
            event.nativeEvent?.url ?? ""
          )
        }
        onHttpError={(event: { nativeEvent?: { statusCode?: number } }) =>
          console.warn("Turnstile page HTTP error:", event.nativeEvent?.statusCode)
        }
        onConsoleMessage={(event: { nativeEvent?: { message?: string; source?: string } }) =>
          console.warn("Turnstile page console:", event.nativeEvent?.message ?? "")
        }
        style={styles.webview}
      />
    </View>
  );
}

// The Managed widget is ~65px tall but expands when Cloudflare shows an interactive
// challenge, and the page's status line sits under it — give the area enough room for the
// expanded state (it scrolls inside the WebView if a puzzle ever needs more).
const styles = StyleSheet.create({
  host: {
    width: "100%",
    height: 220,
    marginVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  webview: { flex: 1, backgroundColor: "#ffffff" },
});
