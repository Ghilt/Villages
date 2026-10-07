import { coverageOf } from '@villages/protocol';
import type { VisionPointView } from '@villages/protocol';

/**
 * Whether a place that never moves - a house's seat - is in a house's vision on `today`, `now`, or else the
 * world-day the fog hid it: the end of the last stretch in which the house's vision covered it. Null where the
 * house never saw it at all. What a window says beside its name, `current` or that day. See decision record 0089.
 *
 * Vision changes only on the days a vision point begins or ends, so those days and the ones before them are all
 * there is to ask about. A point that began and ended on one day saw for part of it, so it counts on that day, and
 * the fog hid what it saw that same day. The gateway's `Fog.lastSeen` asks the same of somebody who moves, from
 * where they stood, on the same arithmetic the fog is drawn with, so the page and the gateway cannot disagree.
 */
export function seenUntil(
  place: { lat: number; lon: number },
  sight: { points: readonly VisionPointView[]; tension: number },
  today: number,
): 'now' | number | null {
  // Through the whole of a day, or - `partly` - for some of it as well: a point begun and ended that day.
  const covered = (day: number, partly: boolean): boolean =>
    coverageOf(
      sight.points
        .filter(
          (point) =>
            point.since <= day &&
            (point.until === undefined || day < point.until || (partly && point.since === point.until)),
        )
        .map((point) => ({ lat: point.place.lat, lon: point.place.lon, kilometres: point.radius })),
      sight.tension,
    ).covers(place);

  if (covered(today, false)) {
    return 'now';
  }
  const ends = sight.points.flatMap((point) => [
    point.since,
    ...(point.until === undefined ? [] : [point.until]),
  ]);
  const days = [...new Set(ends.flatMap((day) => [day, day - 1]))]
    .filter((day) => day <= today)
    .sort((one, other) => other - one);
  for (const day of days) {
    if (day < today && covered(day, false)) {
      return day + 1;
    }
    if (covered(day, true)) {
      return day;
    }
  }
  return null;
}
