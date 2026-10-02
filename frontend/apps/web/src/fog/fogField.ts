import { reachAcross } from '@villages/protocol';

import { WORLD_MASTER_WIDTH } from '../geometry/world';
import {
  fromMercator,
  groundTilt,
  pixelsPerWorldUnit,
  toMercatorExact,
  untiltGround,
} from '../geometry/cameraMath';
import type { CameraView } from '../geometry/cameraMath';

import type { FogCircle } from './circles';

/**
 * The fog as the shader reads it: how far each piece of ground is from the edge of what the house has
 * revealed, and from the edge of what it has in vision, in world units and negative inside.
 *
 * A distance rather than a yes or no, so that one small texture draws an edge that is soft close in and
 * sharp far out, and can be made to wander, at every zoom: interpolating a distance between two texels is
 * still very nearly the right distance, where interpolating a yes and a no is a smear. It is worked out
 * here, once for every change to the house's vision points, and never while the camera moves.
 *
 * The edges have **surface tension** (0064): each is its circles and every gap or notch between them that a
 * ball as big as the tension cannot get into, which is `coverageOf` in the protocol package, answered here
 * for a whole grid at once. A texel is inside when no texel outside the circles grown by the tension lies
 * within a ball's width of it, which one distance transform over the grid says for every texel together.
 *
 * It covers the circles and a margin around them and nothing else. Everything past its edge is as far
 * outside as a distance is ever said to be, which is what unknown ground is, so a house that has seen a
 * few places costs a texture a few hundred texels across however large the world is.
 */
export interface FogField {
  /** Where the field's first texel starts, in world units. */
  originX: number;
  originY: number;
  /** How many world units one texel covers along each side. */
  unitsPerTexel: number;
  width: number;
  height: number;
  /** Two numbers a texel, rows from the north: the distance to revealed ground, then to vision. */
  distances: Float32Array;
}

/**
 * How far from an edge a distance is worth knowing, in world units. Anything further is said to be this
 * far, which is room for the edge's softness and its wander with a great deal to spare.
 */
export const REACH = 64;

/**
 * The most texels along either side. A house seeing from both ends of the world then costs a coarser
 * texture rather than a bigger one; a few places close together are one texel a world unit.
 */
export const MOST_TEXELS = 1024;

/**
 * Whether a piece of ground, in world units, lies on what the house has revealed: inside the edge the fog's
 * wash is drawn from, surface tension and all. Past the field's edge is unknown ground. What decides where
 * the scenery grows, so that the haze has no wood standing in it; step 5 of the plan.
 */
export function revealedAt(field: FogField, x: number, y: number): boolean {
  const column = Math.floor((x - field.originX) / field.unitsPerTexel);
  const row = Math.floor((y - field.originY) / field.unitsPerTexel);
  if (column < 0 || row < 0 || column >= field.width || row >= field.height) {
    return false;
  }
  return field.distances[(row * field.width + column) * 2]! < 0;
}

/** How many points across the view, and as many down, are asked whether they stand on unknown ground. */
const ASKED = 12;

/**
 * Whether any unknown ground is in this view: whether there is haze on the screen for the haze's slow clock to
 * move (step 7). A dozen points across and a dozen down, carried back onto the ground through the camera the
 * way the fog shader carries every pixel, is enough to find a patch of haze worth moving and costs nothing a
 * frame. Null is a house that sees nothing, where the whole world is haze; ground off the world is none.
 */
export function hazeInView(field: FogField | null, view: CameraView): boolean {
  const tilt = groundTilt(view);
  const scale = pixelsPerWorldUnit(view.zoom);
  const centre = toMercatorExact(view.center);
  for (let across = 0; across < ASKED; across += 1) {
    for (let down = 0; down < ASKED; down += 1) {
      const ground = untiltGround(
        ((across + 0.5) / ASKED - 0.5) * view.width,
        ((down + 0.5) / ASKED - 0.5) * view.height,
        tilt,
      );
      const x = centre.x * WORLD_MASTER_WIDTH + ground.east / scale;
      const y = centre.y * WORLD_MASTER_WIDTH + ground.south / scale;
      if (x < 0 || y < 0 || x > WORLD_MASTER_WIDTH || y > WORLD_MASTER_WIDTH) {
        continue;
      }
      if (field === null || !revealedAt(field, x, y)) {
        return true;
      }
    }
  }
  return false;
}

/** A squared distance too great to be one: "nothing outside anywhere near", to the distance transform. */
const FAR = 1e20;

