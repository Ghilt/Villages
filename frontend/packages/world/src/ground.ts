import type { ClassRaster } from './raster.ts';

/**
 * The ground map: what a master's ground is, coarsely, for the game server to read where a player is looking
 * without taking a page's word for it. A grid on the master's own latitude and longitude, a cell every
 * `GROUND_CELL` master pixels each way; each cell is two bytes, the commonest terrain class in it other than a
 * river, and the marks below. See decision record 0084.
 */

/** Master pixels a cell is across and down: 2048 by 1024 cells for a 32768 by 16384 master. */
export const GROUND_CELL = 16;

/** A river runs through the cell. */
export const RIVER = 1;
/** The cell holds sea and land both. */
export const COAST = 2;
/** A lake is in the cell. */
export const LAKE = 4;
/** Sea is in the cell, the ocean or a shallow sea. */
export const SEA = 8;

export interface GroundMap {
  readonly width: number;
  readonly height: number;
  /** Two bytes a cell, row by row from the north edge: the class, then the marks. */
  readonly cells: Uint8Array;
}

export interface WaterClasses {
  readonly sea: ReadonlySet<number>;
  readonly lake: ReadonlySet<number>;
  readonly river: ReadonlySet<number>;
}

/** Cuts a master into its ground map. */
export function groundOf(world: ClassRaster, water: WaterClasses, cell = GROUND_CELL): GroundMap {
  const width = Math.ceil(world.width / cell);
  const height = Math.ceil(world.height / cell);
  const cells = new Uint8Array(width * height * 2);
  const counts = new Uint32Array(256);
  for (let gy = 0; gy < height; gy += 1) {
    for (let gx = 0; gx < width; gx += 1) {
      counts.fill(0);
      let marks = 0;
      let land = false;
      for (let y = gy * cell; y < Math.min(world.height, (gy + 1) * cell); y += 1) {
        for (let x = gx * cell; x < Math.min(world.width, (gx + 1) * cell); x += 1) {
          const id = world.cells[y * world.width + x]!;
          counts[id]! += 1;
          if (water.river.has(id)) marks |= RIVER;
          else if (water.lake.has(id)) marks |= LAKE;
          else if (water.sea.has(id)) marks |= SEA;
          else land = true;
        }
      }
      if ((marks & SEA) !== 0 && land) marks |= COAST;
      let commonest = 0;
      let most = -1;
      for (let id = 0; id < counts.length; id += 1) {
        if (!water.river.has(id) && counts[id]! > most) {
          most = counts[id]!;
          commonest = id;
        }
      }
      // A cell that is all river is a river.
      if (most === 0) commonest = [...water.river][0] ?? commonest;
      const at = (gy * width + gx) * 2;
      cells[at] = commonest;
      cells[at + 1] = marks;
    }
  }
  return { width, height, cells };
}
