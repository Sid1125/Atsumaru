import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { authApi } from "../../../services/api/auth";
import { getAccessToken } from "../../../services/storage/session";
import { useAuthStore } from "../../../store";

/** Restores the stored session on launch and keeps the auth store in sync. */
export function useSession() {
  const setUser = useAuthStore((s) => s.setUser);
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped);

  const query = useQuery({
    queryKey: ["auth", "me"],
    retry: false,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return { user: null };
      return authApi.me();
    },
  });

  useEffect(() => {
    if (query.isSuccess) {
      setUser(query.data.user ?? null);
      setBootstrapped(true);
    }

    if (query.isError) {
      setUser(null);
      setBootstrapped(true);
    }
  }, [query.isSuccess, query.isError, query.data, setUser, setBootstrapped]);

  return query;
}
