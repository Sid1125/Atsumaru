import { MAPBOX_PUBLIC_TOKEN } from "../config/env";
import i18n from "../i18n";
import type { Coords } from "../types/api";

/**
 * Place search, for choosing where a meetup happens.
 *
 * The **only** file that talks to Mapbox's Search Box API, the same discipline
 * `components/map/mapbox.ts` applies to the renderer: one gate, one place to change the
 * provider, and callers that only ever ask "is this available?".
 *
 * Search Box rather than the Geocoding API on purpose. Geocoding v6 is address-shaped — asked
 * for "Shibuya Station" it answers with the *ward*, and a Japanese café query returns nothing
 * at all. Search Box is POI-shaped, which is what a venue picker needs.
 *
 * Two steps by design, not by accident: `/suggest` returns names without coordinates, and
 * `/retrieve` resolves the one the member actually picked. Mapbox bills a *session* rather
 * than a request, so a whole typeahead costs one unit as long as every call in it carries the
 * same `session_token` — which is why the token is owned here and not per-request.
 *
 * Unavailable without a token, and honest about it: `hasPlaceSearch()` is false, and the
 * create-event screen falls back to a plain venue name. The map does the same thing
 * (`hasMapbox()`), so a missing token degrades one surface, never breaks it.
 */
const SUGGEST_URL = "https://api.mapbox.com/search/searchbox/v1/suggest";
const RETRIEVE_URL = "https://api.mapbox.com/search/searchbox/v1/retrieve";

/**
 * Country filter for when there is no location fix: the product's data lives in Japan,
 * and an unbounded worldwide search on a fallback is mostly noise. Once the member has a
 * real fix, the search space is their own area instead — see `suggestPlaces`.
 */
const COUNTRY = "jp";

/**
 * How wide the area around the member's fix is searched, in degrees (~1° ≈ 111 km).
 * Bounding the results is what makes the picker feel like "around your district or
 * province" rather than a country-wide relevance rank — Search Box accepts this as a
 * `radius` around the `proximity` point (docs.mapbox.com/api/search/search-box).
 */
const FIXED_AREA_RADIUS_DEG = 1;

/**
 * Venue search language now follows the app language (en/ja/zh) so the heading and the
 * address line stay in the same language. Previously hardcoded to `ja` because Japan's POI
 * index returned wards for `en` queries ("shibuya cafe" → `Shibuya-ku`); with Search Box
 * v1 + proximity+radius bias that no longer reproduces, and the hardcoded `ja` left
 * English UI showing `Starbucks` + `東京都渋谷区…` (U-heading English, address Japanese).
 */
function getSearchLanguage(): string {
  const lang = (i18n.language || "en").split("-")[0].toLowerCase();
  if (lang === "ja") return "ja";
  if (lang === "zh") return "zh";
  return "en";
}

/** Six is what the handle suggester shows, and it is about what fits without scrolling. */
const LIMIT = 6;

export interface PlaceSuggestion {
  id: string;
  /** The venue's own name — what goes in `venue_name`. */
  name: string;
  /** Its address, for disambiguating two cafés with the same name. */
  address: string;
}

export interface ResolvedPlace {
  name: string;
  address: string;
  location: Coords;
}

export function hasPlaceSearch(): boolean {
  return MAPBOX_PUBLIC_TOKEN.length > 0;
}

/**
 * Opaque per-session id. Not a security token — Mapbox only needs it to be unique — so
 * `Math.random` is adequate and avoids pulling in a crypto dependency for it.
 */
export function newSearchSession(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

interface SuggestResponse {
  suggestions?: {
    mapbox_id: string;
    name?: string;
    place_formatted?: string;
    full_address?: string;
  }[];
}

/**
 * Places matching `query`, ranked near `near` when a fix is available.
 *
 * Returns `[]` rather than throwing on a provider failure: an unreachable search should
 * leave the member typing a venue name by hand, not staring at an error on a form they were
 * halfway through.
 */
export async function suggestPlaces(
  query: string,
  session: string,
  near?: Coords | null
): Promise<PlaceSuggestion[]> {
  if (!hasPlaceSearch() || query.trim().length < 2) return [];

  const params = new URLSearchParams({
    q: query.trim(),
    language: getSearchLanguage(),
    limit: String(LIMIT),
    session_token: session,
    access_token: MAPBOX_PUBLIC_TOKEN,
  });

  if (near) {
    // The member's own area is the search space: bias results toward their fix and bound
    // them inside the `radius` around it. No country filter here — a member outside Japan
    // searching their own district must not be pinned to `country=jp` (that is exactly
    // the "searches in Japan, no place found" bug). For a member in Japan the radius
    // already keeps results local, so the filter is redundant either way.
    params.set("proximity", `${near.lng},${near.lat}`);
    params.set("radius", String(FIXED_AREA_RADIUS_DEG));
  } else {
    // No fix: the Japan-first baseline.
    params.set("country", COUNTRY);
  }

  try {
    const response = await fetch(`${SUGGEST_URL}?${params.toString()}`);

    if (!response.ok) return [];

    const body = (await response.json()) as SuggestResponse;

    return (body.suggestions ?? [])
      .filter((row) => !!row.mapbox_id && !!row.name)
      .map((row) => ({
        id: row.mapbox_id,
        name: row.name!,
        address: row.place_formatted ?? row.full_address ?? "",
      }));
  } catch {
    return [];
  }
}

interface RetrieveResponse {
  features?: {
    geometry?: { coordinates?: [number, number] };
    properties?: { name?: string; full_address?: string; place_formatted?: string };
  }[];
}

/**
 * Turns a chosen suggestion into coordinates. `session` must be the same one the suggestion
 * came from, or Mapbox bills a second session.
 *
 * Null on failure, so the caller can keep the typed name and fall back rather than post a
 * meetup with a coordinate it never actually resolved.
 */
export async function retrievePlace(
  id: string,
  session: string
): Promise<ResolvedPlace | null> {
  if (!hasPlaceSearch()) return null;

  const params = new URLSearchParams({
    language: getSearchLanguage(),
    session_token: session,
    access_token: MAPBOX_PUBLIC_TOKEN,
  });

  try {
    const response = await fetch(`${RETRIEVE_URL}/${id}?${params.toString()}`);

    if (!response.ok) return null;

    const body = (await response.json()) as RetrieveResponse;
    const feature = body.features?.[0];
    const coordinates = feature?.geometry?.coordinates;

    if (!feature || !coordinates) return null;

    return {
      name: feature.properties?.name ?? "",
      address:
        feature.properties?.full_address ?? feature.properties?.place_formatted ?? "",
      location: { lng: coordinates[0], lat: coordinates[1] },
    };
  } catch {
    return null;
  }
}
