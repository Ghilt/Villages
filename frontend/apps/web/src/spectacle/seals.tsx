import type { Aspect } from '@villages/world';

import type { Placed } from '../ui/diorama/Diorama';
import { Mist } from '../ui/diorama/Mist';
import { HappeningSeal } from '../ui/seal/HappeningSeal';
import { sealsAt, spotAlong } from '../ui/seal/sealPath';
import { aspectName, aspectShown } from './said';
import { blockPlaced, FONT, FontBasin } from './venues/blocks';
import type { Arrangement } from './venues/venue';

/** How a happening's seal keeps time in the spectacle: a second and a half in the mist, four seconds coming. */
export const SEAL_TIMING = { form: 1.5, lead: 4 };

/**
 * What a venue's happenings travel by at a second: the mist they form in, the font they come to, and every seal there
 * is - forming, coming along the path, arrived and named, or spent - each where its time puts it. Pure in the second,
 * so a second scrubbed back to shows each where it was. Decision record 0116.
 */
export function sealsPlaced(
  second: number,
  arrivals: readonly number[],
  happenings: readonly (readonly Aspect[])[],
  arrangement: Arrangement,
): Placed[] {
  const { mist, receptacle, path, seal, lattice, cell } = arrangement;
  const placed: Placed[] = [
    { id: 'mist', x: mist.x, y: mist.y + 16, depth: mist.y, node: <Mist width={seal * 2.3} /> },
    blockPlaced(
      'font',
      lattice,
      receptacle,
      FONT.cells,
      FONT.lift * cell,
      FONT.faces,
      <FontBasin cell={cell} />,
    ),
  ];
  for (const one of sealsAt(second, arrivals, SEAL_TIMING)) {
    const spot = spotAlong(path, one.along);
    const aspects = happenings[one.index] ?? [];
    placed.push({
      id: `seal-${one.index}`,
      x: spot.x,
      y: spot.y,
      depth: 5000 + one.index,
      walk: 0.6,
      node: (
        <HappeningSeal
          aspects={aspects.map(aspectShown)}
          state={one.state}
          size={seal}
          name={aspects.map(aspectName).join(' and ')}
        />
      ),
    });
  }
  return placed;
}
