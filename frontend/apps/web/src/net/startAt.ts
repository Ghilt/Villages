/**
 * Where a link asked the game to open, and how close: `/?at=<lat>,<lon>&zoom=<z>`.
 *
 * The event page's map link writes it and the map reads it once, when it is made, so a link opens the game over
 * the place an event names rather than over the house's seat. Only the camera moves: the fog is the window's, so
 * a place the house cannot see is opened on as it is. See docs/RUNNING.md.
 */
export interface StartAt {
  lat: number;
  lon: number;
  zoom: number;
}

/** Close enough to see what stands there in its own form: a house's castle crosses over at 8.46. */
export const LINKED_ZOOM = 10;

/** The address that opens the game over a place. */
export function mapLink(place: { lat: number; lon: number }, zoom = LINKED_ZOOM): string {
  return `/?at=${place.lat},${place.lon}&zoom=${zoom}`;
}

/** Where an address asks the game to open, or null when it asks nothing or asks somewhere that is not a place. */
export function startAtIn(search: string): StartAt | null {
  const query = new URLSearchParams(search);
  const at = query.get('at')?.split(',');
  if (at?.length !== 2) {
    return null;
  }
  const [lat, lon] = at.map(Number) as [number, number];
  const zoom = Number(query.get('zoom') ?? LINKED_ZOOM);
  const fits = (value: number, most: number) => Number.isFinite(value) && Math.abs(value) <= most;
  if (!fits(lat, 90) || !fits(lon, 180) || !fits(zoom, 24)) {
    return null;
  }
  return { lat, lon, zoom };
}
