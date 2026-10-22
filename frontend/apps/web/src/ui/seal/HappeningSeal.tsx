import './seal.css';

import type { CSSProperties } from 'react';

import { latticeOf } from '../diorama/lattice';
import { Mark } from '../mark/Mark';
import type { AspectShown } from '../slice/Slice';

/**
 * Where a happening's seal is in its life: waiting in the mist, faded, to be next; forming there; coming along its
 * path; arrived; or spent.
 */
export type SealState = 'waiting' | 'forming' | 'coming' | 'arrived' | 'spent';

/** How wide the face is drawn before it is laid on the lattice, in its own pixels. */
const FACE = 100;

/**
 * A happening's seal: a gilt-rimmed diamond tile with its aspect's mark on its face, or both marks for a happening of
 * two, the face its aspect's colour, halved between two - laid in the world as the map's ground is, a square `cells`
 * across turned half a right angle to the lattice, so it is a diamond on the grid too, its corners pointing along the
 * grid's lines, tipped as the ground is, its mark lined up with the grid, and hovering over its shadow. Half in the world: a thing of
 * the venue that is plainly also a sign (decision record 0116). **Waiting** it is faded and still, the next to come;
 * **forming** it brightens, breathing; **coming** it is whole and bobs as it slides; **arrived** its glow pulses and
 * its name stands under it; **spent** it fades where it is. Its foot is the ground under its middle, its box's bottom
 * middle, so a diorama stands it where its path is; its shadow and its name hang below that. `cell` is how many of the
 * units it stands in a world unit is. Drawn rather than painted. See docs/UI-COMPONENTS.md.
 */
export function HappeningSeal({
  aspects,
  state,
  cell = 24,
  cells = 1.5,
  name,
}: {
  /** One aspect, or two for a happening of two. */
  aspects: readonly AspectShown[];
  state: SealState;
  cell?: number;
  /** How many cells of the lattice it is across. */
  cells?: number;
  /** Said under it once it has arrived: `Holy`, `Violence and Industry`. */
  name?: string;
}) {
  const first = aspects[0];
  const second = aspects[1] ?? first;
  if (first === undefined || second === undefined) {
    return null;
  }
  const said = name ?? aspects.map((aspect) => aspect.name).join(' and ');
  const { u, v } = latticeOf({ x: 0, y: 0 }, cell);
  const across = { x: (u.x + v.x) * Math.SQRT1_2, y: (u.y + v.y) * Math.SQRT1_2 };
  const down = { x: (v.x - u.x) * Math.SQRT1_2, y: (v.y - u.y) * Math.SQRT1_2 };
  const scale = cells / FACE;
  const wide = cells * (Math.abs(across.x) + Math.abs(down.x));
  const deep = cells * (Math.abs(across.y) + Math.abs(down.y));
  const lift = 0.7 * cell;
  return (
    <span
      className={`ui-seal ui-seal--${state}`}
      style={
        {
          width: wide,
          height: lift + deep / 2 + 0.15 * cell,
          '--ui-seal-face': `${FACE}px`,
          '--ui-seal-lay': `matrix(${across.x * scale}, ${across.y * scale}, ${down.x * scale}, ${down.y * scale}, 0, 0)`,
          '--ui-seal-lift': `${lift}px`,
          '--ui-seal-edge': `${0.2 * cell}px`,
          '--ui-seal-below': `${deep / 2 + 4}px`,
          '--ui-seal-first': first.colour,
          '--ui-seal-second': second.colour,
        } as CSSProperties
      }
      role="img"
      aria-label={`${said}, ${state}`}
    >
      <span className="ui-seal__shadow" />
      <span className="ui-seal__body">
        <span className="ui-seal__glow" />
        <span className="ui-seal__edge" />
        <span className="ui-seal__face">
          <span className="ui-seal__marks">
            {aspects.map((aspect) => (
              <Mark key={aspect.name} name={aspect.mark} size={aspects.length > 1 ? 34 : 54} />
            ))}
          </span>
        </span>
      </span>
      {state === 'arrived' && <span className="ui-seal__name">{said}</span>}
    </span>
  );
}