const held = (distance: number): number => Math.max(-REACH, Math.min(REACH, distance));

/**
 * The field for these circles and this surface tension in kilometres, or null for none, which is a house
 * that sees nothing at all. With no tension the edges are the circles themselves.
 */
export function fieldOf(circles: readonly FogCircle[], tension = 0, most = MOST_TEXELS): FogField | null {
  if (circles.length === 0) {
    return null;
  }
  let west = Number.POSITIVE_INFINITY;
  let north = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let south = Number.NEGATIVE_INFINITY;
  for (const circle of circles) {
    west = Math.min(west, circle.x - circle.grown - REACH);
    north = Math.min(north, circle.y - circle.grown - REACH);
    east = Math.max(east, circle.x + circle.grown + REACH);
    south = Math.max(south, circle.y + circle.grown + REACH);
  }
  const unitsPerTexel = Math.max(1, Math.max(east - west, south - north) / most);
  const width = Math.ceil((east - west) / unitsPerTexel);
  const height = Math.ceil((south - north) / unitsPerTexel);
  const texels = width * height;

  // While every circle still gives vision the two edges are one edge, worked out once; with none, vision is
  // nowhere.
  const allLasting = circles.every((circle) => circle.lasting);
  const revealed = layerOf(texels);
  const vision = allLasting ? revealed : layerOf(texels);

  // Each circle only touches the texels within its grown radius and a reach of that, row by row across the
  // circle rather than its square; everything else already says as far as a distance ever says. A texel
  // already as deep inside as a distance ever says is left alone, which is most of a trail of circles.
  for (const circle of circles) {
    const around = circle.grown + REACH;
    const fromRow = Math.max(0, Math.floor((circle.y - around - north) / unitsPerTexel));
    const toRow = Math.min(height - 1, Math.ceil((circle.y + around - north) / unitsPerTexel));
    for (let row = fromRow; row <= toRow; row += 1) {
      const dy = north + (row + 0.5) * unitsPerTexel - circle.y;
      const span = around * around - dy * dy;
      if (span <= 0) {
        continue;
      }
      const half = Math.sqrt(span);
      const fromColumn = Math.max(0, Math.floor((circle.x - half - west) / unitsPerTexel));
      const toColumn = Math.min(width - 1, Math.ceil((circle.x + half - west) / unitsPerTexel));
      for (let column = fromColumn; column <= toColumn; column += 1) {
        const at = row * width + column;
        const intoVision = circle.lasting && !allLasting;
        if (revealed.plain[at] === -REACH && (!intoVision || vision.plain[at] === -REACH)) {
          continue;
        }
        const dx = west + (column + 0.5) * unitsPerTexel - circle.x;
        const apart = Math.sqrt(dx * dx + dy * dy);
        const beyond = held(apart - circle.grown);
        if (beyond >= REACH) {
          continue;
        }
        const away = held(apart - circle.radius);
        lay(revealed, at, away, beyond);
        if (intoVision) {
          lay(vision, at, away, beyond);
        }
      }
    }
  }

  const grid = { width, height, north, unitsPerTexel };
  const edgeOf = (layer: Layer) =>
    tension > 0 ? closed(layer.plain, layer.grown, grid, tension) : layer.plain;
  const revealedEdge = edgeOf(revealed);
  const visionEdge = vision === revealed ? revealedEdge : edgeOf(vision);
  const distances = new Float32Array(texels * 2);
  for (let at = 0; at < texels; at += 1) {
    distances[at * 2] = revealedEdge[at]!;
    distances[at * 2 + 1] = visionEdge[at]!;
  }

  return { originX: west, originY: north, unitsPerTexel, width, height, distances };
}

/** One of the two edges as it is being worked out: the distance to its circles, and to them grown by the tension. */
interface Layer {
  plain: Float32Array;
  grown: Float32Array;
}

function layerOf(texels: number): Layer {
  return { plain: new Float32Array(texels).fill(REACH), grown: new Float32Array(texels).fill(REACH) };
}

/** Keeps the nearer of what a texel has and what one more circle says. */
function lay(layer: Layer, at: number, away: number, beyond: number): void {
  if (away < layer.plain[at]!) {
    layer.plain[at] = away;
  }
  if (beyond < layer.grown[at]!) {
    layer.grown[at] = beyond;
  }
}

interface Grid {
  width: number;
  height: number;
  north: number;
  unitsPerTexel: number;
}

