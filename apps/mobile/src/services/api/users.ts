import { api } from "./client";
import type { Coords, Language, User } from "../../types/api";

export const usersApi = {
  me: () => api.get<{ user: User }>("/users/me"),

  /** Public projection only — the server never returns another user's `real_name`. */
  byId: (id: string) => api.get<{ user: User }>(`/users/${id}`),

  updateMe: (payload: {
    handle?: string;
    display_name?: string;
    avatar_url?: string | null;
    interests?: string[];
    personality?: string[];
    language?: Language;
    location?: Coords;
  }) => api.patch<{ user: User }>("/users/me", payload),

  /** Profile photo — a base64 jpeg/png/webp data URL (server caps it at 5 MB). */
  uploadAvatar: (dataUrl: string) =>
    api.post<{ user: User }>("/users/me/avatar", { data_url: dataUrl }),
};
