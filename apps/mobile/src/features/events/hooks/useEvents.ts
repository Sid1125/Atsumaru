import { useQuery } from "@tanstack/react-query";

import { eventsApi } from "../../../services/api/events";
import type { Coords } from "../../../types/api";

export function useNearbyEvents(coords: Coords | null, category?: string | null) {
  return useQuery({
    queryKey: ["events", "nearby", coords?.lat, coords?.lng, category],
    enabled: !!coords,
    queryFn: () =>
      eventsApi.nearby({
        lat: coords!.lat,
        lng: coords!.lng,
        category: category ?? undefined,
      }),
    staleTime: 60_000,
  });
}

/**
 * Meetups the user hosts or joined, including finished ones. `/events/mine` and
 * `eventsApi.mine()` both existed with nothing rendering them, which left a completed
 * meetup reachable only through the feedback push — and therefore unreachable at all
 * on a device that cannot receive one.
 */
export function useMyEvents() {
  return useQuery({
    queryKey: ["events", "mine"],
    queryFn: () => eventsApi.mine(),
    staleTime: 30_000,
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: ["events", id],
    queryFn: () => eventsApi.detail(id),
  });
}

export function useEventMembers(id: string) {
  return useQuery({
    queryKey: ["events", id, "members"],
    queryFn: () => eventsApi.members(id),
  });
}

export function useMatchPreview(id: string) {
  return useQuery({
    queryKey: ["events", id, "match-preview"],
    queryFn: () => eventsApi.matchPreview(id),
  });
}
