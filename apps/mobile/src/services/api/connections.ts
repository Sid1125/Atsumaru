import { api } from "./client";
import type { Connection, Message } from "../../types/api";

export const connectionsApi = {
  list: () => api.get<{ connections: Connection[] }>("/connections"),

  messages: (id: string, page = 1, limit = 30) =>
    api.get<{ messages: Message[] }>(`/connections/${id}/messages`, {
      page,
      limit,
    }),

  sendMessage: (id: string, message: string) =>
    api.post<{ message: Message }>(`/connections/${id}/messages`, { message }),
};
