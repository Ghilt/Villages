import './seal.css';

import type { CSSProperties } from 'react';

import { Mark } from '../mark/Mark';
import type { AspectShown } from '../slice/Slice';

/** Where a happening's seal is in its life: forming in the mist, coming along its path, arrived, or spent. */
export type SealState = 'forming' | 'coming' | 'arrived' | 'spent';

/**
 * A happening's seal: a glowing medallion with its aspect's mark large on its face, or both marks for a happening of
 * two, the face its aspect's colour, halved between two. Half in the world: a thing of the venue that is plainly also a
 * sign (decision record 0116). **Forming**, it is dim and soft in the mist; **coming**, it is whole and bobs as it
 * drifts; **arrived**, it swells and its glow pulses, its name under it; **spent**, it fades where it stands. Its box's
 * bottom middle is its foot, as a figure's is, so a diorama stands it where its path is. Drawn rather than painted.
 * See docs/UI-COMPONENTS.md.
 */
export function HappeningSeal({
  aspects,
  state,
  size = 64,
  name,
}: {
  /** One aspect, or two for a happening of two. */
  aspects: readonly AspectShown[];
  state: SealState;
  /** How wide it is across, in pixels or whatever units it stands in. */
  size?: number;
  /** Said under it once it has arrived: `Holy`, `Violence and Industry`. */
  name?: string;
}) {
  const first = aspects[0];
  const second = aspects[1] ?? first;
  if (first === undefined || second === undefined) {
    return null;
  }
  const said = name ?? aspects.map((aspect) => aspect.name).join(' and ');
  return (
    <span
      className={`ui-seal ui-seal--${state}`}
      style={
        {
          width: size,
          height: size * 1.35,
          '--ui-seal-size': `${size}px`,
          '--ui-seal-first': first.colour,
          '--ui-seal-second': second.colour,
        } as CSSProperties
      }
      role="img"
      aria-label={`${said}, ${state}`}
    >
      <span className="ui-seal__body">
        <span className="ui-seal__halo" />
        <span className="ui-seal__face">
          {aspects.map((aspect) => (
            <Mark
              key={aspect.name}
              name={aspect.mark}
              size={Math.round(size * (aspects.length > 1 ? 0.36 : 0.52))}
            />
          ))}
        </span>
      </span>
      {state === 'arrived' && <span className="ui-seal__name">{said}</span>}
    </span>
  );
}
