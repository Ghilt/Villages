/**
 * Which names the Info map writes: as many as fit on the screen without one covering another, the more
 * important first. A map that writes every name it knows is a black smudge; one that writes the important
 * ones, and more as the camera comes in, is an atlas. The positions are the screen's, worked out by the
 * caller; this decides only which of them are written. See `infoMap.ts`.
 */

export interface LabelCandidate {
  /** Screen pixels: where the label's point is. */
  readonly x: number;
  readonly y: number;
  /** How wide and tall the label is written, in screen pixels. */
  readonly width: number;
  readonly height: number;
  /** Smaller is more important, and is placed first. */
  readonly priority: number;
  /** Beside a point, as a town's name sits to the right of its dot; or centred on it, as a sea's does. */
  readonly anchor: 'beside' | 'centre';
  /** What it says: the same words are not written twice close together, whatever wrote them. */
  readonly key?: string;
}

/** A label's box on the screen: left, top, right, bottom. */
export type Box = readonly [number, number, number, number];

/** How far a label stands off its point, and how much room is kept clear around every label. */
const BESIDE = 6;
const ROOM = 3;

export function boxOf(candidate: LabelCandidate): Box {
  const { x, y, width, height, anchor } = candidate;
  return anchor === 'beside'
    ? [x + BESIDE, y - height / 2, x + BESIDE + width, y + height / 2]
    : [x - width / 2, y - height / 2, x + width / 2, y + height / 2];
}

/**
 * The candidates that are written, in the order they were placed, each with its box. A candidate whose box
 * leaves the screen, or meets one already placed, is left out, and so is one saying what a placed one already
 * says within `apart` pixels - two sources naming one lake, or a river's name repeated too close along it. A
 * grid of buckets keeps the check to the few boxes nearby, so a screenful of a thousand candidates is a few
 * thousand comparisons rather than a million.
 */
export function placeLabels<Candidate extends LabelCandidate>(
  candidates: readonly Candidate[],
  screen: { readonly width: number; readonly height: number },
  apart = 0,
): (Candidate & { readonly box: Box })[] {
  const said = new Map<string, (readonly [number, number])[]>();
  const bucket = 64;
  const columns = Math.ceil(screen.width / bucket) + 1;
  const buckets = new Map<number, Box[]>();
  const placed: (Candidate & { readonly box: Box })[] = [];
  const order = [...candidates].sort((a, b) => a.priority - b.priority);
  for (const candidate of order) {
    const box = boxOf(candidate);
    if (box[0] < 0 || box[1] < 0 || box[2] > screen.width || box[3] > screen.height) continue;
    const [left, top, right, bottom] = [box[0] - ROOM, box[1] - ROOM, box[2] + ROOM, box[3] + ROOM];
    const keys: number[] = [];
    for (let row = Math.floor(top / bucket); row <= Math.floor(bottom / bucket); row += 1) {
      for (let column = Math.floor(left / bucket); column <= Math.floor(right / bucket); column += 1) {
        keys.push(row * columns + column);
      }
    }
    const meets = keys.some((key) =>
      (buckets.get(key) ?? []).some(
        (other) => left < other[2] && right > other[0] && top < other[3] && bottom > other[1],
      ),
    );
    if (meets) continue;
    const before = candidate.key === undefined ? undefined : said.get(candidate.key);
    if (before?.some(([x, y]) => Math.hypot(x - candidate.x, y - candidate.y) < apart)) continue;
    if (candidate.key !== undefined) said.set(candidate.key, [...(before ?? []), [candidate.x, candidate.y]]);
    for (const key of keys) {
      const list = buckets.get(key);
      if (list === undefined) buckets.set(key, [box]);
      else list.push(box);
    }
    placed.push({ ...candidate, box });
  }
  return placed;
}
