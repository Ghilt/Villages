/**
 * The place an event names, if it names one: the first latitude and longitude in its data, looked for field by field
 * in the order the store wrote them and into whatever they hold. A structure raised, a house founded, a person who
 * moved, vision gained; a choice offering seats names the first. Found by shape rather than by event type, so a new
 * event with a place in it is linked to the map without a line here. See `EventLog.tsx`.
 */
export function placeIn(data: unknown): { lat: number; lon: number } | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const { lat, lon } = data as { lat?: unknown; lon?: unknown };
  if (typeof lat === 'number' && typeof lon === 'number' && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    return { lat, lon };
  }
  for (const inside of Object.values(data)) {
    const found = placeIn(inside);
    if (found !== null) {
      return found;
    }
  }
  return null;
}
