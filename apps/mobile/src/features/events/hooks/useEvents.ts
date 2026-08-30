import { useQuery } from "@tanstack/react-query";

import { eventsApi } from "../../../services/api/events";
import { ApiError } from "../../../services/api/errors";
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

/**
 * The post-meetup vibe recap (docs/AI.md §6a). Only fetched once the caller could
 * actually have one — a completed meetup they are in — because the endpoint is a 409
 * before that and a 404 until they have submitted their own feedback.
 *
 * `NO_FEEDBACK_YET` is the expected pre-submission state, not a failure, so it must not
 * retry: the server is telling us the answer will not change until the user acts. The
 * recap is immutable once written, hence `staleTime: Infinity`.
 */
export function useVibeRecap(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["events", id, "recap"],
    queryFn: () => eventsApi.recap(id),
    enabled,
    staleTime: Infinity,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
  });
}
