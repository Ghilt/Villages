import type { VisionPointView } from '@villages/protocol';

/**
 * What the log says about the house's vision points: what gives it vision now, how far each sees, and how
 * many places it has seen from in all, the ended ones included, because what they covered stays revealed.
 *
 * One line a change, because a key figure moving is one thing happening, and a line is what Adam reads to
 * check that the server's answer is the one he expected. See decision records 0023 and 0061.
 */

/** Whether a point still gives vision on a day: `since <= day < until`, or open-ended with no `until`. */
export function lastingOn(point: VisionPointView, today: number | null): boolean {
  if (point.until === undefined) {
    return true;
  }
  return today !== null && point.since <= today && today < point.until;
}

/** How a list of names reads in a line: `a`, `a and b`, `a, b and c`. */
function inWords(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * `nameOf` names a key figure or a structure by its id, where the page has heard of them: a vision given from a
 * structure is said by the structure's name, *the Antarctic mill*.
 */
export function describeSight(
  points: readonly VisionPointView[],
  today: number | null,
  nameOf: (id: string) => string | undefined,
): string {
  if (points.length === 0) {
    return 'no vision yet: there is no house to see from';
  }
  const lasting = points.filter((point) => lastingOn(point, today));
  const givers = lasting.map((point) =>
    point.kind === 'keyFigure'
      ? (nameOf(point.of ?? '') ?? 'a key figure')
      : point.from !== undefined
        ? (nameOf(point.from) ?? 'a structure')
        : `the vision given at ${point.place.lat.toFixed(2)}, ${point.place.lon.toFixed(2)}`,
  );
  // One reach for all of them is said once; reaches that differ, a castle's and a mill's, are said beside each.
  const radii = [...new Set(lasting.map((point) => point.radius))];
  const reach = radii.length === 1 ? `, ${radii[0]} km around ${lasting.length === 1 ? 'it' : 'each'}` : '';
  const said =
    radii.length === 1 ? givers : givers.map((giver, at) => `${giver} (${lasting[at]!.radius} km)`);
  const seen = `${points.length} ${points.length === 1 ? 'place' : 'places'} seen from in all`;
  if (lasting.length === 0) {
    return `nothing gives vision now; ${seen}`;
  }
  return `${inWords(said)} ${lasting.length === 1 ? 'gives' : 'give'} vision${reach}; ${seen}`;
}
