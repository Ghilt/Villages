import type { Point } from './course.ts';
import { unitsAlong } from './line.ts';

/*
 * A road's shape: the diamonds its course stepped on, along the lattice's axes, run together into straight runs, and
 * each turn between two runs rounded to the road's turning radius - most to one, some to a wider - or as near as the
 * shorter run either side allows, so a road keeps to the grid the map is drawn on and goes across it only as it turns.
 * Along each straight run it **strays**, here and there: it shifts across and keeps on beside its line a while, it jogs
 * out and back, it wriggles a moment, and in places it does none of these, never further from its line than the most it
 * may, and back onto it as the run ends - a road and not a ruled line, still along the grid (Adam's words of
 * 2026-10-22). Every line a rounding or a stray draws is checked to pass over nothing but land a road may cross, and one
 * that would take it over water or a river, or across a settlement's square or a ruin's piece, is not drawn: the turn
 * is left sharp, the run strays less or not at all. Which turns are wider and where a run strays and how is worked out
 * from where they are, so the same roads are shaped the same way every time. Its ends, its bridges' ends and their
 * approaches are fixed and never move. Every point lies on the quarter of a world unit, so the records it is cut into
 * meet end to end exactly. See docs/plans/settlements-and-roads.md.
 */

export interface ShapeRules {
  /** The radius most turns of a road are rounded to, in world units. */
  readonly turning: number;
  /** The wider radius some turns are rounded to instead, and the share of turns that are. */
  readonly widerTurning: number;
  readonly widerShare: number;
  /** The most a straight run strays sideways from its line, in world units. */
  readonly stray: number;
  /** How far apart, on average, the places are where a run shifts, jogs or wriggles, or keeps on, in world units. */
  readonly strayEvery: number;
}

/** Whether the straight line between two points passes over nothing a road may not. */
export type Clear = (a: Point, b: Point) => boolean;

/** A line between two points is clear when every unit under it is land, `cost` one or more, and nothing bars it. */
export function clearOver(
  cost: (x: number, y: number) => number,
  barred: (x: number, y: number) => boolean,
): Clear {
  return (a, b) => unitsAlong(a.x, a.y, b.x, b.y, (x, y) => cost(x, y) >= 1 && !barred(x, y));
}

/**
 * A point put on the nearest quarter of a world unit that is still in the unit it was in, so a point on land a road may
 * cross is never put over the edge into the water beside it.
 */
export function onQuarter(point: Point): Point {
  const fit = (value: number) => Math.min(Math.floor(value) + 0.75, Math.round(value * 4) / 4);
  return { x: fit(point.x), y: fit(point.y) };
}

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

/** How many lines a rounded turn is drawn in. */
const CURVE = 4;
/** How long a straight line must be to stray, and how far from either end it takes to come back onto it, world units. */
const STRAYS_FROM = 3;
const BACK = 2;
/** How finely a stray is drawn, before the lines that add nothing are taken out, and how little a point must add. */
const STRAY_STEP = 0.5;
const STRAIGHT_ENOUGH = 0.06;

/** A number between nought and one for a place, the same every time: which turns are wider, where a run strays. */
function rollAt(point: Point, salt: number): number {
  let hash =
    Math.imul(Math.round(point.x * 4) ^ 0x9e3779b9, 0x85ebca6b) ^
    Math.imul(Math.round(point.y * 4) ^ salt, 0xc2b2ae35);
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  return ((hash ^ (hash >>> 12)) >>> 0) / 4294967296;
}

const ease = (t: number) => {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
};

/**
 * How far a run starting at `a`, `long` units long, strays sideways `along` it: the sum of what happens at each place
 * along it a few units apart, each chosen by a roll of where it is - a shift across that it keeps to, a jog out and back,
 * a moment's wriggle, or nothing - kept within `most` of its line and brought back onto it over `BACK` from either end.
 */
