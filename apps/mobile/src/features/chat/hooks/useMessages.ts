import { useQuery } from "@tanstack/react-query";

import { eventsApi } from "../../../services/api/events";

export function useMessages(eventId: string) {
  return useQuery({
    queryKey: ["events", eventId, "messages"],
    queryFn: () => eventsApi.messages(eventId),
  });
}
