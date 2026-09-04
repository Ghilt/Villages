import { toRgb } from './palette.ts';
import type { Palette, Rgb } from './palette.ts';

/**
 * What the world looks like: the painterly treatment, as pure functions of a position.
 *
 * The world is thirty-two terrain classes, one per pixel, and drawing each in its own flat colour looks
 * exactly like what it is, a classified satellite image. This module is the answer to that. It takes the
 * same data and paints it: colour that pools and varies inside a region, boundaries that wander instead of
 * following the pixel grid, pigment gathering darker along an edge, a mark per kind of ground, and paper
 * under all of it.
 *
 * Nothing here touches a file, an image or a canvas, for two reasons. It can be unit-tested, which a look
 * otherwise cannot be. And every function is arithmetic over two coordinates with no loops over pixels and
 * no state, which is the shape a fragment shader wants: this is meant to be ported to GLSL almost line for
 * line once the look is settled, so the live map can draw it at any zoom instead of baking it into tiles.
 *
 * Two coordinate spaces, and keeping them apart is the whole trick.
 *
 * **World space** is master pixels, so a distance in it is a distance on the ground. The shape of the
 * land lives here, and only that: which class a point is, and how far a boundary strays from the grid it
 * was stored on. Zooming in magnifies it, as it should, because it is the terrain.
 *
 * **Brush space** is world position divided by how much ground one output pixel covers, so one unit is
 * one pixel on screen wherever you are. The medium lives here: the grain of the paper, the wash of colour
 * pooling and thinning, the stipple of a forest, the hatch on bare rock. A mark stays the size of a mark at every zoom, which is what makes it
 * read as a mark rather than as geography. It is anchored to the world rather than to the screen, so the
 * texture stays put on the land when the map is panned.
 */

/** A deterministic value in [0, 1) from two integers and a seed. WebGL2 has the integer maths for this. */
export function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Hermite ease, so noise arrives without the creases that linear interpolation leaves on a grid. */
function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

export function smoothstep(edge0: number, edge1: number, at: number): number {
  if (edge0 === edge1) {
    return at < edge0 ? 0 : 1;
  }
  const t = Math.min(1, Math.max(0, (at - edge0) / (edge1 - edge0)));
  return ease(t);
}

/** Smooth value noise in [0, 1]: a hash at every lattice point, eased between them. */
export function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = ease(x - x0);
  const fy = ease(y - y0);
  const top = hash2(x0, y0, seed) * (1 - fx) + hash2(x0 + 1, y0, seed) * fx;
  const bottom = hash2(x0, y0 + 1, seed) * (1 - fx) + hash2(x0 + 1, y0 + 1, seed) * fx;
  return top * (1 - fy) + bottom * fy;
}

/** Octaves of value noise, halving in weight and doubling in frequency. Stays in [0, 1]. */
export function fbm(x: number, y: number, seed: number, octaves = 3): number {
  let sum = 0;
  let weight = 0;
  let amplitude = 1;
  let frequency = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += valueNoise(x * frequency, y * frequency, seed + octave * 101) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return weight === 0 ? 0 : sum / weight;
}

const TAU = Math.PI * 2;

/**
 * The mark a kind of ground is drawn with. One scalar in roughly [-1, 1], added to lightness, so a
 * treatment darkens where the medium gathers and lightens where it does not.
 *
 * These are the vocabulary of the map, and the reason it can say "forest" without drawing a tree. The
 * coordinates arrive already scaled and rotated, in units of the mark itself.
 */
export type TreatmentKind =
  'none' | 'speckle' | 'stipple' | 'hatch' | 'dunes' | 'dashes' | 'ripple' | 'patchwork';