export function strayAlong(a: Point, long: number, most: number, every: number): (along: number) => number {
  const shifts: { at: number; by: number; over: number }[] = [];
  const bumps: { at: number; out: number; over: number; wriggle: boolean }[] = [];
  let level = 0;
  for (let at = every * (0.3 + 0.7 * rollAt(a, 5)), n = 0; at < long - BACK; n += 1) {
    const roll = rollAt(a, 20 + n * 4);
    const size = rollAt(a, 21 + n * 4);
    const side = rollAt(a, 22 + n * 4) < 0.5 ? -1 : 1;
    if (roll < 0.4) {
      // A shift across, which the run then keeps to: towards the other side when it is already well over.
      const to = Math.max(-most, Math.min(most, level + side * most * (0.35 + 0.5 * size)));
      shifts.push({ at, by: to - level, over: 1.5 + 2 * rollAt(a, 23 + n * 4) });
      level = to;
    } else if (roll < 0.6) {
      bumps.push({
        at,
        out: side * most * (0.3 + 0.35 * size),
        over: 1.2 + 1.3 * rollAt(a, 23 + n * 4),
        wriggle: false,
      });
    } else if (roll < 0.8) {
      bumps.push({
        at,
        out: side * most * (0.2 + 0.25 * size),
        over: 2 + 2 * rollAt(a, 23 + n * 4),
        wriggle: true,
      });
    }
    at += every * (0.5 + rollAt(a, 6 + n));
  }
  return (along) => {
    let off = 0;
    for (const shift of shifts) off += shift.by * ease((along - shift.at) / shift.over);
    for (const bump of bumps) {
      const t = (along - bump.at) / bump.over;
      if (t <= 0 || t >= 1) continue;
      off +=
        bump.out * (bump.wriggle ? Math.sin(2 * Math.PI * t) * Math.sin(Math.PI * t) : Math.sin(Math.PI * t));
    }
    const kept = Math.max(-most, Math.min(most, off));
    return kept * ease(Math.min(along, long - along) / BACK);
  };
}

/** The points of a line drawn finely, with those that lie as good as on the line between their neighbours taken out. */
function plainest(points: readonly Point[]): Point[] {
  if (points.length < 3) return [...points];
  const a = points[0]!;
  const b = points[points.length - 1]!;
  const long = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  let furthest = 0;
  let at = 0;
  for (let step = 1; step < points.length - 1; step += 1) {
    const p = points[step]!;
    const off = Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / long;
    if (off > furthest) {
      furthest = off;
      at = step;
    }
  }
  if (furthest < STRAIGHT_ENOUGH) return [a, b];
  return [...plainest(points.slice(0, at + 1)).slice(0, -1), ...plainest(points.slice(at))];
}

/**
 * Every straight line long enough strayed by `strayAlong`, its points on their quarters and every line of it checked
 * clear; where that is not clear it strays half as far, and where that is not either it stays straight.
 */
function strayed(points: readonly Point[], clear: Clear, rules: ShapeRules): Point[] {
  if (rules.stray <= 0 || points.length < 2) return [...points];
  const out: Point[] = [points[0]!];
  for (let at = 1; at < points.length; at += 1) {
    const a = points[at - 1]!;
    const b = points[at]!;
    const long = Math.hypot(b.x - a.x, b.y - a.y);
    if (long >= STRAYS_FROM) {
      const across = { x: -(b.y - a.y) / long, y: (b.x - a.x) / long };
      const steps = Math.max(2, Math.ceil(long / STRAY_STEP));
      for (const most of [rules.stray, rules.stray / 2]) {
        const off = strayAlong(a, long, most, rules.strayEvery);
        const fine = Array.from({ length: steps + 1 }, (_, step) => {
          const t = step / steps;
          return {
            x: a.x + (b.x - a.x) * t + across.x * off(t * long),
            y: a.y + (b.y - a.y) * t + across.y * off(t * long),
          };
        });
        const line: Point[] = [];
        for (const point of plainest(fine).slice(1, -1).map(onQuarter)) {
          if (!same(point, line[line.length - 1] ?? a) && !same(point, b)) line.push(point);
        }
        const all = [a, ...line, b];
        if (all.every((one, step) => step === 0 || clear(all[step - 1]!, one))) {
          out.push(...line);
          break;
        }
      }
    }
    out.push(b);
  }
  return out;
}

