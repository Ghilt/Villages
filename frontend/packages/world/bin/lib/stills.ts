import { toRgb } from '../../src/palette.ts';
import type { Palette, Rgb } from '../../src/palette.ts';

/**
 * What the two still painters share beyond the master: `renderPainterly.ts`, which paints the views in every
 * style, and `renderScenery.ts`, which paints the scenery's marks onto them. Their flat views are the same
 * flat, so that a style and the scenery are both compared against one baseline.
 */

export const RADIANS = Math.PI / 180;

/**
 * Web Mercator's vertical coordinate, running to plus or minus pi. World space is a scaling of it.
 *
 * `toWorld` in `src/sphere.ts` works the same sum in another order, which differs from this one in the last
 * bit at some latitudes: making the stills use it moves a pixel here and there in them, and nothing on the map.
 */
export function mercatorY(latitude: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (latitude * RADIANS) / 2));
}

/** The flat look, for the comparison: the colour each class is drawn in, by its id, and nothing else. */
export function flatColoursOf(palette: Palette, colours: Record<string, string>): Rgb[] {
  const flat: Rgb[] = [];
  for (let id = 0; id <= Math.max(...palette.classes.map((terrain) => terrain.id)); id += 1) {
    const terrain = palette.classes.find((candidate) => candidate.id === id);
    flat.push(toRgb(terrain === undefined ? '#000000' : colours[terrain.name]!));
  }
  return flat;
}