export function treatment(kind: TreatmentKind, x: number, y: number, seed: number): number {
  switch (kind) {
    case 'none':
      return 0;
    /** Open ground: a fine tooth, barely there, so grass is not a flat fill. */
    case 'speckle':
      return fbm(x, y, seed, 2) * 2 - 1;
    /** Forest: clumps of canopy, dark where they gather and pale in the gaps between. */
    case 'stipple': {
      const n = fbm(x, y, seed, 2);
      return smoothstep(0.48, 0.24, n) * 0.55 - smoothstep(0.54, 0.8, n);
    }
    /** High ground: broken hatching, the way relief is drawn when it is not drawn as a mountain. */
    case 'hatch': {
      const line = 0.5 + 0.5 * Math.cos(y * TAU);
      return -(line * line) * (0.35 + 0.95 * fbm(x * 0.3, y * 0.3, seed, 2));
    }
    /** Dry ground: noise pulled long in one direction, which is what a dune field looks like from above. */
    case 'dunes':
      return (fbm(x * 0.22, y * 1.7, seed, 2) * 2 - 1) * 1.1;
    /** Wetland: short marks lying across the ground, the old symbol for a marsh. */
    case 'dashes': {
      const n = valueNoise(x * 0.45, y * 2.4, seed);
      return -smoothstep(0.56, 0.74, n);
    }
    /** Water: a slow wave, low enough to read as a surface rather than as a pattern. */
    case 'ripple':
      return Math.sin((y + fbm(x * 0.4, y * 0.4, seed, 2) * 2.2) * TAU) * 0.5;
    /** Farmed ground: one tone a field, which is a quilt from above and needs no lines drawn on it. */
    case 'patchwork':
      return (hash2(Math.floor(x), Math.floor(y), seed) * 2 - 1) * 0.85;
  }
}

/** The class of the terrain at a position in world space. Nearest, always: classes do not average. */
export type ClassSampler = (x: number, y: number) => number;

/** How one group of terrain is drawn. The eight groups are the palette's own. */
export interface GroupStyle {
  treatment: TreatmentKind;
  /** How big one mark is, in output pixels. */
  mark: number;
  /** How far the mark may move lightness, at most. */
  amount: number;
  /** Which way the marks lie, in degrees. Only the directional treatments care. */
  angle?: number;
  /** How much of the global wash this group takes, one being all of it. Water wants far less. */
  wash?: number;
}

/** The style, as it is written in `world/painterly.json`. */
export interface PainterlyStyle {
  /** The two ends every colour is washed between, so no region is one flat swatch. */
  warm: string;
  cool: string;
  wash: { amount: number; mark: number };
  /** How far a boundary strays from the grid it was stored on, in master pixels. */
  boundary: { wander: number; scale: number };
  /** Pigment gathering along an edge. `reach` is in output pixels, so the line keeps its width. */
  edge: { amount: number; reach: number };
  /** The drawn shore, wherever water meets land. */
  shore: { ink: string; amount: number };
  paper: { grain: number; mark: number; fibre: number };
  /**
   * How many steps the wash is allowed, or absent for as many as there are. Cutting it to a handful is
   * what separates a print from a painting: the colour goes flat inside a band and steps at its edge.
   */
  posterise?: number;
  groups: Record<string, GroupStyle>;
}

interface PreparedClass {
  lighter: Rgb;
  darker: Rgb;
  treatment: TreatmentKind;
  mark: number;
  amount: number;
  cos: number;
  sin: number;
  seed: number;
  water: boolean;
}

export interface PreparedPainterly {
  classes: readonly PreparedClass[];
  ink: Rgb;
  wash: PainterlyStyle['wash'];
  boundary: PainterlyStyle['boundary'];
  edge: PainterlyStyle['edge'];
  shore: { amount: number };
  paper: PainterlyStyle['paper'];
  posterise: number;
}

function clamp255(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
}

export function mix(a: Rgb, b: Rgb, at: number): Rgb {
  const t = at < 0 ? 0 : at > 1 ? 1 : at;
  return [
    clamp255(a[0] + (b[0] - a[0]) * t),
    clamp255(a[1] + (b[1] - a[1]) * t),
    clamp255(a[2] + (b[2] - a[2]) * t),
  ];
}

/** A stable seed per group, so every class of forest shares one canopy and not one per class. */
function seedOf(group: string): number {
  let seed = 0x811c9dc5;
  for (let at = 0; at < group.length; at += 1) {
    seed = Math.imul(seed ^ group.charCodeAt(at), 0x01000193) | 0;
  }
  return seed & 0x7fffffff;
}

/** Eight directions at one distance. Four would quantise an edge into four steps and show it. */
const DIAGONAL = Math.SQRT1_2;
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [DIAGONAL, DIAGONAL],
  [-DIAGONAL, DIAGONAL],
  [DIAGONAL, -DIAGONAL],
  [-DIAGONAL, -DIAGONAL],
];

