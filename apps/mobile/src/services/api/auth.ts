import { api } from "./client";
import type { User } from "../../types/api";

export const authApi = {
  me: () => api.get<{ user: User }>("/auth/me"),
  logout: () => api.post<{ success: boolean }>("/auth/logout"),
};
