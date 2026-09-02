/**
 * Everything about the map that can be decided without a map instance, kept pure so that it is testable
 * and so that the camera constraints live in one readable place.
 */

/** OpenFreeMap's minimal style: no motorway shields, no brands, which suits a timeless world. */
export const DEFAULT_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/**
 * Attribution is required, and every style we use carries its own: the OpenFreeMap styles credit
 * OpenFreeMap, OpenMapTiles and OpenStreetMap. The control is shown uncollapsed so that the credit stays
 * readable rather than hidden behind an icon, and nothing is added on top of what the style declares.
 */
export const ATTRIBUTION_COMES_FROM_THE_STYLE = true;

/**
 * The camera is flat, north-up and shows the world once, which keeps the sprite overlay a two-multiply
 * projection against the map centre. See docs/adr/0014.
 */
export const CAMERA = {
  /** Northern Europe: enough coast, river and border to read as a place rather than as a texture. */
  center: { lng: 10.5, lat: 55.5 },
  initialZoom: 4,
  minZoom: 2,
  maxZoom: 14,
} as const;

/**
 * The style to load. Configurable because the public tile service makes no promise of availability, and a
 * blank setting should fall back rather than break the map.
 */
export function resolveStyleUrl(env: { VITE_MAP_STYLE_URL?: string }): string {
  const configured = env.VITE_MAP_STYLE_URL?.trim();
  return configured !== undefined && configured !== '' ? configured : DEFAULT_STYLE_URL;
}
