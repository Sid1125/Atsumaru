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
/**
 * Email auth.
 *
 * `error` and `info` are **i18n keys**, not sentences: this hook is not a
 * component so it has no `t`, and returning English here violated
 * docs/RULES.md §12 ("all user-facing text must come from translation
 * resources"). The screen translates them.
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
        setError("auth.loginFailed");
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
      setInfo("auth.confirmSent");
    } catch (e) {
      setError("auth.signupFailed");
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
      setInfo("auth.resetSent");
    } catch (e) {
      setError("auth.resetFailed");
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
      setInfo("auth.passwordUpdated");
    } catch (e) {
      setError("auth.resetCompleteFailed");
    } finally {
      setPending(null);
    }
  }, []);

  return { pending, error, info, login, signup, requestReset, completeReset };
}
