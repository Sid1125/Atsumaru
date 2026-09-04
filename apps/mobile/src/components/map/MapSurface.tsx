import { forwardRef } from "react";

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
  /**
   * The member's own position, once a fix has been taken. Used to draw the search radius;
   * neither surface moves the camera on its own because of it.
   */
  userLocation?: Coords | null;
  /** Radius of that ring, in kilometres — the same distance the nearby query uses. */
  radiusKm?: number;
}

/**
 * What a caller can ask the map to do after it has mounted.
 *
 * Kept to the one verb that cannot be expressed as a prop: "put this coordinate back in
 * view". Everything else about both surfaces is driven declaratively, and should stay that
 * way — an imperative handle is the exception, not a second API.
 */
export interface MapSurfaceHandle {
  recenter: (coords: Coords) => void;
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
export const MapSurface = forwardRef<MapSurfaceHandle, MapSurfaceProps>(
  function MapSurface(props, ref) {
    if (hasMapbox()) return <MapboxMap ref={ref} {...props} />;

    /**
     * No radius ring on the vector city, and this is a measurement rather than an
     * oversight: it models a 3.35 x 3.33 km slice of Shibuya, so a 5 km *radius* wants
     * 10 km across — three times the entire modelled world. Its minimum zoom shows the
     * whole 1400-unit world and no further, so the ring's edge is unreachable at every
     * zoom and all that would render is a flat tint over everything, which reads as a bug
     * rather than a radius.
     *
     * The renderers already differ where the medium demands it (`counterScale` on the pins,
     * `onRegionSettled` only from Mapbox). This is the same kind of difference.
     */
    return (
      <InteractiveMap
        ref={ref}
        events={props.events}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
        onOpen={props.onOpen}
      />
    );
  }
);
