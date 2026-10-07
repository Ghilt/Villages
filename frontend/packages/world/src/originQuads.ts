import { nearestStars, starsWithin } from './originStars.ts';
import type { StarField } from './originStars.ts';

/**
 * Four small lakes close together make a shape that a move, a turn or a stretch leaves alone: the ratios of
 * their six distances. Look that shape up among plain Earth's lakes and the handful that match say where a
 * piece of an edited master may have come from. The pixels decide which of them it did; see `origin.ts`.
 */

/** How finely a shape's five ratios are told apart, and how many steps that makes of each. */
const STEP = 0.025;
const STEPS = 40;
/** A quad smaller than this is mostly the noise of where in its pixel a lake's middle fell. */
const SMALLEST_QUAD = 20;
/** Earth's quads are made of a star's five nearest; the edited master's of its six, so that a neighbour lost to a cut still leaves some quad whole. */
const NEIGHBOURS = 5;
const ASKING = 6;
const REACH = 150;

/** Every quad of plain Earth's stars, sorted by the shape it makes, so that a shape is a binary search away. */
export interface QuadIndex {
  readonly field: StarField;
  readonly keys: Uint32Array;
  /** Four stars a quad, in the order `shapeOf` puts them. */
  readonly stars: Int32Array;
  /** Each quad's longest side. */
  readonly spans: Float32Array;
}

const distances = new Float64Array(6);
const sorted = new Float64Array(6);
const ratios = new Float64Array(5);
const sums = new Float64Array(4);

/**
 * The shape of four stars as five numbers no move, turn, stretch or mirror changes - their other five
 * distances over the longest - and the stars put in an order the same shape always gives them, by how far
 * each is from the other three. Returns the longest side; leaves the ratios in `ratios` and the order in `into`.
 */
function shapeOf(field: StarField, four: ArrayLike<number>, into: Int32Array): number {
  let at = 0;
  sums.fill(0);
  for (let i = 0; i < 4; i += 1) {
    for (let j = i + 1; j < 4; j += 1) {
      const d = Math.hypot(field.x[four[i]!]! - field.x[four[j]!]!, field.y[four[i]!]! - field.y[four[j]!]!);
      distances[at++] = d;
      sums[i]! += d;
      sums[j]! += d;
    }
  }
  sorted.set(distances);
  sorted.sort();
  const longest = sorted[5]!;
  for (let i = 0; i < 5; i += 1) ratios[i] = sorted[4 - i]! / longest;
  const ranked = [0, 1, 2, 3].sort((a, b) => sums[b]! - sums[a]!);
  for (let i = 0; i < 4; i += 1) into[i] = four[ranked[i]!]!;
  return longest;
}

function keyOf(offsets = 0): number {
  let key = 0;
  for (let i = 0; i < 5; i += 1) {
    const exact = ratios[i]! / STEP;
    let step = Math.min(STEPS - 1, Math.floor(exact));
    if ((offsets >> i) & 1) step += exact - step < 0.5 ? -1 : 1;
    if (step < 0 || step >= STEPS) return -1;
    key = key * STEPS + step;
  }
  return key;
}

/** Every quad a star makes with three of its four nearest neighbours, handed one at a time to `each`. */
function quadsAround(
  field: StarField,
  star: number,
  each: (four: Int32Array) => void,
  neighbours = NEIGHBOURS,
): void {
  const near = nearestStars(field, star, neighbours, REACH, []);
  const four = new Int32Array(4);
  four[0] = star;
  for (let i = 0; i < near.length; i += 1) {
    for (let j = i + 1; j < near.length; j += 1) {
      for (let l = j + 1; l < near.length; l += 1) {
        four[1] = near[i]!;
        four[2] = near[j]!;
        four[3] = near[l]!;
        each(four);
      }
    }
  }
}

export function quadIndexOf(field: StarField): QuadIndex {
  const most = field.count * 10;
  const keys = new Uint32Array(most);
  const stars = new Int32Array(most * 4);
  const spans = new Float32Array(most);
  const ordered = new Int32Array(4);
  let count = 0;
  for (let star = 0; star < field.count; star += 1) {
    quadsAround(field, star, (four) => {
      const span = shapeOf(field, four, ordered);
      if (span < SMALLEST_QUAD) return;
      keys[count] = keyOf();
      stars.set(ordered, count * 4);
      spans[count] = span;
      count += 1;
    });
  }
  const byKey = new Int32Array(count);
  for (let quad = 0; quad < count; quad += 1) byKey[quad] = quad;
  byKey.sort((a, b) => keys[a]! - keys[b]!);
  const index: QuadIndex = {
    field,
    keys: new Uint32Array(count),
    stars: new Int32Array(count * 4),
    spans: new Float32Array(count),
  };
  for (let at = 0; at < count; at += 1) {
    const quad = byKey[at]!;
    index.keys[at] = keys[quad]!;
    index.spans[at] = spans[quad]!;
    index.stars.set(stars.subarray(quad * 4, quad * 4 + 4), at * 4);
  }
  return index;
}

