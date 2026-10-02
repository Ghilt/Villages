import { WORLD_MASTER_WIDTH } from '../geometry/world';
import { groundTilt, pixelsPerWorldUnit, tiltGround, toMercatorExact } from '../geometry/cameraMath';
import type { CameraView } from '../geometry/cameraMath';

import type { FogField } from './fogField';

/**
 * The colour taken out of the map on ground the house has only revealed: step 6 of the fog of war, and
 * decision record 0065.
 *
 * The map is a canvas of its own under the sprites' canvas, so nothing drawn in Pixi can reach its colours.
 * What can is the browser: a canvas between the two, grey where revealed ground is not in vision and clear
 * everywhere else, composited over the map by the **saturation** blend (`.uncolouring` in `sprites/sprites.css`). The
 * saturation of grey is none, so wherever the grey is opaque the map keeps its brightness and loses its
 * colour, and partly where the grey is partly opaque. The sprites under the fog lose theirs inside their own
 * canvas, by the fog layer's filter, from the same field and with the same edge; the signs over the fog, in
 * the same canvas above this one, are left alone.
 *
 * The grey is a picture of the field, worked out once for each change to it, and every frame it is laid on
 * the ground by the camera's own transform - an affine one, because the camera is orthographic - which is one
 * image drawn at a slant, whatever the zoom.
 */

/** How soft the edge is, in world units, as the fog shader draws it close in. */
const SOFT = 1.5;
/** How far the edge's wander can take it, in world units, either way. */
const WANDER = 1.6;

function hash(x: number, y: number): number {
  const u = Math.imul(x, 1597334673) >>> 0;
  const v = Math.imul(y, 3812015801) >>> 0;
  return (Math.imul((u ^ v) >>> 0, 1597334673) >>> 0) / 4294967296;
}

function noise(x: number, y: number): number {
  const wholeX = Math.floor(x);
  const wholeY = Math.floor(y);
  const partX = x - wholeX;
  const partY = y - wholeY;
  const wx = partX * partX * (3 - 2 * partX);
  const wy = partY * partY * (3 - 2 * partY);
  const a = hash(wholeX, wholeY);
  const b = hash(wholeX + 1, wholeY);
  const c = hash(wholeX, wholeY + 1);
  const d = hash(wholeX + 1, wholeY + 1);
  const top = a + (b - a) * wx;
  const bottom = c + (d - c) * wx;
  return top + (bottom - top) * wy;
}

/**
 * How far the edge wanders at a piece of ground, in world units: the fog shader's own wander, as it is close
 * in, by the same hash, so the colour and the haze leave off along the same line.
 */
export function wanderAt(x: number, y: number): number {
  return (noise(x / 9, y / 9) - 0.5) * 2.4 + (noise(x / 3, y / 3) - 0.5) * 0.8;
}

const smoothstep = (from: number, to: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/**
 * The grey to lay over the map, one pixel a texel of the field, four bytes each: middling grey, as opaque as
 * the ground is revealed and not in vision. Rows from the north, as the field's are.
 */
export function maskOf(field: FogField): Uint8ClampedArray<ArrayBuffer> {
  const pixels = new Uint8ClampedArray(field.width * field.height * 4);
  const reach = SOFT + WANDER;
  for (let row = 0; row < field.height; row += 1) {
    const y = field.originY + (row + 0.5) * field.unitsPerTexel;
    for (let column = 0; column < field.width; column += 1) {
      const at = row * field.width + column;
      const revealedBy = field.distances[at * 2]!;
      const visionBy = field.distances[at * 2 + 1]!;
      let opacity: number;
      if (revealedBy >= reach || visionBy <= -reach) {
        // Unknown, or deep in vision: the wander cannot bring either edge this far.
        opacity = 0;
      } else if (revealedBy <= -reach && visionBy >= reach) {
        opacity = 1;
      } else {
        const wander = wanderAt(field.originX + (column + 0.5) * field.unitsPerTexel, y);
        const revealed = 1 - smoothstep(-SOFT, SOFT, revealedBy + wander);
        const vision = 1 - smoothstep(-SOFT, SOFT, visionBy + wander);
        opacity = revealed * (1 - vision);
      }
      pixels[at * 4] = 128;
      pixels[at * 4 + 1] = 128;
      pixels[at * 4 + 2] = 128;
      pixels[at * 4 + 3] = Math.round(opacity * 255);
    }
  }
  return pixels;
}

/**
 * Where the ground lands on the screen, as the six numbers of a canvas transform from world units to pixels:
 * the sprites' own projection, `tiltGround`, scaled and placed about the middle of the view.
 */
export function uncolouringTransform(view: CameraView): [number, number, number, number, number, number] {
  const centre = toMercatorExact(view.center);
  const tilt = groundTilt(view);
  const scale = pixelsPerWorldUnit(view.zoom);
  const east = tiltGround(scale, 0, tilt);
  const south = tiltGround(0, scale, tilt);
  const x = centre.x * WORLD_MASTER_WIDTH;
  const y = centre.y * WORLD_MASTER_WIDTH;
  return [
    east.x,
    east.y,
    south.x,
    south.y,
    view.width / 2 - (east.x * x + south.x * y),
    view.height / 2 - (east.y * x + south.y * y),
  ];
}

export function createUncolouring(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  let field: FogField | null = null;
  let mask: HTMLCanvasElement | null = null;

  return {
    /** What to take the colour out by from now on: a house's field, or null for nothing at all. */
    show(next: FogField | null): void {
      if (next === field) {
        return;
      }
      field = next;
      mask = null;
      if (next === null) {
        return;
      }
      const picture = document.createElement('canvas');
      picture.width = next.width;
      picture.height = next.height;
      picture.getContext('2d')?.putImageData(new ImageData(maskOf(next), next.width, next.height), 0, 0);
      mask = picture;
    },

    /** Lays the grey on its ground for the view the rest of the frame is drawn from. */
    follow(view: CameraView): void {
      if (context === null) {
        return;
      }
      const ratio = window.devicePixelRatio || 1;
      const width = Math.round(view.width * ratio);
      const height = Math.round(view.height * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, width, height);
      if (field === null || mask === null) {
        return;
      }
      const [a, b, c, d, e, f] = uncolouringTransform(view);
      context.setTransform(a * ratio, b * ratio, c * ratio, d * ratio, e * ratio, f * ratio);
      context.imageSmoothingEnabled = true;
      context.drawImage(
        mask,
        field.originX,
        field.originY,
        field.width * field.unitsPerTexel,
        field.height * field.unitsPerTexel,
      );
    },

    destroy(): void {
      field = null;
      mask = null;
      context?.setTransform(1, 0, 0, 1, 0, 0);
      context?.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
