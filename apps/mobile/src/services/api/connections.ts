import { api } from "./client";
import type { Connection, ConnectionWithProfile, Message, MessagePage } from "../../types/api";

export const connectionsApi = {
  list: () => api.get<{ connections: ConnectionWithProfile[] }>("/connections"),

  profile: (id: string) => api.get<{ profile: import("../../types/api").User }>(`/connections/${id}/profile`),

  messages: (id: string, page = 1, limit = 30) =>
    api.get<MessagePage>(`/connections/${id}/messages`, {
      page,
      limit,
    }),

  sendMessage: (id: string, message: string) =>
    api.post<{ message: Message }>(`/connections/${id}/messages`, { message }),
};
