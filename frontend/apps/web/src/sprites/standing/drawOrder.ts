import type { ScreenPoint } from '../../geometry/cameraMath';

/*
 * The order the trees and the buildings standing among them are drawn in, farthest first.
 *
 * A tree is a point: its foot is where it stands, and of two trees the one further up the screen is further away.
 * A building is not. It stands on a footprint, a square of the ground's diamonds, turned twenty-six degrees and seen
 * from the south, so the line from its left corner to its right one runs up the screen to the right. A tree is behind
 * a building when its foot is above that line where it stands, and in front of it when below; level with the corner
 * beyond either end. A tree left of a castle can be in front of it while a tree to its right standing lower on the
 * screen is behind it, which no one number a building could be sorted on says. No tree stands on a footprint: it is
 * the middle of the building's yard.
 *
 * The trees stay in the order of their feet, and the buildings go between them: each tree is given the slice it is
 * drawn in, the trees between one building and the next. A tree goes after every building whose line it is below,
 * and before any building whose line it is above that its picture overlaps. Pure, so the whole rule is held without
 * a canvas. See decision record 0110.
 */

/** A building as the order sees it, on the screen's ground in the scenery's world units. */
export interface Building {
  /** The corners of its footprint where they land, round it: left, front, right and back. */
  corners: readonly ScreenPoint[];
  /** Where its picture hangs from, how far across the picture that is, and how tall and wide it is drawn. */
  foot: ScreenPoint;
  anchor: number;
  tall: number;
  wide: number;
}

/** A tree as the order sees it: its foot, and the box its picture is drawn in. */
export interface Tree {
  x: number;
  y: number;
  left: number;
  right: number;
  top: number;
}

/** The line a building is sorted on: its leftmost corner to its rightmost. */
interface Line {
  a: ScreenPoint;
  b: ScreenPoint;
}

function lineOf(corners: readonly ScreenPoint[]): Line {
  const across = [...corners].sort((one, other) => one.x - other.x);
  return { a: across[0]!, b: across[across.length - 1]! };
}

/** How far down the screen a building's line is at `x`: along it over the footprint, level with its ends beyond. */
function depthAt(line: Line, x: number): number {
  if (x <= line.a.x) return line.a.y;
  if (x >= line.b.x) return line.b.y;
  return line.a.y + ((x - line.a.x) / (line.b.x - line.a.x)) * (line.b.y - line.a.y);
}

/** How far up and down the screen a footprint reaches at `x`, which it is known to cross. */
function spanAt(corners: readonly ScreenPoint[], x: number): [number, number] {
  const ys: number[] = [];
  corners.forEach((a, at) => {
    const b = corners[(at + 1) % corners.length]!;
    if (a.x === b.x) {
      if (a.x === x) ys.push(a.y, b.y);
    } else if ((a.x - x) * (b.x - x) <= 0) {
      ys.push(a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y));
    }
  });
  return [Math.min(...ys), Math.max(...ys)];
}

/** How far a footprint reaches across the screen. */
function widthOf(corners: readonly ScreenPoint[]): [number, number] {
  const xs = corners.map((corner) => corner.x);
  return [Math.min(...xs), Math.max(...xs)];
}

/** Whether two pictures drawn with these boxes overlap on the screen. */
function overlap(building: Building, left: number, right: number, top: number, bottom: number): boolean {
  const from = building.foot.x - building.anchor * building.wide;
  return (
    right > from &&
    left < from + building.wide &&
    bottom > building.foot.y - building.tall &&
    top < building.foot.y
  );
}

/**
 * Whether one of two buildings whose pictures overlap is drawn before the other: where their footprints share a
 * stretch across the screen, the one wholly above the other there; otherwise, or where they cross, the one whose line
 * is higher midway between them.
 */
function drawnBefore(one: Building, other: Building, lines: [Line, Line]): boolean {
  const [oneFrom, oneTo] = widthOf(one.corners);
  const [otherFrom, otherTo] = widthOf(other.corners);
  const from = Math.max(oneFrom, otherFrom);
  const to = Math.min(oneTo, otherTo);
  const x = (from + to) / 2;
  if (from <= to) {
    const [oneTop, oneBottom] = spanAt(one.corners, x);
    const [otherTop, otherBottom] = spanAt(other.corners, x);
    if (oneBottom <= otherTop) return true;
    if (otherBottom <= oneTop) return false;
  }
  return depthAt(lines[0], x) < depthAt(lines[1], x);
}

/**
 * The order the buildings are drawn in, as indices into them, and the slice each tree is drawn in: nought before the
 * first of them, one between the first and the second, and so on. The trees are handed over in the order they are
 * drawn, farthest first.
 */
export function drawOrder(
  buildings: readonly Building[],
  trees: readonly Tree[],
): { order: number[]; slices: Uint16Array } {
  const lines = buildings.map((building) => lineOf(building.corners));
  const middle = (at: number) => depthAt(lines[at]!, (lines[at]!.a.x + lines[at]!.b.x) / 2);
  // What must be drawn before each building: the others its picture overlaps that are behind it.
  const behind = buildings.map((): number[] => []);
  buildings.forEach((one, at) => {
    const from = one.foot.x - one.anchor * one.wide;
    for (let next = at + 1; next < buildings.length; next += 1) {
      const other = buildings[next]!;
      if (!overlap(other, from, from + one.wide, one.foot.y - one.tall, one.foot.y)) continue;
      if (drawnBefore(one, other, [lines[at]!, lines[next]!])) behind[next]!.push(at);
      else behind[at]!.push(next);
    }
  });
  // Farthest first among those whose turn it is; a ring, which footprints apart cannot make, is drawn by its middles.
  const placed = buildings.map(() => false);
  const order: number[] = [];
  while (order.length < buildings.length) {
    let pick = -1;
    for (const free of [true, false]) {
      buildings.forEach((_, at) => {
        const ready = !free || behind[at]!.every((first) => placed[first]);
        if (!placed[at] && ready && (pick < 0 || middle(at) < middle(pick))) pick = at;
      });
      if (pick >= 0) break;
    }
    placed[pick] = true;
    order.push(pick);
  }

  const slices = new Uint16Array(trees.length);
  for (let at = 0; at < trees.length; at += 1) {
    const tree = trees[at]!;
    let after = 0;
    let before = order.length;
    for (let rank = 0; rank < order.length; rank += 1) {
      const index = order[rank]!;
      if (tree.y > depthAt(lines[index]!, tree.x)) {
        after = rank + 1;
      } else if (rank < before && overlap(buildings[index]!, tree.left, tree.right, tree.top, tree.y)) {
        before = rank;
      }
    }
    slices[at] = Math.min(after, before);
  }
  return { order, slices };
}
