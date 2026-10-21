import type { ModelPoint } from './bridgeModel.ts';
import { fraction, noise } from './modelRender.ts';
import type { Model } from './modelRender.ts';

/*
 * A stub of dry-stone wall, modelled once in 3D for the roadside: a length of rough stones laid without mortar, its
 * top uneven, a little narrower at the top than at its foot; mossy where it is green and wet, its top grown over and
 * moss in the joints near it, or bare and pale where it is dry. In its own frame, `s` along it from its middle, `w`
 * across and `z` up, in world units, `WALL_LENGTH` long, so stubs laid end to end along a road's side make a wall.
 * Drawn along each of the eight ways by `modelRender.ts`. See docs/plans/houses-bridges-and-road-render.md.
 */

/** How long a stub of wall is, end to end, in world units: the roadside lays them one after another. */
export const WALL_LENGTH = 1;

/** A wall green with moss, or bare and dry. */
export const WALL_STYLES = ['mossy', 'bare'] as const;
export type WallStyle = (typeof WALL_STYLES)[number];

const PARTS = ['stone', 'moss'] as const;
type WallPart = (typeof PARTS)[number];

const HALF = WALL_LENGTH / 2;
/** Half its thickness at its foot and at its top. */
const FOOT = 0.11;
const TOP = 0.09;
const STRIPS = 40;

/** How high the wall's top is at `s`: about a third of a unit, uneven as stones laid by hand. */
export function wallTopAt(s: number): number {
  return 0.27 + 0.03 * Math.sin(s * 9.1 + 0.6) + 0.018 * Math.sin(s * 23.3 + 1.7);
}

const quad = (part: WallPart, a: ModelPoint, b: ModelPoint, c: ModelPoint, d: ModelPoint) => [
  { at: [a, b, c] as const, part },
  { at: [a, c, d] as const, part },
];

function trianglesOf(style: WallStyle): Model<WallPart>['triangles'] {
  const out: { at: readonly [ModelPoint, ModelPoint, ModelPoint]; part: WallPart }[] = [];
  for (let step = 0; step < STRIPS; step += 1) {
    const s0 = -HALF + (WALL_LENGTH * step) / STRIPS;
    const s1 = -HALF + (WALL_LENGTH * (step + 1)) / STRIPS;
    const [t0, t1] = [wallTopAt(s0), wallTopAt(s1)];
    for (const side of [-1, 1]) {
      out.push(
        ...quad(
          'stone',
          [s0, side * FOOT, 0],
          [s1, side * FOOT, 0],
          [s1, side * TOP, t1],
          [s0, side * TOP, t0],
        ),
      );
    }
    out.push(...quad('stone', [s0, -TOP, t0], [s1, -TOP, t1], [s1, TOP, t1], [s0, TOP, t0]));
    if (style === 'mossy') {
      // A cushion of moss over the top, hanging a little down either side.
      const [m0, m1] = [t0 + 0.035, t1 + 0.035];
      out.push(
        ...quad(
          'moss',
          [s0, -TOP - 0.012, m0],
          [s1, -TOP - 0.012, m1],
          [s1, TOP + 0.012, m1],
          [s0, TOP + 0.012, m0],
        ),
      );
      for (const side of [-1, 1]) {
        out.push(
          ...quad(
            'moss',
            [s0, side * (TOP + 0.012), m0],
            [s1, side * (TOP + 0.012), m1],
            [s1, side * (TOP + 0.016), m1 - 0.07],
            [s0, side * (TOP + 0.016), m0 - 0.07],
          ),
        );
      }
    }
  }
  for (const end of [-HALF, HALF]) {
    out.push(
      ...quad(
        'stone',
        [end, -FOOT, 0],
        [end, FOOT, 0],
        [end, TOP, wallTopAt(end)],
        [end, -TOP, wallTopAt(end)],
      ),
    );
  }
  return out;
}

const STONE: Readonly<Record<WallStyle, readonly [number, number, number]>> = {
  mossy: [150, 146, 134],
  bare: [200, 184, 150],
};
const MOSS: readonly [number, number, number] = [92, 124, 58];

/** A stone's colour at a point: rough courses of stones of uneven length, the dark gaps between them, moss near the top. */
function colourAt(style: WallStyle, part: WallPart, [s, , z]: ModelPoint): readonly [number, number, number] {
  if (part === 'moss') {
    const by = 0.85 + 0.25 * noise(Math.floor(s / 0.05), Math.floor(z / 0.05));
    return MOSS.map((value) => value * by) as [number, number, number];
  }
  const course = Math.floor(z / 0.065);
  const shift = noise(course, 3) * 0.13;
  const length = 0.08 + 0.07 * noise(course, Math.floor((s + shift) / 0.13));
  const block = Math.floor((s + shift) / length);
  const gap = fraction(z / 0.065) < 0.16 || fraction((s + shift) / length) < 0.1;
  const by = gap ? 0.55 : 0.84 + 0.24 * noise(block, course);
  const [red, green, blue] = STONE[style];
  // Moss creeping into the joints near the top of a mossy wall.
  if (style === 'mossy' && !gap && z > wallTopAt(s) - 0.1 && noise(block, course + 50) > 0.55) {
    return [MOSS[0] * by, MOSS[1] * by, MOSS[2] * by];
  }
  return [red * by, green * by, blue * by];
}

/** The wall stub of a style, as a model to draw. */
export function wallModel(style: WallStyle): Model<WallPart> {
  return {
    parts: PARTS,
    triangles: trianglesOf(style),
    colourAt: (part, point) => colourAt(style, part, point),
  };
}
