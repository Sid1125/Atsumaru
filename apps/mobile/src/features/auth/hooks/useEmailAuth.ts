import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { authApi } from "../../../services/api/auth";
import { acquireTurnstileToken } from "../../../services/auth/turnstile";
import { useAuthStore } from "../../../store";

export type EmailAuthMode = "login" | "signup" | "reset" | "resetComplete";

/**
 * Email/password auth (docs/TRD.md §17). Login mints a handoff code and redeems it
 * through the same POST /auth/session path OAuth uses, so the store always receives a
 * token from exactly one endpoint. Signup sends a confirmation email (no tokens);
 * "sent: true" just means the email was dispatched — the user must confirm, then log in.
 */
export function useEmailAuth() {
  const [pending, setPending] = useState<EmailAuthMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const signIn = useAuthStore((s) => s.signIn);
  const queryClient = useQueryClient();

  const login = useCallback(
    async (email: string, password: string) => {
      setPending("login");
      setError(null);
      setInfo(null);
      try {
        const turnstileToken = await acquireTurnstileToken();
        const { code } = await authApi.login(email, password);
        const session = await authApi.session(code, turnstileToken);
        await signIn(session.access_token, session.user);
        await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed.");
      } finally {
        setPending(null);
      }
    },
    [signIn, queryClient]
  );

  const signup = useCallback(async (email: string, password: string) => {
    setPending("signup");
    setError(null);
    setInfo(null);
    try {
      const turnstileToken = await acquireTurnstileToken();
      await authApi.signup(email, password, turnstileToken);
      setInfo("A confirmation email has been sent. Confirm it, then sign in.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-up failed.");
    } finally {
      setPending(null);
    }
  }, []);

  const requestReset = useCallback(async (email: string) => {
    setPending("reset");
    setError(null);
    setInfo(null);
    try {
      const turnstileToken = await acquireTurnstileToken();
      await authApi.requestPasswordReset(email, turnstileToken);
      setInfo("If that email has an account, a reset link is on its way.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the reset email.");
    } finally {
      setPending(null);
    }
  }, []);

  const completeReset = useCallback(async (tokenHash: string, password: string) => {
    setPending("resetComplete");
    setError(null);
    setInfo(null);
    try {
      await authApi.completePasswordReset(tokenHash, password);
      setInfo("Password updated. Sign in with your new password.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the password.");
    } finally {
      setPending(null);
    }
  }, []);

  return { pending, error, info, login, signup, requestReset, completeReset };
}
