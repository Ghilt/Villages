import { readFileSync } from 'node:fs';

import { PNG } from 'pngjs';

import type { ClassSampler } from '../../src/painterly.ts';
import { preparePalette, snapPrepared } from '../../src/palette.ts';
import type { Palette } from '../../src/palette.ts';
import { createRaster } from '../../src/raster.ts';
import type { ClassRaster } from '../../src/raster.ts';
import { masterRowsAt } from '../../src/tiles.ts';

/**
 * A master as the tools read it: one terrain class a pixel, every colour snapped to the nearest class in the
 * palette. One reader for every tool that reads a master, so that a colour means the same class to the tiles,
 * the sprite map and the stills.
 *
 * Every distinct colour is answered once: a world has a handful of colours and half a billion pixels. It is
 * read inside a function so that the two gigabytes of RGBA pngjs hands back can be collected as soon as it
 * returns, before anything else starts. `importMaster.ts` reads its own, because it also measures how far
 * each colour was from its class.
 */
export function readMaster(path: string, palette: Palette): ClassRaster {
  const prepared = preparePalette(palette);
  const decoded = PNG.sync.read(readFileSync(path));
  const world = createRaster(decoded.width, decoded.height);
  const remembered = new Int16Array(1 << 24).fill(-1);
  for (let index = 0; index < world.cells.length; index += 1) {
    const at = index * 4;
    const red = decoded.data[at]!;
    const green = decoded.data[at + 1]!;
    const blue = decoded.data[at + 2]!;
    const colour = (red << 16) | (green << 8) | blue;
    let id = remembered[colour]!;
    if (id < 0) {
      id = snapPrepared([red, green, blue], prepared).id;
      remembered[colour] = id;
    }
    world.cells[index] = id;
  }
  return world;
}

/**
 * The class at a point of world space, read off a master.
 *
 * Nearest, always: the average of two terrains is a third terrain. Longitude wraps, because the world does;
 * latitude clamps, because it does not. World space is Mercator and the master is not, so every row of it is
 * projected once, here, up front. See decision record 0030.
 */
export function classSamplerOf(world: ClassRaster): ClassSampler {
  const masterRowOf = masterRowsAt(world.width, world.height);
  return (x, y) => {
    const column = ((Math.floor(x) % world.width) + world.width) % world.width;
    const down = Math.min(world.width - 1, Math.max(0, Math.floor(y)));
    return world.cells[masterRowOf[down]! * world.width + column]!;
  };
}
