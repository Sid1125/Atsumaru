import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { authApi } from "../../../services/api/auth";
import { getAccessToken } from "../../../services/storage/session";
import { useAuthStore } from "../../../store";

/**
 * Restores the stored session on launch and keeps the auth store in sync.
 *
 * Returns `authenticated` separately from `user`, because a signed-in account has no
 * profile row until onboarding completes — the navigator needs both facts to tell a
 * new user apart from a signed-out one.
 */
export function useSession() {
  const setUser = useAuthStore((s) => s.setUser);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped);

  const query = useQuery({
    queryKey: ["auth", "me"],
    retry: false,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return { user: null, authenticated: false };

      const { user } = await authApi.me();
      return { user, authenticated: true };
    },
  });

  useEffect(() => {
    if (query.isSuccess) {
      setUser(query.data.user ?? null);
      setAuthenticated(query.data.authenticated);
      setBootstrapped(true);
    }

    // A failed /auth/me means the stored token is dead — fall back to signed out
    // rather than stranding the user on a spinner.
    if (query.isError) {
      setUser(null);
      setAuthenticated(false);
      setBootstrapped(true);
    }
  }, [
    query.isSuccess,
    query.isError,
    query.data,
    setUser,
    setAuthenticated,
    setBootstrapped,
  ]);

  return query;
}
