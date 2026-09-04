import { api } from "./client";
import type { User } from "../../types/api";

export const authApi = {
  /** `user` is null between OAuth and finishing onboarding (docs/API_STRUCTURE.md §3.1). */
  me: () => api.get<{ user: User | null }>("/auth/me"),

  logout: () => api.post<{ success: boolean }>("/auth/logout"),

  /**
   * Second half of the deep-link OAuth flow: the callback redirects to
   * `atsumaru://auth?code=…` and the app trades that one-time code for the session.
   * `turnstileToken` is required only for email-origin codes once the server has Turnstile
   * configured (§22) — OAuth codes pass through without one.
   */
  session: (code: string, turnstileToken?: string) =>
    api.post<{
      access_token: string;
      refresh_token: string;
      user: User | null;
      is_new: boolean;
    }>("/auth/session", { code, ...(turnstileToken ? { turnstile_token: turnstileToken } : {}) }),

  /** Email/password signup (docs/TRD.md §17). Emails a confirmation link; no tokens yet. */
  signup: (email: string, password: string, turnstileToken?: string) =>
    api.post<{ sent: boolean }>("/auth/signup", {
      email,
      password,
      ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
    }),

  /**
   * Email/password sign-in. Returns a single-use handoff code, not tokens — the caller
   * redeems it via `session(code)` so only that endpoint ever delivers tokens.
   */
  login: (email: string, password: string) =>
    api.post<{ code: string }>("/auth/login", { email, password }),

  /** Sends a password-reset email. Always reports sent (anti-enumeration). */
  requestPasswordReset: (email: string, turnstileToken?: string) =>
    api.post<{ sent: boolean }>("/auth/password/reset", {
      email,
      ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
    }),

  /** Exchanges the recovery-link token for a session and sets a new password. */
  completePasswordReset: (tokenHash: string, password: string) =>
    api.post<{ done: boolean }>("/auth/password/reset-complete", {
      token_hash: tokenHash,
      password,
    }),

  /** Registers this device for meetup and feedback notifications. */
  registerPushToken: (token: string, platform?: "android" | "ios") =>
    api.post<{ success: boolean }>("/users/me/push-token", { token, platform }),
};