/**
 * The distance to the edge with its surface tension: inside where no ground outside the grown circles lies
 * within a ball's width, a ball being as big as the tension at the texel's own latitude. Outside the grown
 * circles it is the distance to them and a ball more; the circles themselves are always inside.
 */
function closed(plain: Float32Array, grown: Float32Array, grid: Grid, tension: number): Float32Array {
  const { width, height, north, unitsPerTexel } = grid;

  // The transform need only run over the grown circles and a texel around them, because every texel beyond
  // is outside them; for a house whose vision is one circle that is a small corner of a large field.
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (grown[row * width + column]! <= 0) {
        top = Math.min(top, row);
        bottom = Math.max(bottom, row);
        left = Math.min(left, column);
        right = Math.max(right, column);
      }
    }
  }
  top = Math.max(0, top - 1);
  bottom = Math.min(height - 1, bottom + 1);
  left = Math.max(0, left - 1);
  right = Math.min(width - 1, right + 1);
  const boxWidth = Math.max(0, right - left + 1);
  const boxHeight = Math.max(0, bottom - top + 1);
  const outside = new Float64Array(boxWidth * boxHeight);
  for (let row = top; row <= bottom; row += 1) {
    for (let column = left; column <= right; column += 1) {
      outside[(row - top) * boxWidth + column - left] = grown[row * width + column]! > 0 ? 0 : FAR;
    }
  }
  if (outside.length > 0) {
    squaredDistances(outside, boxWidth, boxHeight);
  }

  const edge = new Float32Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const y = (north + (row + 0.5) * unitsPerTexel) / WORLD_MASTER_WIDTH;
    const ball = reachAcross(fromMercator({ x: 0.5, y }).lat, tension) * WORLD_MASTER_WIDTH;
    for (let column = 0; column < width; column += 1) {
      const at = row * width + column;
      // A texel's distance to the nearest one outside is from middle to middle, half a texel further than
      // the edge between them, which lies on average halfway.
      const tense =
        grown[at]! > 0
          ? ball + grown[at]!
          : ball - (Math.sqrt(outside[(row - top) * boxWidth + column - left]!) - 0.5) * unitsPerTexel;
      edge[at] = held(Math.min(tense, plain[at]!));
    }
  }
  return edge;
}

/**
 * Every texel's squared distance, in texels, to the nearest texel whose value is nought, in place: the exact
 * Euclidean distance transform of Felzenszwalb and Huttenlocher, down every column and then along every row.
 */
export function squaredDistances(values: Float64Array, width: number, height: number): void {
  const longest = Math.max(width, height);
  const line = new Float64Array(longest);
  const done = new Float64Array(longest);
  const parabolas = new Int32Array(longest);
  const bounds = new Float64Array(longest + 1);
  for (let column = 0; column < width; column += 1) {
    for (let row = 0; row < height; row += 1) {
      line[row] = values[row * width + column]!;
    }
    lowerEnvelope(line, height, done, parabolas, bounds);
    for (let row = 0; row < height; row += 1) {
      values[row * width + column] = done[row]!;
    }
  }
  for (let row = 0; row < height; row += 1) {
    const start = row * width;
    for (let column = 0; column < width; column += 1) {
      line[column] = values[start + column]!;
    }
    lowerEnvelope(line, width, done, parabolas, bounds);
    for (let column = 0; column < width; column += 1) {
      values[start + column] = done[column]!;
    }
  }
}

/** One line of the transform: the lower envelope of a parabola rooted at every texel, read off at each texel. */
function lowerEnvelope(
  line: Float64Array,
  length: number,
  done: Float64Array,
  parabolas: Int32Array,
  bounds: Float64Array,
): void {
  let k = 0;
  parabolas[0] = 0;
  bounds[0] = Number.NEGATIVE_INFINITY;
  bounds[1] = Number.POSITIVE_INFINITY;
  for (let q = 1; q < length; q += 1) {
    const lifted = line[q]! + q * q;
    let root = parabolas[k]!;
    let s = (lifted - (line[root]! + root * root)) / (2 * (q - root));
    while (s <= bounds[k]!) {
      k -= 1;
      root = parabolas[k]!;
      s = (lifted - (line[root]! + root * root)) / (2 * (q - root));
    }
    k += 1;
    parabolas[k] = q;
    bounds[k] = s;
    bounds[k + 1] = Number.POSITIVE_INFINITY;
  }
  k = 0;
  for (let q = 0; q < length; q += 1) {
    while (bounds[k + 1]! < q) {
      k += 1;
    }
    const root = parabolas[k]!;
    done[q] = (q - root) * (q - root) + line[root]!;
  }
}
