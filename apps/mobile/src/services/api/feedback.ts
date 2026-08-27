import { api } from "./client";
import type { Connection, GroupMember, Rating } from "../../types/api";

export const feedbackApi = {
  form: (eventId: string) =>
    api.get<{ members: GroupMember[] }>(`/events/${eventId}/feedback-form`),

  // Ratings and connection picks are private; the server decides what unlocks.
  submit: (
    eventId: string,
    payload: {
      ratings: { to_user: string; rating: Rating }[];
      rejoin: boolean;
      connect_with?: string[];
    }
  ) =>
    api.post<{ success: boolean; connections_unlocked: Connection[] }>(
      `/events/${eventId}/feedback`,
      payload
    ),
};
