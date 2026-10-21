import './fieldFigure.css';

import type { CSSProperties } from 'react';

import { AspectDisc, Pips } from '../slice/Slice';
import type { AspectShown } from '../slice/Slice';
import type { Borne } from '../slice/sliceWords';
import { pullSaid } from './figureWords';
import type { Facing, FigureKind } from './figureWords';

/** A pull to show rising over a figure: how much, and a key that changes each time it pulls again. */
export interface Pulled {
  readonly amount: number;
  readonly key: string | number;
}

const TOWNSFOLK = 'var(--ui-cream-soft)';

/**
 * A figure on a challenge's field: a head over a cloak that widens to the hem, as the map draws a person, in the colour
 * of the side it stands for, or in no colour for one of the townsfolk. It is turned east or west and no other way, its
 * hair at the back of its head and its eye on its face saying which; turned west it is the same drawing mirrored
 * (decision record 0116). A summon carries a staff and the disc of its aspect over its head, a key figure a gilt
 * circlet. Lit from under its feet while its aspect matches and it is Empowered, with the pips of what it bears; what it
 * pulled rises over it and fades; fallen, it lies grey and fades. Its box's foot is its bottom middle, where a diorama
 * stands it. Drawn rather than painted, until a summon has a picture. See docs/UI-COMPONENTS.md.
 */
export function FieldFigure({
  kind,
  facing,
  colour,
  height = 64,
  name,
  aspect,
  lit = false,
  borne = [],
  pulled,
  fallen = false,
}: {
  kind: FigureKind;
  facing: Facing;
  /** The side's colour; a townsperson's is the library's own. */
  colour?: string;
  /** How tall it stands, in pixels. */
  height?: number;
  /** Said under its feet, and to a screen reader. */
  name?: string;
  /** A summon's aspect, its disc over its head. */
  aspect?: AspectShown;
  lit?: boolean;
  borne?: readonly Borne[];
  pulled?: Pulled;
  fallen?: boolean;
}) {
  const cloak = fallen ? 'var(--ui-cream-soft)' : kind === 'townsperson' ? TOWNSFOLK : (colour ?? TOWNSFOLK);
  const classes = ['ui-field-figure', `ui-field-figure--${kind}`, fallen ? 'ui-field-figure--fallen' : '']
    .filter((one) => one !== '')
    .join(' ');
  return (
    <span
      className={classes}
      style={{ width: Math.round(height * 0.69), height, '--ui-field-figure-cloak': cloak } as CSSProperties}
      role={name === undefined ? undefined : 'img'}
      aria-label={name}
    >
      <span className={`ui-field-figure__ground${lit && !fallen ? ' ui-field-figure__ground--lit' : ''}`} />
      <svg className="ui-field-figure__body" viewBox="0 0 44 64" aria-hidden="true">
        <g transform={facing === 'west' ? 'translate(44 0) scale(-1 1)' : undefined}>
          <path d="M14 27 Q22 22 30 27 L37 61 Q22 64 7 61 Z" className="ui-field-figure__cloak" />
          <circle
            cx="22"
            cy="17"
            r="8.5"
            className={
              kind === 'keyFigure'
                ? 'ui-field-figure__head ui-field-figure__head--circlet'
                : 'ui-field-figure__head'
            }
          />
          <path
            d="M14.5 13 Q16 7.5 22 8.3 Q17.5 12 18 20 Q15 19 14.5 13 Z"
            className="ui-field-figure__hair"
          />
          <circle cx="26.5" cy="16" r="1.2" className="ui-field-figure__eye" />
          {kind === 'summon' && <path d="M35 8 L33 60" className="ui-field-figure__staff" />}
        </g>
      </svg>
      {!fallen && (aspect !== undefined || borne.length > 0) && (
        <span className="ui-field-figure__over">
          {aspect !== undefined && (
            <AspectDisc aspect={aspect} size={Math.max(16, Math.round(height * 0.34))} />
          )}
          <Pips borne={borne} />
        </span>
      )}
      {pulled !== undefined && pulled.amount !== 0 && !fallen && (
        <span key={pulled.key} className="ui-field-figure__pulled ui-numeral">
          {pullSaid(pulled.amount)}
        </span>
      )}
      {name !== undefined && (
        <span className="ui-field-figure__name" aria-hidden="true">
          {name}
        </span>
      )}
    </span>
  );
}
