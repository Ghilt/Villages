import type { LngLat } from './sphere.ts';

/**
 * The world as one byte per pixel: which terrain class occupies each cell of an unprojected grid.
 *
 * This is the shape the master image holds and the shape the game asks questions of. Filling it is a
 * scanline polygon fill, written here rather than borrowed so that the build needs no native library and
 * so that the geometry can be tested without an image.
 */

export interface ClassRaster {
  width: number;
  height: number;
  /** One class id per pixel, row by row from the north edge. */
  cells: Uint8Array;
}

/** A grid of numbers on the same unprojected grid: a class a pixel, or anything else wider than a byte. */
export interface IndexRaster {
  width: number;
  height: number;
  cells: Uint8Array | Uint16Array;
}

export function createRaster(width: number, height: number, fill = 0): ClassRaster {
  const cells = new Uint8Array(width * height);
  if (fill !== 0) {
    cells.fill(fill);
  }
  return { width, height, cells };
}

/** Where a place falls on the grid. Fractional, because a polygon edge rarely lands on a pixel. */
export function toPixel(
  { lng, lat }: LngLat,
  raster: { width: number; height: number },
): {
  x: number;
  y: number;
} {
  return {
    x: ((lng + 180) / 360) * raster.width,
    y: ((90 - lat) / 180) * raster.height,
  };
}

/** The place at the middle of a pixel, which is what a lookup means by that pixel. */
export function toLngLat(x: number, y: number, raster: { width: number; height: number }): LngLat {
  return {
    lng: ((x + 0.5) / raster.width) * 360 - 180,
    lat: 90 - ((y + 0.5) / raster.height) * 180,
  };
}

export function classAt(raster: ClassRaster, place: LngLat): number {
  const { x, y } = toPixel(place, raster);
  const column = Math.min(raster.width - 1, Math.max(0, Math.floor(x)));
  const row = Math.min(raster.height - 1, Math.max(0, Math.floor(y)));
  return raster.cells[row * raster.width + column] ?? 0;
}

/** A closed ring of positions, in longitude and latitude, as GeoJSON gives them. */
export type Ring = readonly (readonly [number, number, ...number[]])[];

/**
 * Paints one polygon, holes and all, in a single class, and reports how many pixels it painted.
 *
 * All of a polygon's rings are crossed in the same pass and filled by the even-odd rule, which is what
 * makes a hole a hole: a lake ring inside an island ring leaves the lake unpainted.
 *
 * A scanline fill needs two crossings on a row through a pixel's centre, so a shape smaller than a pixel
 * paints one pixel if it happens to straddle a centre and nothing at all if it does not: the same lake
 * appears or vanishes depending on where it sits. Anything with area therefore gets at least the pixel it
 * sits in. Most of the world's lakes are smaller than a pixel of the master, so this is not an edge case.
 */
export function fillPolygon(raster: IndexRaster, rings: readonly Ring[], value: number): number {
  const edges: { x0: number; y0: number; x1: number; y1: number }[] = [];
  let top = Infinity;
  let bottom = -Infinity;

  for (const ring of rings) {
    for (let index = 0; index < ring.length; index += 1) {
      const from = ring[index]!;
      const to = ring[(index + 1) % ring.length]!;
      const a = toPixel({ lng: from[0], lat: from[1] }, raster);
      const b = toPixel({ lng: to[0], lat: to[1] }, raster);
      if (a.y === b.y) {
        continue; // A horizontal edge crosses no scanline centre.
      }
      edges.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y });
      top = Math.min(top, a.y, b.y);
      bottom = Math.max(bottom, a.y, b.y);
    }
  }

  if (edges.length === 0) {
    return 0;
  }

  let painted = 0;
  const paint = (column: number, row: number): void => {
    if (column < 0 || row < 0 || column >= raster.width || row >= raster.height) {
      return;
    }
    // Pixels covered, not pixels changed: painting over terrain of the same class still covers it, and
    // the count is what decides whether the shape was too small to land anywhere at all.
    raster.cells[row * raster.width + column] = value;
    painted += 1;
  };

  const firstRow = Math.max(0, Math.floor(top));
  const lastRow = Math.min(raster.height - 1, Math.ceil(bottom));
  const crossings: number[] = [];

  for (let row = firstRow; row <= lastRow; row += 1) {
    const scanline = row + 0.5;
    crossings.length = 0;

    for (const edge of edges) {
      const lower = Math.min(edge.y0, edge.y1);
      const upper = Math.max(edge.y0, edge.y1);
      if (scanline < lower || scanline >= upper) {
        continue;
      }
      const t = (scanline - edge.y0) / (edge.y1 - edge.y0);
      crossings.push(edge.x0 + t * (edge.x1 - edge.x0));
    }

    if (crossings.length < 2) {
      continue;
    }
    crossings.sort((a, b) => a - b);

    for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
      const from = Math.max(0, Math.ceil(crossings[pair]! - 0.5));
      const to = Math.min(raster.width - 1, Math.floor(crossings[pair + 1]! - 0.5));
      for (let column = from; column <= to; column += 1) {
        paint(column, row);
      }
    }
  }

  if (painted === 0) {
    // Too small, or too unluckily placed, to cross a pixel centre. It still exists, so it gets a pixel.
    const first = rings[0]?.[0];
    if (first !== undefined) {
      const { x, y } = toPixel({ lng: first[0], lat: first[1] }, raster);
      paint(Math.floor(x), Math.floor(y));
    }
  }

  return painted;
}

/**
 * Paints a line a few pixels wide. Rivers are far thinner than a pixel of the master, so they are drawn
 * rather than filled: without this they would vanish, and a river is the one feature a player follows.
 */
export function strokeLine(raster: ClassRaster, path: Ring, value: number, widthInPixels = 1): void {
  const radius = Math.max(0, (widthInPixels - 1) / 2);

  const paint = (x: number, y: number) => {
    for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy += 1) {
      for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx += 1) {
        if (Math.hypot(dx, dy) > radius + 0.5) {
          continue;
        }
        const column = Math.floor(x) + dx;
        const row = Math.floor(y) + dy;
        if (column < 0 || row < 0 || column >= raster.width || row >= raster.height) {
          continue;
        }
        raster.cells[row * raster.width + column] = value;
      }
    }
  };

  for (let index = 0; index + 1 < path.length; index += 1) {
    const from = toPixel({ lng: path[index]![0], lat: path[index]![1] }, raster);
    const to = toPixel({ lng: path[index + 1]![0], lat: path[index + 1]![1] }, raster);

    // Advance one whole pixel along whichever axis moves further. Sampling by distance instead would
    // step past pixels on a diagonal and leave a river with holes in it.
    const run = to.x - from.x;
    const rise = to.y - from.y;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(run), Math.abs(rise))));

    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      paint(from.x + run * t, from.y + rise * t);
    }
  }
}

/** Counts how many pixels each class holds, which is the quickest way to see that a fill did anything. */
export function classHistogram(raster: ClassRaster): Map<number, number> {
  const counts = new Map<number, number>();
  for (const value of raster.cells) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}
