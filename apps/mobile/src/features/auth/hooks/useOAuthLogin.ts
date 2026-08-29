import { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { API_URL, DEMO_MODE } from "../../../config/env";
import { authApi } from "../../../services/api/auth";
import { useAuthStore } from "../../../store";

type Provider = "line" | "google";

/**
 * The OAuth half that was missing entirely.
 *
 * Flow (docs/TRD.md §5, README "Authentication"):
 *   1. open `GET /api/auth/{provider}?redirect_to=app` in the browser
 *   2. the provider returns to the API's callback, which redirects to
 *      `atsumaru://auth?code=…` — a one-time code, never a token in a URL
 *   3. the app trades that code via `POST /auth/session` for the real session
 *
 * `user` comes back null for a brand-new account; the navigator reads that as
 * "authenticated, needs onboarding" rather than "signed out".
 */
export function useOAuthLogin() {
  const signIn = useAuthStore((s) => s.signIn);
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guards against the listener and the initial-URL check both claiming one code.
  const claiming = useRef(false);

  const exchange = useCallback(
    async (url: string) => {
      const code = new URL(url).searchParams.get("code");

      if (!code || claiming.current) return;

      claiming.current = true;
      setError(null);

      try {
        const session = await authApi.session(code);
        await signIn(session.access_token, session.user);
        await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed.");
      } finally {
        claiming.current = false;
        setPending(null);
      }
    },
    [signIn, queryClient]
  );

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (url.includes("://auth")) void exchange(url);
    });

    // The app may have been cold-started *by* the redirect.
    void Linking.getInitialURL().then((url) => {
      if (url && url.includes("://auth")) void exchange(url);
    });

    return () => subscription.remove();
  }, [exchange]);

  const start = useCallback(
    async (provider: Provider) => {
      setError(null);
      setPending(provider);

      // Demo mode has no provider to visit: mint the session directly through the
      // same `POST /auth/session` path the real flow ends on.
      if (DEMO_MODE) {
        try {
          const session = await authApi.session("demo");
          await signIn(session.access_token, session.user);
          await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Sign-in failed.");
        } finally {
          setPending(null);
        }
        return;
      }

      try {
        await Linking.openURL(`${API_URL}/auth/${provider}?redirect_to=app`);
      } catch {
        setError("Could not open the sign-in page.");
        setPending(null);
      }
    },
    [signIn, queryClient]
  );

  return { start, pending, error };
}