function firstAtLeast(keys: Uint32Array, key: number): number {
  let low = 0;
  let high = keys.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (keys[middle]! < key) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * A guess at where a star's neighbourhood came from: the turn, the stretch and the mirror that carry it onto
 * plain Earth, as a 2x2 matrix `a b / c d` and the point `(toX, toY)` that `(fromX, fromY)` lands on.
 */
export interface Guess {
  a: number;
  b: number;
  c: number;
  d: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** The share of the stars round about that land on one of Earth's, after allowing for how crowded it is there. */
  agreement: number;
}

/** How far Adam is taken to stretch or shrink a piece, at most. */
export const STRETCH = 1.8;

const ordered = new Int32Array(4);
const theirs = new Int32Array(4);
const around: number[] = [];
const landed: number[] = [];

/** The best few guesses at where the land round one of the edited master's stars came from, best first. */
export function guessesFor(
  edited: StarField,
  index: QuadIndex,
  star: number,
  isLand: (x: number, y: number) => boolean,
  most = 4,
): Guess[] {
  const base = index.field;
  const guesses: Guess[] = [];
  const tried = new Set<number>();
  starsWithin(edited, edited.x[star]!, edited.y[star]!, 60, around);
  const nearby = around.slice();
  quadsAround(
    edited,
    star,
    (four) => {
      const span = shapeOf(edited, four, ordered);
      if (span < SMALLEST_QUAD) return;
      for (let offsets = 0; offsets < 32; offsets += 1) {
        const key = keyOf(offsets);
        if (key < 0) continue;
        for (
          let at = firstAtLeast(index.keys, key);
          at < index.keys.length && index.keys[at] === key;
          at += 1
        ) {
          if (tried.has(at)) continue;
          tried.add(at);
          const stretch = index.spans[at]! / span;
          if (stretch > STRETCH || stretch < 1 / STRETCH) continue;
          for (let i = 0; i < 4; i += 1) theirs[i] = index.stars[at * 4 + i]!;
          const guess = similarity(edited, ordered, base, theirs, span * stretch);
          if (guess === null) continue;
          guess.agreement = agreementOf(edited, base, nearby, guess, stretch, star, isLand);
          if (guess.agreement >= 0.5) guesses.push(guess);
        }
      }
    },
    ASKING,
  );
  return guesses.sort((p, q) => q.agreement - p.agreement).slice(0, most);
}

/** The stretch, turn and perhaps mirror that best carry four stars onto four others, or null if none fits. */
function similarity(
  from: StarField,
  ours: Int32Array,
  to: StarField,
  others: Int32Array,
  size: number,
): Guess | null {
  let best: Guess | null = null;
  let bestMiss = Infinity;
  for (const mirror of [1, -1]) {
    let fromX = 0;
    let fromY = 0;
    let toX = 0;
    let toY = 0;
    for (let i = 0; i < 4; i += 1) {
      fromX += (mirror * from.x[ours[i]!]!) / 4;
      fromY += from.y[ours[i]!]! / 4;
      toX += to.x[others[i]!]! / 4;
      toY += to.y[others[i]!]! / 4;
    }
    let dot = 0;
    let cross = 0;
    let norm = 0;
    for (let i = 0; i < 4; i += 1) {
      const px = mirror * from.x[ours[i]!]! - fromX;
      const py = from.y[ours[i]!]! - fromY;
      const qx = to.x[others[i]!]! - toX;
      const qy = to.y[others[i]!]! - toY;
      dot += px * qx + py * qy;
      cross += px * qy - py * qx;
      norm += px * px + py * py;
    }
    const cos = dot / norm;
    const sin = cross / norm;
    let miss = 0;
    for (let i = 0; i < 4; i += 1) {
      const px = mirror * from.x[ours[i]!]! - fromX;
      const py = from.y[ours[i]!]! - fromY;
      miss +=
        (toX + cos * px - sin * py - to.x[others[i]!]!) ** 2 +
        (toY + sin * px + cos * py - to.y[others[i]!]!) ** 2;
    }
    if (miss < bestMiss) {
      bestMiss = miss;
      // The mirror is folded into the matrix, so the guess carries any point as it is: x is flipped first.
      best = {
        a: cos * mirror,
        b: -sin,
        c: sin * mirror,
        d: cos,
        fromX: fromX * mirror,
        fromY,
        toX,
        toY,
        agreement: 0,
      };
    }
  }
  // Each middle is within half a pixel of the truth, so four of them miss by a few square pixels at most.
  return bestMiss <= 4 + 0.0005 * size * size ? best : null;
}

/** Where a guess carries a point of the edited master. */
export function carry(guess: Guess, x: number, y: number): [number, number] {
  const dx = x - guess.fromX;
  const dy = y - guess.fromY;
  return [guess.toX + guess.a * dx + guess.b * dy, guess.toY + guess.c * dx + guess.d * dy];
}

function agreementOf(
  edited: StarField,
  base: StarField,
  nearby: readonly number[],
  guess: Guess,
  stretch: number,
  middle: number,
  isLand: (x: number, y: number) => boolean,
): number {
  let hits = 0;
  for (const star of nearby) {
    const [x, y] = carry(guess, edited.x[star]!, edited.y[star]!);
    if (starsWithin(base, x, y, 1.5 * Math.max(1, stretch), landed).length > 0) hits += 1;
  }
  if (hits < 4) return 0;
  // Counted against whichever side has more stars there, so that shrinking a piece onto ground dense with
  // lakes, where anything lands on something, earns nothing. Earth's are counted only where they would land
  // back on land, because a piece cut out of Earth has lost the lakes beyond its edge.
  const [x, y] = carry(guess, edited.x[middle]!, edited.y[middle]!);
  const det = guess.a * guess.d - guess.b * guess.c;
  let there = 0;
  for (const star of starsWithin(base, x, y, 60 * stretch, landed)) {
    const dx = base.x[star]! - guess.toX;
    const dy = base.y[star]! - guess.toY;
    const back = guess.fromX + (guess.d * dx - guess.b * dy) / det;
    const down = guess.fromY + (-guess.c * dx + guess.a * dy) / det;
    if (Math.hypot(back - edited.x[middle]!, down - edited.y[middle]!) <= 60 && isLand(back, down))
      there += 1;
  }
  return hits / Math.max(nearby.length, there);
}
