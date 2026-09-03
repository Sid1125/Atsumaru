import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
// Type-only: erased at compile time, so this does *not* load the native module.
// `components/map/mapbox.ts` is the only place that may require it for real.
import type { Camera as CameraRef, MapState } from "@rnmapbox/maps";

import { PinBody, PIN_BOX, PIN_POINT_Y } from "./PinBody";
import { CENTER } from "./geo";
import {
  CHROME_HEIGHT,
  EXPOSED_FRACTION,
  SHEET_MAX_EXPOSURE,
} from "./framing";
import { loadMapbox } from "./mapbox";
import { radiusFeature } from "./radius";
import type { MapSurfaceHandle } from "./MapSurface";
import { colors, spacing } from "../../theme";
import type { Coords, MeetupEvent } from "../../types/api";

interface MapboxMapProps {
  events: MeetupEvent[];
  selectedId: string | null;
  onSelect: (eventId: string) => void;
  onOpen: (eventId: string) => void;
  /**
   * Called once the camera has come to rest after a *user* gesture, with the new
   * centre — the "camera settles → request nearby events" shape docs/FRONTEND.md
   * §9 asks for. Programmatic camera moves never fire it, so framing the pins
   * cannot feed itself a fetch.
   */
  onRegionSettled?: (center: Coords) => void;
  /** The member's own position, once a fix has been taken. Draws the radius ring. */
  userLocation?: Coords | null;
  /** Radius of that ring, in kilometres. */
  radiusKm?: number;
}

/** Zoom the map opens at: tight enough that Shibuya reads as a place. */
const INITIAL_ZOOM = 14.2;

/**
 * Floor on the size of a fitted box. Meetups can sit within a block of each
 * other, and fitting that literally would open on a pavement — this is also what
 * keeps the fit from zooming past anything useful, since `setCamera` bounds carry
 * no zoom ceiling of their own.
 */
const MIN_SPAN_LAT = 0.008;
const MIN_SPAN_LNG = 0.0098;

/** Zoom used when recentring on a selected meetup. */
const SELECTION_ZOOM = 15.4;

/** Metres the centre must move before a settle is worth a refetch. */
const REFETCH_THRESHOLD_M = 400;

/** Equirectangular approximation — accurate well past city scale. */
function metresBetween(a: Coords, b: Coords): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const meanLat = (((a.lat + b.lat) / 2) * Math.PI) / 180;
  const x = dLng * Math.cos(meanLat);

  return Math.sqrt(dLat * dLat + x * x) * R;
}

/**
 * Discover's map when Mapbox is available: a real, tiled, worldwide basemap
 * (docs/TRD.md §12).
 *
 * The pins are the same `PinBody` the vector city draws, hung on `MarkerView`s, so
 * switching renderer changes the ground under the pins and nothing else. No
 * counter-scaling here — Mapbox positions annotations in screen space itself and
 * leaves their size alone; that problem belongs to the vector map, whose pins live
 * inside the transformed container.
 *
 * Camera padding is the detail that makes it fit this screen: Discover floats
 * chrome over the top of the map and rests a sheet on the bottom, so "centre" for
 * framing purposes is the middle of the exposed band, not of the view. Telling
 * Mapbox that directly is cleaner than biasing every target coordinate, and it is
 * the same measurement the vector map clamps its pan against (`framing.ts`).
 */
