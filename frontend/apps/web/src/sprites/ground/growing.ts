import { GROUND_LATTICE, alongU, alongV, frameOf } from '@villages/world';

import { revealedAt } from '../../fog/fogField';
import type { FogField } from '../../fog/fogField';
import type { Worked } from './worked';
import { diamondKey } from './workedGround';

const FRAME = frameOf(GROUND_LATTICE);

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
 * sorts every cell in view again when this changes, which is why the worked ground keeps its identity while the
 * buildings hold still (`rememberingWorkedGround`). See docs/plans/worked-ground.md.
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
