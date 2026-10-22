/**
 * The shapes of a strike of lightning, worked out and not drawn: the arc it follows through the air, the jagged bolt
 * along the arc, the forks off the bolt, and the crackle round whatever it strikes. Each from a seed, so the same seed is
 * the same bolt, which is what lets a bolt flicker by being worked out again with another and a leader grow along one
 * channel. In the pixels of whatever draws it, down the screen positive.
 */

export interface Spot {
  readonly x: number;
  readonly y: number;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A source of random numbers from 0 to 1, the same ones for the same seed: mulberry32. */
export function randomOf(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The way a strike goes: a curve, a place and a sideways at every share of it, and how long it is. */
export interface Arc {
  readonly at: (t: number) => Spot;
  /** One pixel sideways from the curve at `t`, to its left going along it. */
  readonly normal: (t: number) => Spot;
  readonly length: number;
}

/**
 * The arc a strike follows from `from` to `to`: a curve rising `rise` pixels above the straight way between them at its
 * middle, so it arches through the air and comes down on what it strikes. None, and it is the straight way.
 */
export function arcOf(from: Spot, to: Spot, rise = 0): Arc {
  const control = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 2 * rise };
  const at = (t: number): Spot => {
    const s = 1 - t;
    return {
      x: s * s * from.x + 2 * s * t * control.x + t * t * to.x,
      y: s * s * from.y + 2 * s * t * control.y + t * t * to.y,
    };
  };
  const normal = (t: number): Spot => {
    const dx = 2 * (1 - t) * (control.x - from.x) + 2 * t * (to.x - control.x);
    const dy = 2 * (1 - t) * (control.y - from.y) + 2 * t * (to.y - control.y);
    const size = Math.hypot(dx, dy) || 1;
    return { x: dy / size, y: -dx / size };
  };
  let length = 0;
  let last = from;
  for (let step = 1; step <= 16; step += 1) {
    const next = at(step / 16);
    length += Math.hypot(next.x - last.x, next.y - last.y);
    last = next;
  }
  return { at, normal, length };
}

/** How jagged a bolt is: how many times its way is halved, and how far it may wander off the arc, a share of its length. */
export interface Jag {
  readonly detail: number;
  readonly rough: number;
  /** How much less each halving wanders than the last: a half is a bolt, nearer one a smoother thread. */
  readonly calm?: number;
}

/** How far off its arc each point of a bolt is pushed: midpoint displacement, nothing at either end. */
export function wanderOf(seed: number, jag: Jag, length: number): number[] {
  const count = 2 ** jag.detail;
  const random = randomOf(seed);
  const offsets = new Array<number>(count + 1).fill(0);
  let reach = jag.rough * length;
  for (let step = count / 2; step >= 1; step /= 2) {
    for (let at = step; at < count; at += 2 * step) {
      offsets[at] = (offsets[at - step]! + offsets[at + step]!) / 2 + (random() * 2 - 1) * reach;
    }
    reach *= jag.calm ?? 0.5;
  }
  return offsets;
}

/** A bolt along an arc: its points, each pushed sideways off the arc by `offsets`, from its first to its last. */
export function boltOn(arc: Arc, offsets: readonly number[]): Spot[] {
  const count = offsets.length - 1;
  return offsets.map((offset, at) => {
    const t = at / count;
    const spot = arc.at(t);
    const normal = arc.normal(t);
    return { x: spot.x + normal.x * offset, y: spot.y + normal.y * offset };
  });
}

/** A jagged bolt along an arc, from a seed. */
export function boltAlong(arc: Arc, seed: number, jag: Jag): Spot[] {
  return boltOn(arc, wanderOf(seed, jag, arc.length));
}

/**
 * The forks off a bolt, `count` of them: each from one of its points along its middle, turned off its way by twenty to
 * fifty degrees either side, a fifth to a third of the bolt's length and dying out short of anything.
 */
export function forksOf(bolt: readonly Spot[], seed: number, count: number): Spot[][] {
  const random = randomOf(seed);
  const first = bolt[0]!;
  const last = bolt[bolt.length - 1]!;
  const length = Math.hypot(last.x - first.x, last.y - first.y);
  const forks: Spot[][] = [];
  for (let fork = 0; fork < count; fork += 1) {
    const at = Math.floor((0.15 + random() * 0.65) * (bolt.length - 1));
    const from = bolt[at]!;
    const on = bolt[Math.min(at + 2, bolt.length - 1)]!;
    const way =
      Math.atan2(on.y - from.y, on.x - from.x) + (random() < 0.5 ? -1 : 1) * (0.35 + random() * 0.5);
    const reach = length * (0.2 + random() * 0.15);
    const to = { x: from.x + Math.cos(way) * reach, y: from.y + Math.sin(way) * reach };
    forks.push(boltAlong(arcOf(from, to), seed * 31 + fork, { detail: 4, rough: 0.16 }));
  }
  return forks;
}

/** The place `along` pixels round a box's edge, clockwise from its top left corner, and which way is out from there. */
function roundEdge(box: Box, along: number): { at: Spot; out: Spot } {
  const round = 2 * (box.width + box.height);
  let left = ((along % round) + round) % round;
  if (left < box.width) return { at: { x: box.x + left, y: box.y }, out: { x: 0, y: -1 } };
  left -= box.width;
  if (left < box.height) return { at: { x: box.x + box.width, y: box.y + left }, out: { x: 1, y: 0 } };
  left -= box.height;
  if (left < box.width)
    return { at: { x: box.x + box.width - left, y: box.y + box.height }, out: { x: 0, y: 1 } };
  left -= box.width;
  return { at: { x: box.x, y: box.y + box.height - left }, out: { x: -1, y: 0 } };
}

/**
 * The crackle of something a strike reached: `count` small arcs crawling along its edge, each from one place on it to
 * another a little way round, and as many sparks thrown off it outward. Worked out again with another seed each moment,
 * so they crawl.
 */
export function crackleOn(box: Box, seed: number, count: number): Spot[][] {
  const random = randomOf(seed);
  const round = 2 * (box.width + box.height);
  const arcs: Spot[][] = [];
  for (let one = 0; one < count; one += 1) {
    const along = random() * round;
    const start = roundEdge(box, along);
    const end = roundEdge(box, along + 14 + random() * 30);
    arcs.push(boltAlong(arcOf(start.at, end.at), seed * 17 + one, { detail: 3, rough: 0.35 }));
    const spark = roundEdge(box, random() * round);
    const reach = 6 + random() * 16;
    const tip = {
      x: spark.at.x + (spark.out.x + (random() - 0.5)) * reach,
      y: spark.at.y + (spark.out.y + (random() - 0.5)) * reach,
    };
    arcs.push(boltAlong(arcOf(spark.at, tip), seed * 19 + one, { detail: 2, rough: 0.3 }));
  }
  return arcs;
}

/**
 * How much of its bolt a stepped leader has grown at `t`, a share of the time it takes: in `steps` jerks, each held a
 * moment and then jumping on, never back, all of it at the end.
 */
export function leaderShare(t: number, steps: number, seed: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const random = randomOf(seed);
  const strides = Array.from({ length: steps }, () => 0.4 + random());
  const whole = strides.reduce((sum, stride) => sum + stride, 0);
  const taken = Math.floor(t * steps);
  return strides.slice(0, taken).reduce((sum, stride) => sum + stride, 0) / whole;
}

/** The first `share` of a bolt, the last point of it cut part way along its segment. */
export function grownTo(bolt: readonly Spot[], share: number): Spot[] {
  if (share >= 1) return [...bolt];
  const end = share * (bolt.length - 1);
  const whole = Math.floor(end);
  const part = end - whole;
  const grown = bolt.slice(0, whole + 1);
  const from = bolt[whole];
  const to = bolt[whole + 1];
  if (from !== undefined && to !== undefined && part > 0) {
    grown.push({ x: from.x + (to.x - from.x) * part, y: from.y + (to.y - from.y) * part });
  }
  return grown;
}
