/*
 * The bridge, modelled once in 3D: one stone bridge for every culture and every river, a humped deck between low
 * parapets carried over three arches on two piers with cutwaters, a ramp down to the road at each end. In its own
 * frame, `s` along the deck from its middle, `w` across it and `z` up, in world units, as long as `BRIDGE_SPAN`: the
 * map stretches it along its deck to each bridge's span. `bridgeRender.ts` draws it in the map's camera along each of
 * the eight ways a bridge may run, for asseterizer to paint over (docs/plans/houses-bridges-and-road-render.md).
 */

/** How long the bridge is modelled, end to end, in world units: the map stretches it along its deck to each span. */
export const BRIDGE_LENGTH = 4;

/**
 * The eight ways a bridge may run: the lattice's two axes, its two diagonals and the four halfway between them, each
 * named by the axes it lies between. A bridge reads the same from either end, so eight ways are every direction.
 */
export const BRIDGE_WAYS = ['u', 'u-uv', 'uv', 'uv-v', 'v', 'v-vu', 'vu', 'vu-u'] as const;
export type BridgeWay = (typeof BRIDGE_WAYS)[number];

/** Each way as whole steps along the lattice's U and V: two along one axis for one along the other between them. */
export const WAY_STEPS: Readonly<Record<BridgeWay, readonly [number, number]>> = {
  u: [1, 0],
  'u-uv': [2, 1],
  uv: [1, 1],
  'uv-v': [1, 2],
  v: [0, 1],
  'v-vu': [-1, 2],
  vu: [-1, 1],
  'vu-u': [-2, 1],
};

/** A point of the model: along its deck from the middle, across it, and up, in world units. */
export type ModelPoint = readonly [s: number, w: number, z: number];

/** The parts the model is made of: an ink line is drawn where one meets another, and each has its own colour. */
export const BRIDGE_PARTS = ['wall', 'parapet', 'cap', 'deck', 'pier', 'cutwater'] as const;
export type BridgePart = (typeof BRIDGE_PARTS)[number];

export interface ModelTriangle {
  readonly at: readonly [ModelPoint, ModelPoint, ModelPoint];
  readonly part: BridgePart;
}

const HALF = BRIDGE_LENGTH / 2;
/** Half the body's width, and half the road's between the parapets. */
const BODY = 0.55;
const ROAD = 0.46;
const PARAPET = 0.24;
/** The arches: where each is centred along the deck, half its opening, how high its crown rises over its springing. */
export const ARCHES: readonly { readonly middle: number; readonly half: number; readonly rise: number }[] = [
  { middle: -1.05, half: 0.32, rise: 0.3 },
  { middle: 0, half: 0.55, rise: 0.48 },
  { middle: 1.05, half: 0.32, rise: 0.3 },
];
/** How high every arch springs from its pier, over the water. */
export const SPRINGING = 0.12;
/** How far a cutwater juts from the wall, and how high it stands before its cap slopes back to the wall. */
const CUTWATER = 0.28;
const CUTWATER_TALL = 0.34;
const CUTWATER_CAP = 0.52;
/** How many strips the curved surfaces are cut into along the deck. */
const STRIPS = 200;

/** How high the road on the deck is at `s`: a hump, highest in the middle, down to the road at either end. */
export function deckAt(s: number): number {
  return 0.1 + 0.85 * (1 - Math.abs(s / HALF) ** 2.2);
}

/** How high the parapet stands over the deck at `s`: full along the arches, fading to nothing at the ends. */
function parapetAt(s: number): number {
  const t = Math.min(1, Math.max(0, (HALF - Math.abs(s)) / 0.45));
  return PARAPET * t;
}

/** The underside of the masonry at `s`: an arch's soffit over its opening, the ground elsewhere. */
export function soffitAt(s: number): number {
  for (const { middle, half, rise } of ARCHES) {
    const t = (s - middle) / half;
    if (Math.abs(t) < 1) return SPRINGING + rise * Math.sqrt(1 - t * t);
  }
  return 0;
}

/** The piers between the arches, as their two ends along the deck. */
export function piers(): [number, number][] {
  const out: [number, number][] = [];
  for (let at = 1; at < ARCHES.length; at += 1) {
    out.push([ARCHES[at - 1]!.middle + ARCHES[at - 1]!.half, ARCHES[at]!.middle - ARCHES[at]!.half]);
  }
  return out;
}