/** Whether the way turns at `here`, coming from `before` and going on to `after`. */
function turnsAt(before: Point, here: Point, after: Point): boolean {
  const ax = here.x - before.x;
  const ay = here.y - before.y;
  const bx = after.x - here.x;
  const by = after.y - here.y;
  const across = (ax * by - ay * bx) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
  return Math.abs(across) > 1e-6 || ax * bx + ay * by < 0;
}

/** The turn at `here` rounded by cutting back `back` along both runs, the curve between from end to end. */
function rounded(before: Point, here: Point, after: Point, back: number): Point[] {
  const inLong = Math.hypot(here.x - before.x, here.y - before.y);
  const outLong = Math.hypot(after.x - here.x, after.y - here.y);
  const a = {
    x: here.x + ((before.x - here.x) / inLong) * back,
    y: here.y + ((before.y - here.y) / inLong) * back,
  };
  const b = {
    x: here.x + ((after.x - here.x) / outLong) * back,
    y: here.y + ((after.y - here.y) / outLong) * back,
  };
  const curve: Point[] = [];
  for (let step = 0; step <= CURVE; step += 1) {
    const t = step / CURVE;
    const point = onQuarter({
      x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * here.x + t * t * b.x,
      y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * here.y + t * t * b.y,
    });
    if (curve.length === 0 || !same(curve[curve.length - 1]!, point)) curve.push(point);
  }
  return curve;
}

/**
 * The shape of a run of points, its first and last fixed and any others `fixed` says: run together into its straight
 * runs, each one line where that line is clear by `clear` and split where it is not, each turn not fixed rounded by
 * `rules.turning` where every line of the rounding is clear, every point on the quarter of a unit. Every line it draws
 * is clear, as long as each line of the run between two of its points on their quarters is.
 */
export function shapeOf(
  run: readonly Point[],
  fixed: readonly boolean[],
  clear: Clear,
  rules: ShapeRules,
): Point[] {
  const points: Point[] = [];
  const pinned: boolean[] = [];
  run.forEach((point, at) => {
    const pin = at === 0 || at === run.length - 1 || fixed[at] === true;
    if (points.length > 0 && same(points[points.length - 1]!, point)) {
      pinned[pinned.length - 1] = pinned[pinned.length - 1]! || pin;
      return;
    }
    points.push(point);
    pinned.push(pin);
  });
  const drawn = points.map(onQuarter);
  const turns = points.map(
    (point, at) =>
      pinned[at] === true ||
      at === 0 ||
      at === points.length - 1 ||
      turnsAt(points[at - 1]!, point, points[at + 1]!),
  );
  // Each straight run as one line where that is clear; where it is not, as the longest clear lines along it.
  const kept: number[] = [0];
  for (let corner = 1, from = 0; corner < points.length; corner += 1) {
    if (!turns[corner]) continue;
    for (let start = from; start < corner;) {
      let reach = corner;
      while (reach > start + 1 && !clear(drawn[start]!, drawn[reach]!)) reach -= 1;
      kept.push(reach);
      start = reach;
    }
    from = corner;
  }
  const out: Point[] = [];
  const push = (point: Point) => {
    if (out.length === 0 || !same(out[out.length - 1]!, point)) out.push(point);
  };
  kept.forEach((at, step) => {
    if (step === 0 || step === kept.length - 1 || pinned[at] === true || !turns[at]) {
      push(drawn[at]!);
      return;
    }
    const before = points[kept[step - 1]!]!;
    const after = points[kept[step + 1]!]!;
    const point = points[at]!;
    const radius = rollAt(point, 1) < rules.widerShare ? rules.widerTurning : rules.turning;
    const back = Math.min(
      radius,
      Math.hypot(point.x - before.x, point.y - before.y) / 2,
      Math.hypot(after.x - point.x, after.y - point.y) / 2,
    );
    const curve = back < 0.25 ? [] : rounded(before, point, after, back);
    // Every line of the rounding clear, the one on to the next point kept too, so whatever comes after joins it clear.
    const fine =
      curve.length > 1 &&
      clear(out[out.length - 1]!, curve[0]!) &&
      curve.every((one, at) => at === 0 || clear(curve[at - 1]!, one)) &&
      clear(curve[curve.length - 1]!, drawn[kept[step + 1]!]!);
    if (fine) curve.forEach(push);
    else push(drawn[at]!);
  });
  return strayed(out, clear, rules);
}