/**
 * The narrowest the wet edge may be, in master pixels.
 *
 * The reach wants to be `edge.reach` output pixels, which is `edge.reach * masterPerPixel` in master
 * pixels, and that is right at every zoom but the closest ones. Past the depth the terrain was cut at,
 * one terrain sample covers several output pixels, so the wanted reach falls below a sample and the
 * neighbours all land in the same one: no boundary is ever found and the edge disappears. A third of a
 * sample is enough to cross into the next one often enough to draw a line.
 *
 * There was a ceiling here too, of three master pixels, put in to stop a whole-world view turning to
 * mud. It was a units error and it caused exactly the opposite. Below the cut depth a terrain sample IS
 * a master pixel times `masterPerPixel`, so at zoom three the wanted reach is 22 master pixels and the
 * ceiling cut it to three, which is a fifth of one sample: no shore, no lake edge, nothing. The step up
 * to zoom four then put them back, which is the jump that gave it away.
 */
const REACH_FLOOR = 0.35;

/**
 * The colour of one pixel of the world.
 *
 * Everything the treatment does happens here, in this order: the boundary wanders, the class is read at
 * where it wandered to, the neighbours say how close an edge is, colour drifts between a warm and a cool
 * version of the class, the ground's own mark and the paper move the lightness, and a shore is drawn in
 * ink wherever water meets land.
 *
 * `masterPerPixel` is how much ground one output pixel covers, in master pixels. It is the only thing the
 * view tells the paint, and it exists so that a mark stays the size of a mark at every zoom.
 */
export function paintPixel(
  prepared: PreparedPainterly,
  classAt: ClassSampler,
  worldX: number,
  worldY: number,
  masterPerPixel: number,
): Rgb {
  const { boundary, wash, edge, shore, paper } = prepared;

  // Two octaves, so the edge both drifts and frays. One octave at a wavelength longer than a pixel step
  // slides the staircase sideways and leaves it a staircase; the fine octave is what breaks it up.
  const wanderScale = boundary.scale;
  const strayX = fbm(worldX / wanderScale, worldY / wanderScale, 1301, 2) * 2 - 1;
  const strayY = fbm(worldX / wanderScale, worldY / wanderScale, 7919, 2) * 2 - 1;
  const x = worldX + strayX * boundary.wander;
  const y = worldY + strayY * boundary.wander;

  const id = classAt(x, y);
  const here = prepared.classes[id] ?? prepared.classes[0];
  if (here === undefined) {
    throw new Error('the painterly style has no classes prepared');
  }

  const reach = Math.max(REACH_FLOOR, edge.reach * masterPerPixel);
  let differing = 0;
  let acrossShore = 0;
  for (const [dx, dy] of NEIGHBOURS) {
    const other = classAt(x + dx * reach, y + dy * reach);
    if (other !== id) {
      differing += 1;
    }
    if ((prepared.classes[other] ?? here).water !== here.water) {
      acrossShore += 1;
    }
  }
  const boundaryAmount = differing / NEIGHBOURS.length;
  const shoreAmount = acrossShore / NEIGHBOURS.length;

  // Brush space: the world, measured in output pixels, so the medium keeps its scale at every zoom.
  const brushX = worldX / masterPerPixel;
  const brushY = worldY / masterPerPixel;

  // Colour pools and thins across a region rather than filling it. The spread widens what noise gives,
  // which clusters hard around its middle, so a wash reaches its warm or its cool end now and again.
  const spread = 0.5 + (fbm(brushX / wash.mark, brushY / wash.mark, 4241, 2) - 0.5) * 1.8;
  const steps = prepared.posterise;
  const drift = steps > 0 ? Math.round(Math.min(1, Math.max(0, spread)) * steps) / steps : spread;

  const alongX = (brushX * here.cos + brushY * here.sin) / here.mark;
  const alongY = (brushY * here.cos - brushX * here.sin) / here.mark;
  const mark = treatment(here.treatment, alongX, alongY, here.seed) * here.amount;

  const grain = (fbm(brushX / paper.mark, brushY / paper.mark, 5077, 2) - 0.5) * paper.grain;
  const fibre =
    (valueNoise(brushX / (paper.mark * 2.2), brushY / (paper.mark * 1.3), 8663) - 0.5) * paper.fibre;

  const light = 1 + mark + grain + fibre - boundaryAmount * edge.amount;

  // One allocation a pixel rather than three. This runs sixty-five thousand times a map tile while the
  // map is being moved, so the wash, the shading and the ink are carried as numbers, not as colours.
  const between = drift < 0 ? 0 : drift > 1 ? 1 : drift;
  const inked = Math.min(1, Math.max(0, shoreAmount * shore.amount));
  const dark = here.darker;
  const pale = here.lighter;
  const ink = prepared.ink;
  const red = (dark[0] + (pale[0] - dark[0]) * between) * light;
  const green = (dark[1] + (pale[1] - dark[1]) * between) * light;
  const blue = (dark[2] + (pale[2] - dark[2]) * between) * light;

  return [
    clamp255(red + (ink[0] - red) * inked),
    clamp255(green + (ink[1] - green) * inked),
    clamp255(blue + (ink[2] - blue) * inked),
  ];
}

