import type { Aspect } from '@villages/world';

import { OnFoot } from '../ui/diorama/Diorama';
import type { Placed } from '../ui/diorama/Diorama';
import { Mist } from '../ui/diorama/Mist';
import { useExactSecond } from '../ui/replay/useReplayClock';
import type { ReplayClock } from '../ui/replay/useReplayClock';
import { HappeningSeal } from '../ui/seal/HappeningSeal';
import { sealsAt, spotAlong } from '../ui/seal/sealPath';
import { aspectName, aspectShown } from './said';
import { blockPlaced, FONT, FontBasin } from './venues/blocks';
import type { Arrangement } from './venues/venue';

/** How a happening's seal keeps time in the spectacle: a second and a half in the mist, four seconds coming. */
export const SEAL_TIMING = { form: 1.5, lead: 4 };

/** How high a seal hovers over its foot, in world units: as the library draws it. */
export const SEAL_LIFT = 0.7;

/** What a venue's happenings travel by, standing in it: the mist they wait and form in, and the font they come to. */
export function receptaclePlaced(arrangement: Arrangement): Placed[] {
  const { mist, receptacle, seal, lattice, cell } = arrangement;
  return [
    { id: 'mist', x: mist.x, y: mist.y + 16, depth: mist.y, node: <Mist width={seal * cell * 2.2} /> },
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
}

/**
 * Every seal there is, over the venue, each where its time puts it to the moment - the next waiting faded in the mist,
 * one forming, one sliding along the path, the one arrived and named, the one spent - moving smoothly while the replay
 * plays and standing where the second shown puts it while it does not. Drawn again every frame while it plays, so it
 * is apart from the rest of the venue. Decision record 0116.
 */
export function SealsOver({
  clock,
  arrivals,
  happenings,
  arrangement,
}: {
  clock: ReplayClock;
  arrivals: readonly number[];
  happenings: readonly (readonly Aspect[])[];
  arrangement: Arrangement;
}) {
  const now = useExactSecond(clock);
  return (
    <>
      {sealsAt(now, arrivals, SEAL_TIMING).map((one) => {
        const spot = spotAlong(arrangement.path, one.along);
        const aspects = happenings[one.index] ?? [];
        return (
          <OnFoot key={one.index} x={spot.x} y={spot.y}>
            <HappeningSeal
              aspects={aspects.map(aspectShown)}
              state={one.state}
              cell={arrangement.cell}
              cells={arrangement.seal}
              name={aspects.map(aspectName).join(' and ')}
            />
          </OnFoot>
        );
      })}
    </>
  );
}
