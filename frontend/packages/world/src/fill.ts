import type { ClassRaster } from './raster.ts';

/**
 * Resolving the pixels nobody assigned.
 *
 * Two datasets never agree exactly about where a coast is, so painting land from one and biomes from
 * another leaves a thin fringe along every shoreline that has land but no terrain. Left alone that fringe
 * becomes tens of thousands of slivers when the world is traced.
 *
 * Rather than guess at a single fallback terrain, each unassigned pixel takes the terrain most of its
 * neighbours have, repeatedly, so a fringe is filled inwards from the land behind it.
 */

export interface FillOptions {
  /** The value that means "land, terrain unknown". It never appears in a finished world. */
  sentinel: number;
  /** Values that may not be spread, such as the sea: a coastal fringe is land, not water. */
  blocked: ReadonlySet<number>;
  /** What to use for anything still unresolved when the passes run out. */
  fallback: number;
  maxPasses?: number;
}

export interface FillReport {
  /** How many pixels were unassigned to begin with. */
  unassigned: number;
  /** How many took a terrain from their neighbours. */
  filled: number;
  /** How many had to fall back, because nothing around them could be spread. */
  fellBack: number;
  passes: number;
}

/** Fills every sentinel pixel from its neighbours, and reports what it had to do. */
export function fillUnassigned(raster: ClassRaster, options: FillOptions): FillReport {
  const { width, height, cells } = raster;
  const { sentinel, blocked, fallback } = options;
  const maxPasses = options.maxPasses ?? 12;

  let pending: number[] = [];
  for (let index = 0; index < cells.length; index += 1) {
    if (cells[index] === sentinel) {
      pending.push(index);
    }
  }

  const report: FillReport = { unassigned: pending.length, filled: 0, fellBack: 0, passes: 0 };
  const tally = new Map<number, number>();

  for (let pass = 0; pass < maxPasses && pending.length > 0; pass += 1) {
    report.passes = pass + 1;
    // Decided together and applied together, so that a fringe does not fill faster in one direction.
    const decided: { index: number; value: number }[] = [];
    const stillPending: number[] = [];

    for (const index of pending) {
      const x = index % width;
      const y = (index - x) / width;
      tally.clear();

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) {
            continue;
          }
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }
          const neighbour = cells[ny * width + nx]!;
          if (neighbour === sentinel || blocked.has(neighbour)) {
            continue;
          }
          tally.set(neighbour, (tally.get(neighbour) ?? 0) + 1);
        }
      }

      let best = -1;
      let bestCount = 0;
      for (const [value, count] of tally) {
        // Ties go to the lower value, so the same world comes out of the same input every time.
        if (count > bestCount || (count === bestCount && value < best)) {
          best = value;
          bestCount = count;
        }
      }

      if (best >= 0) {
        decided.push({ index, value: best });
      } else {
        stillPending.push(index);
      }
    }

    for (const { index, value } of decided) {
      cells[index] = value;
      report.filled += 1;
    }
    pending = stillPending;
  }

  for (const index of pending) {
    cells[index] = fallback;
    report.fellBack += 1;
  }

  return report;
}