/** Everything wrong with a style, all of it, so one run says all of what to fix. */
export function painterlyProblems(
  style: PainterlyStyle,
  palette: Palette,
  colours: Record<string, string>,
): string[] {
  const problems: string[] = [];
  const groups = new Set(palette.classes.map((terrain) => terrain.group ?? 'none'));
  for (const group of groups) {
    if (style.groups[group] === undefined) {
      problems.push(`no treatment for the ${group} group`);
    }
  }
  for (const group of Object.keys(style.groups)) {
    if (!groups.has(group)) {
      problems.push(`a treatment for ${group}, which no terrain class is in`);
    }
  }
  for (const terrain of palette.classes) {
    if (colours[terrain.name] === undefined) {
      problems.push(`world/render.json has no colour for ${terrain.name}`);
    }
  }
  if (style.paper.mark <= 0) {
    problems.push('the paper mark must be a positive number of pixels');
  }
  if (style.wash.mark <= 0) {
    problems.push('the wash mark must be a positive number of pixels');
  }
  for (const [group, spec] of Object.entries(style.groups)) {
    if (spec.mark <= 0) {
      problems.push(`the ${group} mark must be a positive number of pixels`);
    }
  }
  return problems;
}

/**
 * The style, resolved once against the palette and the render colours: hex parsed, angles turned into
 * the sine and cosine of themselves, and every class given the two ends of its wash. Same reason
 * `preparePalette` exists next door, which is that doing this per pixel costs more than the paint.
 */
export function preparePainterly(
  style: PainterlyStyle,
  palette: Palette,
  colours: Record<string, string>,
): PreparedPainterly {
  const problems = painterlyProblems(style, palette, colours);
  if (problems.length > 0) {
    throw new Error(`the painterly style is unusable: ${problems.join('; ')}`);
  }

  const warm = toRgb(style.warm);
  const cool = toRgb(style.cool);
  const highest = Math.max(...palette.classes.map((terrain) => terrain.id));
  const classes: PreparedClass[] = [];

  for (let id = 0; id <= highest; id += 1) {
    const terrain = palette.classes.find((candidate) => candidate.id === id);
    const group = terrain?.group ?? 'none';
    const treatmentOf = style.groups[group] ?? { treatment: 'none' as const, mark: 3, amount: 0, wash: 1 };
    const base = toRgb(terrain === undefined ? style.cool : colours[terrain.name]!);
    const angle = ((treatmentOf.angle ?? 0) * Math.PI) / 180;
    classes.push({
      lighter: mix(base, warm, style.wash.amount * (treatmentOf.wash ?? 1)),
      darker: mix(base, cool, style.wash.amount * (treatmentOf.wash ?? 1)),
      treatment: treatmentOf.treatment,
      mark: treatmentOf.mark,
      amount: treatmentOf.amount,
      cos: Math.cos(angle),
      sin: Math.sin(angle),
      seed: seedOf(group),
      water: terrain?.water === true,
    });
  }

  return {
    classes,
    ink: toRgb(style.shore.ink),
    wash: style.wash,
    boundary: style.boundary,
    edge: style.edge,
    shore: { amount: style.shore.amount },
    paper: style.paper,
    posterise: style.posterise ?? 0,
  };
}
