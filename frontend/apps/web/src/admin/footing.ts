import { GROUND_LATTICE, frameOf, worldXOf, worldYOf } from '@villages/world';

/**
 * How a building stands on its footprint, drawn as the map draws it closest in: the camera looking north and down at
 * 45 degrees, so the ground is squashed to its cosine and a picture is not. In world units, the building's foot at
 * the origin and up the screen negative. Pure, so the structures page and its test agree on every corner.
 */

/** How much the camera squashes the ground at zoom 10, where it tips furthest: the cosine of 45 degrees. */
const SQUASH = Math.SQRT1_2;

const FRAME = frameOf(GROUND_LATTICE);

export interface Point {
  x: number;
  y: number;
}

export interface Footing {
  /** Every diamond of the footprint, its four corners in turn. */
  diamonds: Point[][];
  /** The footprint's outline: its front corner, then round by its left, back and right. */
  outline: Point[];
  /** Where the picture is drawn, its foot on the origin. */
  picture: { x: number; y: number; width: number; height: number };
  /** The box holding all of it. */
  box: { x: number; y: number; width: number; height: number };
}

/** A corner of the ground's lattice, counted in diamonds back from the foot, as the camera draws it. */
function onScreen(u: number, v: number): Point {
  return { x: worldXOf(FRAME, u, v), y: worldYOf(FRAME, u, v) * SQUASH };
}

/**
 * A building [height] world units tall, whose picture is [aspect] times as wide as it is tall and stands at [foot]
 * across it, on a square of [side] diamonds whose front corner is its foot: the square runs back from there, up the
 * screen, as the lattice is turned.
 */
export function footingOf(height: number, aspect: number, foot: number, side: number): Footing {
  const diamonds: Point[][] = [];
  for (let u = -side; u < 0; u += 1) {
    for (let v = -side; v < 0; v += 1) {
      diamonds.push([onScreen(u + 1, v + 1), onScreen(u, v + 1), onScreen(u, v), onScreen(u + 1, v)]);
    }
  }
  const outline = [onScreen(0, 0), onScreen(-side, 0), onScreen(-side, -side), onScreen(0, -side)];
  const width = height * aspect;
  const picture = { x: -foot * width, y: -height, width, height };
  const xs = [...outline.map((p) => p.x), picture.x, picture.x + width];
  const ys = [...outline.map((p) => p.y), picture.y, 0];
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    diamonds,
    outline,
    picture,
    box: { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top },
  };
}
