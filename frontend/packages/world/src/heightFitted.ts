import { ORIGIN_CLONE, ORIGIN_EARTH, ORIGIN_INVENTED } from './originFile.ts';
import type { OriginGrid } from './originFile.ts';

/**
 * The master's own height, for the relief (decision record 0090): real Earth's, read where the origin map says
 * each square of the master was cut from, so that a range Adam moved takes its height with it and the shading
 * lies on the land he painted rather than where the land was on Earth.
 *
 * The sea is nought, as Earth's sea is held at nought. Land the origin map found nowhere on Earth, invented, has
 * no height of its own, so it is given one a square, settled from the squares around it: its coast at nought and
 * its neighbours at what Earth gives them, so where it meets Earth's land there is no cliff, only ground that
 * goes on at about the same height, smoother than Earth's.
 */

/** The master's size in pixels. Equirectangular, as the origin map reads it: a longitude is a column. */
export interface MasterSize {
  readonly width: number;
  readonly height: number;
}

/** Earth's height in metres at a longitude and latitude, the sea below nought. */
export type EarthHeight = (lon: number, lat: number) => number;

const isFromEarth = (status: number | undefined) => status === ORIGIN_EARTH || status === ORIGIN_CLONE;

/** Where the point `mx`, `my` of the master, in square `k`, came from on Earth, as longitude and latitude. */
function earthOf(origin: OriginGrid, size: MasterSize, k: number, mx: number, my: number): [number, number] {
  const { cell, columns } = origin;
  const dx = mx - ((k % columns) * cell + cell / 2);
  const dy = my - (Math.floor(k / columns) * cell + cell / 2);
  const u = origin.x[k]! + origin.a[k]! * dx + origin.b[k]! * dy;
  const v = origin.y[k]! + origin.c[k]! * dx + origin.d[k]! * dy;
  return [(u / size.width) * 360 - 180, 90 - (v / size.height) * 180];
}

/**
 * How many cells of the invented land's fill a square of the origin map has along each side: four, a cell of
 * eight master pixels, so that invented land meets Earth's at the height Earth has just there rather than at a
 * square's mean, which drew a straight cliff along the square's edge wherever it met a hillside.
 */
export const FILL_SPLIT = 4;

/** The invented land's heights, `split` cells a square along each side, and everything else's beside them. */
export interface Fill {
  readonly split: number;
  readonly columns: number;
  readonly rows: number;
  readonly heights: Float32Array;
}

/**
 * The fill: Earth's height at every cell's middle where it came from Earth, nought at sea, and invented land
 * filled from the cells around it inwards and then eased, `rounds` times, to the mean of the four around it.
 * Read between, by `fittedHeight`, for the invented land alone.
 */
export function fillOf(
  origin: OriginGrid,
  size: MasterSize,
  earth: EarthHeight,
  split = FILL_SPLIT,
  rounds = 256,
): Fill {
  const columns = origin.columns * split;
  const rows = origin.rows * split;
  const step = origin.cell / split;
  const heights = new Float32Array(columns * rows);
  const settled = new Uint8Array(columns * rows);
  const invented: number[] = [];
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < columns; i += 1) {
      const k = Math.floor(j / split) * origin.columns + Math.floor(i / split);
      const at = j * columns + i;
      if (origin.status[k] === ORIGIN_INVENTED) {
        invented.push(at);
        continue;
      }
      if (isFromEarth(origin.status[k])) {
        heights[at] = Math.max(0, earth(...earthOf(origin, size, k, (i + 0.5) * step, (j + 0.5) * step)));
      }
      settled[at] = 1;
    }
  }
  // Round the world east and west, held at the poles.
  const around = (at: number) => {
    const column = at % columns;
    const row = Math.floor(at / columns);
    const cell = (c: number, r: number) =>
      Math.min(rows - 1, Math.max(0, r)) * columns + ((c + columns) % columns);
    return [cell(column - 1, row), cell(column + 1, row), cell(column, row - 1), cell(column, row + 1)];
  };
  // Inwards from the edge of each piece of invented land, a ring a pass, each cell the mean of those settled.
  let open = invented;
  while (open.length > 0) {
    const reached: [number, number][] = [];
    for (const at of open) {
      const known = around(at).filter((n) => settled[n] === 1);
      if (known.length > 0) {
        reached.push([at, known.reduce((sum, n) => sum + heights[n]!, 0) / known.length]);
      }
    }
    if (reached.length === 0) {
      break;
    }
    for (const [at, value] of reached) {
      heights[at] = value;
      settled[at] = 1;
    }
    open = open.filter((at) => settled[at] === 0);
  }
  for (let round = 0; round < rounds; round += 1) {
    for (const at of invented) {
      heights[at] = around(at).reduce((sum, n) => sum + heights[n]!, 0) / 4;
    }
  }
  return { split, columns, rows, heights };
}

/**
 * The master's height at a longitude and latitude of the world: Earth's where the origin map says that point
 * came from, carried by its square's turn and stretch; nought at sea; and for invented land, the fill read
 * between its cells' middles.
 */
export function fittedHeight(
  origin: OriginGrid,
  size: MasterSize,
  fill: Fill,
  earth: EarthHeight,
): EarthHeight {
  const { cell, columns, status } = origin;
  const step = cell / fill.split;
  const filled = (column: number, row: number) =>
    fill.heights[
      Math.min(fill.rows - 1, Math.max(0, row)) * fill.columns + ((column + fill.columns) % fill.columns)
    ]!;
  return (lon, lat) => {
    const mx = Math.min(size.width - 1, Math.max(0, ((lon + 180) / 360) * size.width));
    const my = Math.min(size.height - 1, Math.max(0, ((90 - lat) / 180) * size.height));
    const k = Math.floor(my / cell) * columns + Math.floor(mx / cell);
    if (isFromEarth(status[k])) {
      return Math.max(0, earth(...earthOf(origin, size, k, mx, my)));
    }
    if (status[k] !== ORIGIN_INVENTED) {
      return 0;
    }
    const sx = mx / step - 0.5;
    const sy = my / step - 0.5;
    const left = Math.floor(sx);
    const top = Math.floor(sy);
    const wx = sx - left;
    const wy = sy - top;
    const upper = filled(left, top) * (1 - wx) + filled(left + 1, top) * wx;
    const lower = filled(left, top + 1) * (1 - wx) + filled(left + 1, top + 1) * wx;
    return upper * (1 - wy) + lower * wy;
  };
}
