import { useCallback, useEffect, useRef, useState } from "react";

import {
  hasPlaceSearch,
  newSearchSession,
  retrievePlace,
  suggestPlaces,
  type PlaceSuggestion,
  type ResolvedPlace,
} from "../../services/places";
import type { Coords } from "../../types/api";

/**
 * Debounced place lookup for the create-event venue field.
 *
 * 400 ms matches the two hand-rolled debounces already in the app (the handle check in
 * `ProfileConfirmScreen` and `ProfileEditModal`) — the same reflex, and worth keeping
 * uniform so typeahead latency feels like one app rather than three.
 *
 * The debounce is not only about request volume here. Mapbox bills Search Box per *session*,
 * and one session covers a whole typeahead, so the cost of a keystroke is latency and quota
 * pressure rather than money — but a request per character would still be rude to an API with
 * a rate limit, and it makes the list flicker.
 *
 * One session per hook instance, minted on mount and reused for every suggest *and* the
 * retrieve that follows, which is what keeps the whole interaction billable as one unit.
 */
const DEBOUNCE_MS = 400;

interface PlaceSearchState {
  results: PlaceSuggestion[];
  searching: boolean;
  /** False when there is no token; the caller should fall back to a plain venue name. */
  available: boolean;
}

export function usePlaceSearch(query: string, near?: Coords | null) {
  const [state, setState] = useState<PlaceSearchState>({
    results: [],
    searching: false,
    available: hasPlaceSearch(),
  });

  const session = useRef(newSearchSession());
  /** Guards against a slow response for an old query overwriting a newer one. */
  const latest = useRef(0);

  useEffect(() => {
    if (!hasPlaceSearch()) return;

    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setState((prev) => ({ ...prev, results: [], searching: false }));
      return;
    }

    setState((prev) => ({ ...prev, searching: true }));

    const ticket = latest.current + 1;
    latest.current = ticket;

    const timer = setTimeout(() => {
      void suggestPlaces(trimmed, session.current, near).then((results) => {
        // A later keystroke already fired; its answer is the one that counts.
        if (latest.current !== ticket) return;

        setState((prev) => ({ ...prev, results, searching: false }));
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // `near` is intentionally read but not depended on: re-running every search because the
    // location fix arrived would restart the typeahead mid-word. Proximity is a ranking
    // hint, so using a slightly stale one is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  /** Resolves a picked suggestion to coordinates, on the same billing session. */
  const resolve = useCallback(
    (id: string): Promise<ResolvedPlace | null> => retrievePlace(id, session.current),
    []
  );

  const clear = useCallback(() => {
    latest.current += 1;
    setState((prev) => ({ ...prev, results: [], searching: false }));
  }, []);

  return { ...state, resolve, clear };
}
