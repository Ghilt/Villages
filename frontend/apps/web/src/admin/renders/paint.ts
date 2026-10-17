import { GROUND_LATTICE, onLattice, paintPixel, preparePainterly } from '@villages/world';

import { pixelsPerWorldUnit } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { paintFile } from '../../geometry/terrainClasses';
import { groundAt } from '../../sprites/land/landMask';

/** The map's own paint, its first renderer's: `DEFAULT_RENDERER` in `map/renderers.ts`. */
const STYLE = 'painted';

/** How many rows are painted before the page is let breathe. */
const ROWS_AT_ONCE = 96;

/**
 * The squares painted as the map paints its ground, by the painterly painter the map's tiles are painted with and on
 * the same lattice, into a canvas the size of the view; nothing between them. Painted once, a few rows at a time so
 * the page stays alive while it is; `stopped` says when the page has moved on, and the painting ends there.
 */
export async function paintSquares(
  view: CameraView,
  classAt: (x: number, y: number) => number,
  inside: (x: number, y: number) => boolean,
  stopped: () => boolean,
): Promise<HTMLCanvasElement | null> {
  const paint = await paintFile();
  const style = paint.styles[STYLE];
  if (style === undefined) return null;
  const prepared = preparePainterly(style, paint.palette, paint.colours);
  const read = onLattice((x, y) => classAt(Math.floor(x), Math.floor(y)), GROUND_LATTICE);
  const perPixel = 1 / pixelsPerWorldUnit(view.zoom);
  const width = Math.max(1, Math.round(view.width));
  const height = Math.max(1, Math.round(view.height));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) return null;
  const image = context.createImageData(width, height);
  const pixels = image.data;
  for (let row = 0; row < height; row += 1) {
    if (row % ROWS_AT_ONCE === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (stopped()) return null;
    }
    for (let column = 0; column < width; column += 1) {
      const world = groundAt(view, column + 0.5, row + 0.5);
      if (!inside(world.x, world.y)) continue;
      const colour = paintPixel(prepared, read, world.x, world.y, perPixel, GROUND_LATTICE);
      const at = (row * width + column) * 4;
      pixels[at] = colour[0];
      pixels[at + 1] = colour[1];
      pixels[at + 2] = colour[2];
      pixels[at + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}
