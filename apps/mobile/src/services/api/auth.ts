import { api } from "./client";
import type { User } from "../../types/api";

export const authApi = {
  /** `user` is null between OAuth and finishing onboarding (docs/API_STRUCTURE.md §3.1). */
  me: () => api.get<{ user: User | null }>("/auth/me"),

  logout: () => api.post<{ success: boolean }>("/auth/logout"),

  /**
   * Second half of the deep-link OAuth flow: the callback redirects to
   * `atsumaru://auth?code=…` and the app trades that one-time code for the session.
   */
  session: (code: string) =>
    api.post<{
      access_token: string;
      refresh_token: string;
      user: User | null;
      is_new: boolean;
    }>("/auth/session", { code }),

  /** Registers this device for meetup and feedback notifications. */
  registerPushToken: (token: string, platform?: "android" | "ios") =>
    api.post<{ success: boolean }>("/users/me/push-token", { token, platform }),
};
