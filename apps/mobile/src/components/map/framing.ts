/**
 * How much of the map is actually *visible*, shared by both map implementations.
 *
 * Discover layers floating chrome over the map and rests a detented sheet on top
 * of it, so framing content against the full view height puts pins behind the
 * filters or under the sheet. Both the vector city (which clamps its own pan) and
 * Mapbox (which takes camera padding) measure against these numbers, so the two
 * surfaces open on the same view.
 */

/**
 * The fraction of the view still showing map when the sheet rests at its lowest
 * detent ("peek" = 0.8 of the screen). Vertical pan limits are measured against
 * this so the world can be positioned for the visible band without ever letting
 * background show through below the sheet.
 */
export const SHEET_MAX_EXPOSURE = 0.8;

/** The band actually visible with the sheet at its default "half" detent. */
export const EXPOSED_FRACTION = 0.52;

/**
 * Vertical space the floating chrome occupies at the top of the map: the safe
 * area, the identity row and the filter rail. Content framed above this would sit
 * behind the filters.
 */
export const CHROME_HEIGHT = 210;