export const MapboxMap = forwardRef<MapSurfaceHandle, MapboxMapProps>(
  function MapboxMap(
    { events, selectedId, onSelect, onOpen, onRegionSettled, userLocation, radiusKm },
    ref
  ) {
  // Non-null by construction: `MapSurface` only mounts this once the module loaded.
  const Mapbox = loadMapbox()!;

  const { i18n } = useTranslation();
  const camera = useRef<CameraRef>(null);
  const [height, setHeight] = useState(0);

  /**
   * Set the moment a camera change is attributed to the user's fingers, and never
   * cleared. Two things hang off it: a settle only becomes a refetch after a real
   * gesture, and auto-framing stops once the user has taken over — re-framing
   * someone's hand-panned view because a fetch returned a different set would be
   * the map fighting them.
   */
  const userMoved = useRef(false);
  /** Centre of the last settle reported, so small drifts do not refetch. */
  const lastReported = useRef<Coords | null>(null);
  /** Event-id signature the camera was last framed for. */
  const framedFor = useRef("");

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setHeight(event.nativeEvent.layout.height);
  }, []);

  /**
   * The exposed band, expressed as camera padding. The bottom inset is what the
   * sheet covers at its default "half" detent, not at full — content stays framed
   * for what is actually on screen without treating the expanded sheet as
   * permanent.
   */
  const padding = useMemo(
    () => ({
      paddingTop: CHROME_HEIGHT,
      paddingBottom: height * (1 - EXPOSED_FRACTION),
      paddingLeft: spacing.lg,
      paddingRight: spacing.lg,
    }),
    [height]
  );

  /**
   * Mapbox's attribution and wordmark are a licence condition, so they cannot be
   * hidden — they are lifted clear of the sheet's deepest resting position
   * instead, where they stay legible.
   */
  const ornamentPosition = useMemo(
    () => ({ bottom: height * (1 - SHEET_MAX_EXPOSURE) + spacing.sm, left: spacing.sm }),
    [height]
  );

  /** Frame the whole set — what a map app does when it opens on results. */
  const fitToEvents = useCallback(
    (list: MeetupEvent[], animated: boolean) => {
      const lats = list.map((event) => event.location.lat);
      const lngs = list.map((event) => event.location.lng);

      const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

      const spanLat = Math.max(
        Math.max(...lats) - Math.min(...lats),
        MIN_SPAN_LAT
      );
      const spanLng = Math.max(
        Math.max(...lngs) - Math.min(...lngs),
        MIN_SPAN_LNG
      );

      camera.current?.setCamera({
        bounds: {
          ne: [midLng + spanLng / 2, midLat + spanLat / 2],
          sw: [midLng - spanLng / 2, midLat - spanLat / 2],
        },
        padding,
        animationMode: animated ? "easeTo" : "none",
        animationDuration: animated ? 450 : 0,
      });
    },
    [padding]
  );

  useEffect(() => {
    if (events.length === 0 || selectedId || userMoved.current || !height) {
      return;
    }

    const signature = events.map((event) => event.id).join("|");
    if (signature === framedFor.current) return;

    const first = framedFor.current === "";
    framedFor.current = signature;

    fitToEvents(events, !first);
  }, [events, selectedId, height, fitToEvents]);

  useImperativeHandle(
    ref,
    () => ({
      recenter: (coords: Coords) => {
        camera.current?.setCamera({
          centerCoordinate: [coords.lng, coords.lat],
          zoomLevel: SELECTION_ZOOM,
          padding,
          animationMode: "easeTo",
          animationDuration: 420,
        });
      },
    }),
    [padding]
  );

  /**
   * The search radius as a GeoJSON polygon. Recomputed only when the centre or the radius
   * changes, never on a gesture — Mapbox scales real coordinates with the map itself.
   */
  const ringFeature = useMemo(
    () => (userLocation && radiusKm ? radiusFeature(userLocation, radiusKm) : null),
    [userLocation, radiusKm]
  );

  /** Recentre on the selected meetup so selection and map agree. */
  useEffect(() => {
    const target = events.find((event) => event.id === selectedId);
    if (!target) return;

    camera.current?.setCamera({
      centerCoordinate: [target.location.lng, target.location.lat],
      zoomLevel: SELECTION_ZOOM,
      padding,
      animationMode: "easeTo",
      animationDuration: 420,
    });
  }, [selectedId, events, padding]);

  const onCameraChanged = useCallback((state: MapState) => {
    if (state.gestures.isGestureActive) userMoved.current = true;
  }, []);

  const onMapIdle = useCallback(
    (state: MapState) => {
      if (!onRegionSettled || !userMoved.current) return;

      const [lng, lat] = state.properties.center;
      const center = { lat, lng };

      if (
        lastReported.current &&
        metresBetween(lastReported.current, center) < REFETCH_THRESHOLD_M
      ) {
        return;
      }

      lastReported.current = center;
      onRegionSettled(center);
    },
    [onRegionSettled]
  );

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Light}
        // Labels in the language the user chose, not the device's — Settings can
        // override it, and a map that only speaks Japanese is a wall for two
        // thirds of this app's users.
        localizeLabels={{ locale: i18n.language }}
        scaleBarEnabled={false}
        compassEnabled={false}
        attributionPosition={ornamentPosition}
        logoPosition={ornamentPosition}
        onCameraChanged={onCameraChanged}
        onMapIdle={onMapIdle}
      >
        <Mapbox.Camera
          ref={camera}
          defaultSettings={{
            centerCoordinate: [CENTER.lng, CENTER.lat],
            zoomLevel: INITIAL_ZOOM,
          }}
        />

        {ringFeature ? (
          <Mapbox.ShapeSource id="search-radius" shape={ringFeature}>
            <Mapbox.FillLayer
              id="search-radius-fill"
              style={{ fillColor: colors.primary, fillOpacity: 0.08 }}
            />
            <Mapbox.LineLayer
              id="search-radius-line"
              style={{
                lineColor: colors.primary,
                lineOpacity: 0.45,
                lineWidth: 1.5,
                lineDasharray: [3, 2],
              }}
            />
          </Mapbox.ShapeSource>
        ) : null}

        {events.map((event) => (
          <Mapbox.MarkerView
            key={event.id}
            coordinate={[event.location.lng, event.location.lat]}
            // The box is bubble + stem + label, and the coordinate belongs at the
            // bottom of the stem — `PIN_POINT_Y` down a `PIN_BOX.height` box.
            // Anything else floats the pin off its venue.
            anchor={{ x: 0.5, y: PIN_POINT_Y / PIN_BOX.height }}
            allowOverlap
            allowOverlapWithPuck
            isSelected={event.id === selectedId}
          >
            <PinBody
              event={event}
              selected={event.id === selectedId}
              onPress={() => onSelect(event.id)}
              onOpen={() => onOpen(event.id)}
            />
          </Mapbox.MarkerView>
        ))}
      </Mapbox.MapView>
    </View>
  );
  }
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundElevated },
  map: { flex: 1 },
});
