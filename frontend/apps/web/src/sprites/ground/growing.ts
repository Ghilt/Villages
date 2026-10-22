import { CELL, GROUND_LATTICE, alongU, alongV, cellOf, frameOf, worldXOf, worldYOf } from '@villages/world';

import { revealedAt } from '../../fog/fogField';
import type { FogField } from '../../fog/fogField';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import type { Worked } from './worked';
import { diamondKey, diamondOf } from './workedGround';

const FRAME = frameOf(GROUND_LATTICE);
/** How many of the scenery's cells go round the world. */
const CELLS_ROUND = WORLD_MASTER_WIDTH / CELL;

/** One of the scenery's cells, as `SceneryLayer` holds them: its column and row by `cellOf`. */
export function sceneryCellKey(cellX: number, cellY: number): string {
  return `${cellX}/${cellY}`;
}

/**
 * The scenery's cells a change of the worked ground touches: every cell a diamond that became worked or bare
 * overlaps, and the same cell a world away either side, for a view that has panned past the world's edge. Whether a
 * diamond is worked is all `whereSceneryGrows` asks, so one that only changed its kind touches nothing. Every other
 * cell grows as it did, which is what lets the scenery cut again only these (decision record 0118).
 */
export function cellsTouched(
  was: ReadonlyMap<number, Worked>,
  now: ReadonlyMap<number, Worked>,
): Set<string> {
  const touched = new Set<string>();
  const mark = (key: number) => {
    const { u, v } = diamondOf(key);
    const xs = [
      worldXOf(FRAME, u, v),
      worldXOf(FRAME, u + 1, v),
      worldXOf(FRAME, u, v + 1),
      worldXOf(FRAME, u + 1, v + 1),
    ];
    const ys = [
      worldYOf(FRAME, u, v),
      worldYOf(FRAME, u + 1, v),
      worldYOf(FRAME, u, v + 1),
      worldYOf(FRAME, u + 1, v + 1),
    ];
    for (let cellY = cellOf(Math.min(...ys)); cellY <= cellOf(Math.max(...ys)); cellY += 1) {
      for (let cellX = cellOf(Math.min(...xs)); cellX <= cellOf(Math.max(...xs)); cellX += 1) {
        touched.add(sceneryCellKey(cellX, cellY));
        touched.add(sceneryCellKey(cellX - CELLS_ROUND, cellY));
        touched.add(sceneryCellKey(cellX + CELLS_ROUND, cellY));
      }
    }
  };
  for (const key of now.keys()) if (!was.has(key)) mark(key);
  for (const key of was.keys()) if (!now.has(key)) mark(key);
  return touched;
}

/**
 * Whether a point of world space is ground the house has revealed: null, everywhere, with the fog off, which is
 * `undefined`; nowhere for a house that sees nothing, which is `null`; and otherwise what the fog's field says.
 */
export function revealedBy(field: FogField | null | undefined): ((x: number, y: number) => boolean) | null {
  return field === undefined ? null : field === null ? () => false : (x, y) => revealedAt(field, x, y);
}

/**
 * Where the scenery may grow, a point of world space at a time: on ground the house has revealed - everywhere with
 * the fog off, which is `undefined`, and nowhere for a house that sees nothing, which is `null` - and never on a
 * diamond of worked ground, so no tree stands in a building's yard. Null where it may grow everywhere. The scenery
 * cuts again the cells a change of the worked ground touches (`cellsTouched`), and every cell when the fog changes,
 * which is why the worked ground keeps its identity while the buildings hold still (`rememberingWorkedGround`). See
 * docs/plans/worked-ground.md and decision record 0118.
 */
export function whereSceneryGrows(
  field: FogField | null | undefined,
  worked: ReadonlyMap<number, Worked>,
): ((x: number, y: number) => boolean) | null {
  const revealed = revealedBy(field);
  if (worked.size === 0) {
    return revealed;
  }
  const bare = (x: number, y: number) =>
    !worked.has(diamondKey(Math.floor(alongU(FRAME, x, y)), Math.floor(alongV(FRAME, x, y))));
  return revealed === null ? bare : (x, y) => revealed(x, y) && bare(x, y);
}
