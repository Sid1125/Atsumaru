import { api } from "./client";
import type {
  Coords,
  GroupMember,
  MatchPreview,
  MeetupEvent,
  Message,
  MessagePage,
  VibeRecap,
} from "../../types/api";

export const eventsApi = {
  nearby: (params: { lat: number; lng: number; radius?: number; category?: string }) =>
    api.get<{ events: MeetupEvent[] }>("/events/nearby", {
      radius: 5000,
      ...params,
    }),

  detail: (id: string) =>
    api.get<{ event: MeetupEvent; members: GroupMember[] }>(`/events/${id}`),

  mine: () => api.get<{ events: MeetupEvent[] }>("/events/mine"),

  create: (payload: {
    title: string;
    category: string;
    /** Optional server-side (`createSchema` in modules/events/routes.ts). */
    description?: string;
    venue_name: string;
    location: Coords;
    start_time: string;
    max_size: number;
  }) => api.post<{ event: MeetupEvent }>("/events", payload),

  join: (id: string) =>
    api.post<{ status: "joined" | "matched"; group_id: string }>(
      `/events/${id}/join`
    ),

  leave: (id: string) => api.post<{ success: boolean }>(`/events/${id}/leave`),

  members: (id: string) =>
    api.get<{ members: GroupMember[] }>(`/events/${id}/members`),

  matchPreview: (id: string) =>
    api.get<MatchPreview>(`/events/${id}/match-preview`),

  /** 404 `NO_FEEDBACK_YET` until the caller has submitted their own feedback. */
  recap: (id: string) => api.get<VibeRecap>(`/events/${id}/recap`),

  messages: (id: string, page = 1, limit = 30) =>
    api.get<MessagePage>(`/events/${id}/messages`, { page, limit }),

  sendMessage: (id: string, message: string) =>
    api.post<{ message: Message }>(`/events/${id}/messages`, { message }),
};
