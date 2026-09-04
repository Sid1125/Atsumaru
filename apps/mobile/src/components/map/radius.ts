import type { Coords } from "../../types/api";

/**
 * The search radius as a ring of coordinates.
 *
 * Lives apart from both renderers because it is pure geometry and the two surfaces consume
 * it differently: Mapbox feeds it to a `ShapeSource` as GeoJSON, while the vector city
 * projects a single centre and radius into world units instead (`RadiusRing`). Keeping the
 * maths in one place is what stops the two drawing subtly different circles.
 *
 * Deliberately a polygon rather than Mapbox's `CircleLayer`. `circleRadius` is measured in
 * screen pixels, so a ring drawn that way holds its size while the ground moves underneath —
 * a "5 km" claim that quietly becomes 50 km when the member zooms out. Real coordinates scale
 * with the map because they are *of* the map.
 */
const EARTH_KM = 6_371;

/** Enough segments that the edge reads as a curve rather than a polygon at city zoom. */
export const RING_POINTS = 72;

/**
 * `points + 1` coordinates, closing the loop, as `[lng, lat]` pairs in GeoJSON order.
 *
 * The longitude step is divided by `cos(latitude)`, which is what keeps the shape circular on
 * the ground: a degree of longitude is shorter than a degree of latitude everywhere except the
 * equator, and ignoring that draws a visible ellipse at Tokyo's latitude.
 */
export function geodesicRing(
  center: Coords,
  km: number,
  points = RING_POINTS
): [number, number][] {
  const latRad = (center.lat * Math.PI) / 180;
  const dLat = (km / EARTH_KM) * (180 / Math.PI);
  // Guarded against a division by zero at the poles, which this app will never see but which
  // would produce Infinity rather than a wrong-but-finite ring.
  const dLng = dLat / Math.max(Math.cos(latRad), 1e-6);

  const ring: [number, number][] = [];

  for (let i = 0; i <= points; i += 1) {
    const theta = (i / points) * 2 * Math.PI;

    ring.push([
      center.lng + dLng * Math.cos(theta),
      center.lat + dLat * Math.sin(theta),
    ]);
  }

  return ring;
}

/** The same ring wrapped as the GeoJSON a Mapbox `ShapeSource` expects. */
export function radiusFeature(center: Coords, km: number) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [geodesicRing(center, km)],
    },
  };
}