/** The points the strips are cut at: even steps, and every arch's ends and every pier's, so no edge is cut across. */
function cuts(): number[] {
  const at = new Set<number>();
  for (let step = 0; step <= STRIPS; step += 1) at.add(-HALF + (BRIDGE_LENGTH * step) / STRIPS);
  for (const { middle, half } of ARCHES) {
    at.add(middle - half);
    at.add(middle + half);
  }
  return [...at].sort((one, other) => one - other);
}

const quad = (
  part: BridgePart,
  a: ModelPoint,
  b: ModelPoint,
  c: ModelPoint,
  d: ModelPoint,
): ModelTriangle[] => [
  { at: [a, b, c], part },
  { at: [a, c, d], part },
];

/** The whole bridge as triangles in its own frame. */
export function bridgeTriangles(): ModelTriangle[] {
  const out: ModelTriangle[] = [];
  const along = cuts();
  for (let at = 1; at < along.length; at += 1) {
    const s0 = along[at - 1]!;
    const s1 = along[at]!;
    const [d0, d1] = [deckAt(s0), deckAt(s1)];
    const [p0, p1] = [d0 + parapetAt(s0), d1 + parapetAt(s1)];
    const mid = (s0 + s1) / 2;
    const [b0, b1] = soffitAt(mid) > 0 ? [soffitAt(s0), soffitAt(s1)] : [0, 0];
    for (const side of [-1, 1]) {
      // The wall up to the deck, the parapet's outer face on it, its inner face and its cap.
      out.push(
        ...quad(
          'wall',
          [s0, side * BODY, b0],
          [s1, side * BODY, b1],
          [s1, side * BODY, d1],
          [s0, side * BODY, d0],
        ),
      );
      out.push(
        ...quad(
          'parapet',
          [s0, side * BODY, d0],
          [s1, side * BODY, d1],
          [s1, side * BODY, p1],
          [s0, side * BODY, p0],
        ),
      );
      out.push(
        ...quad(
          'parapet',
          [s0, side * ROAD, d0],
          [s1, side * ROAD, d1],
          [s1, side * ROAD, p1],
          [s0, side * ROAD, p0],
        ),
      );
      out.push(
        ...quad(
          'cap',
          [s0, side * ROAD, p0],
          [s1, side * ROAD, p1],
          [s1, side * BODY, p1],
          [s0, side * BODY, p0],
        ),
      );
    }
    out.push(...quad('deck', [s0, -ROAD, d0], [s1, -ROAD, d1], [s1, ROAD, d1], [s0, ROAD, d0]));
    // The soffit of an arch, seen only through its opening.
    if (b0 > 0 || b1 > 0) {
      out.push(...quad('wall', [s0, -BODY, b0], [s1, -BODY, b1], [s1, BODY, b1], [s0, BODY, b0]));
    }
  }
  // The ends, down to the road, and the piers' faces under the springing, seen through the arches.
  for (const end of [-HALF, HALF]) {
    out.push(
      ...quad('wall', [end, -BODY, 0], [end, BODY, 0], [end, BODY, deckAt(end)], [end, -BODY, deckAt(end)]),
    );
  }
  for (const [from, to] of piers()) {
    for (const face of [from, to]) {
      out.push(
        ...quad('pier', [face, -BODY, 0], [face, BODY, 0], [face, BODY, SPRINGING], [face, -BODY, SPRINGING]),
      );
    }
    // A cutwater on each side: a wedge against the stream, its cap sloping back up to the wall.
    const middle = (from + to) / 2;
    for (const side of [-1, 1]) {
      const tip = side * (BODY + CUTWATER);
      for (const face of [from, to]) {
        out.push(
          ...quad(
            'cutwater',
            [face, side * BODY, 0],
            [middle, tip, 0],
            [middle, tip, CUTWATER_TALL],
            [face, side * BODY, CUTWATER_TALL],
          ),
        );
        out.push({
          at: [
            [face, side * BODY, CUTWATER_TALL],
            [middle, tip, CUTWATER_TALL],
            [middle, side * BODY, CUTWATER_CAP],
          ],
          part: 'cutwater',
        });
      }
    }
  }
  return out;
}
