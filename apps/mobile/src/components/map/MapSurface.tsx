import { InteractiveMap } from "./InteractiveMap";
import { MapboxMap } from "./MapboxMap";
import { hasMapbox } from "./mapbox";
import type { Coords, MeetupEvent } from "../../types/api";

export interface MapSurfaceProps {
  events: MeetupEvent[];
  selectedId: string | null;
  onSelect: (eventId: string) => void;
  onOpen: (eventId: string) => void;
  /**
   * Fired when a *user-driven* camera move settles, so discovery can refetch for
   * the new area (docs/FRONTEND.md §9). Only the Mapbox surface can raise it: the
   * vector city models a fixed slice of Shibuya, so panning it never reveals
   * anywhere new to query.
   */
  onRegionSettled?: (center: Coords) => void;
}

/**
 * Which map Discover gets.
 *
 * `hasMapbox()` is the whole decision, and it is one branch — exactly like the
 * demo-mode switch in `services/api/client.ts`. Both surfaces take the same props
 * and draw the same `PinBody`, so selection, opening a meetup and the pin's own
 * behaviour are identical either way; what changes is the ground underneath.
 *
 * The fallback is not a degraded state. `InteractiveMap` is a hand-authored vector
 * city with real streets, gestures and momentum, and it is what runs in Expo Go —
 * where Mapbox's native module does not exist at all. Configuring a token in a dev
 * build promotes the ground to real tiles; nothing else about the screen moves.
 */
export function MapSurface(props: MapSurfaceProps) {
  if (hasMapbox()) return <MapboxMap {...props} />;

  return (
    <InteractiveMap
      events={props.events}
      selectedId={props.selectedId}
      onSelect={props.onSelect}
      onOpen={props.onOpen}
    />
  );
}
