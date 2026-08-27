import { useQuery } from "@tanstack/react-query";

import { feedbackApi } from "../../../services/api/feedback";

export function useFeedbackForm(eventId: string, enabled = true) {
  return useQuery({
    queryKey: ["events", eventId, "feedback-form"],
    enabled,
    queryFn: () => feedbackApi.form(eventId),
  });
}
