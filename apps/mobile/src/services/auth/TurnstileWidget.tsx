import { useEffect, useRef } from "react";
import { AppState, View } from "react-native";

import { TURNSTILE_SITE_KEY } from "../../config/env";
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

const WIDGET_HTML = (siteKey: string) => `
<!doctype html><html><head><meta charset="utf-8">
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
</body></html>
`;

const EXECUTE_JS =
  "(function(){ try{ if (window.__turnstileExecute) window.__turnstileExecute(); }catch(e){} })(); true;";

/**
 * The client half of the Cloudflare Turnstile auth gate (docs/SECURITY_AUDIT.md §22),
 * mounted only on the email auth screen. Google/LINE OAuth codes are exempt from the
 * gate — they already travelled through a provider round trip — so this widget exists
 * for the direct-hit email surfaces: login, signup and password reset.
 *
 * Renders an invisible, managed Turnstile widget inside a WebView and forwards each
 * freshly-minted token to `turnstileToken.ts`. Turnstile's invisible mode auto-solves
 * the challenge without a visible puzzle for low-risk sessions, so a normal login is
 * never interrupted; a challenged session shows its own interstitial.
 *
 * Cloudflare requires DOM storage for the widget to fingerprint and solve
 * (developers.cloudflare.com/turnstile mobile-implementation), and react-native-webview
 * defaults `domStorageEnabled` to false on Android — without it no token is ever minted.
 * The widget also re-executes when the app returns to the foreground, so a token is
 * fresh even after the app was backgrounded mid-flow.
 *
 * Rendering a zero-sized WebView keeps it out of the layout. The widget is a native
 * module, so this only works in a dev build (`expo run:android` / the release APK) —
 * in Expo Go it renders nothing and `acquireTurnstileToken` degrades.
 */
export function TurnstileWidget() {
  const webviewRef = useRef<unknown>(null);
  const loadedRef = useRef(false);

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
        source={{ html: WIDGET_HTML(TURNSTILE_SITE_KEY) }}
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
        onLoad={() => {
          // Run the first challenge once the widget script is ready, before the user
          // finishes typing; subsequent tokens come on each consume.
          if (!loadedRef.current) {
            loadedRef.current = true;
            try {
              (webviewRef.current as any)?.injectJavaScript?.(EXECUTE_JS);
            } catch {
              /* best effort */
            }
          }
        }}
        androidLayerType="none"
        style={{ width: 1, height: 1, opacity: 0.01 }}
      />
    </View>
  );
}