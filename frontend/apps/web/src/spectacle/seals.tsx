import type { Aspect } from '@villages/world';

import type { Placed } from '../ui/diorama/Diorama';
import { Mist } from '../ui/diorama/Mist';
import { HappeningSeal } from '../ui/seal/HappeningSeal';
import { sealsAt, spotAlong } from '../ui/seal/sealPath';
import { aspectName, aspectShown } from './said';
import type { Arrangement } from './venues/venue';

/** How a happening's seal keeps time in the spectacle: a second and a half in the mist, four seconds coming. */
export const SEAL_TIMING = { form: 1.5, lead: 4 };

/** A stand-in font for the square's receptacle, its basin of water under the seal, until it is painted. */
function Font() {
  return (
    <svg width="110" height="68" viewBox="0 0 110 68" aria-hidden="true" style={{ display: 'block' }}>
      <ellipse cx="55" cy="56" rx="48" ry="11" fill="#8f8574" stroke="#2b1d10" strokeWidth="1.5" />
      <path d="M10 36 L10 56 Q55 72 100 56 L100 36 Z" fill="#a39885" stroke="#2b1d10" strokeWidth="1.5" />
      <ellipse cx="55" cy="36" rx="45" ry="12" fill="#c4b9a3" stroke="#2b1d10" strokeWidth="1.5" />
      <ellipse cx="55" cy="36" rx="33" ry="7.5" fill="#6f7f86" stroke="#2b1d10" strokeWidth="1" />
    </svg>
  );
}

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
  const { mist, receptacle, path, seal } = arrangement;
  const placed: Placed[] = [
    { id: 'mist', x: mist.x, y: mist.y + 16, depth: mist.y, node: <Mist width={seal * 2.3} /> },
    { id: 'font', x: receptacle.x, y: receptacle.y + 22, depth: receptacle.y - 1, node: <Font /> },
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
