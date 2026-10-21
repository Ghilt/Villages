import './tug.css';

import type { CSSProperties } from 'react';

import { AspectDisc } from '../slice/Slice';
import type { AspectShown } from '../slice/Slice';
import { shareOf } from './tugShare';

/** A side of a challenge as the tug shows it: its name and its colour. */
export interface SideShown {
  readonly name: string;
  readonly colour: string;
}

/**
 * The tug, drawn as a share: a bar in the two sides' colours, the first's from the left as far as its share and the
 * other's the rest, a mark at the middle, and what it says riding the split, sliding along itself so it never leaves
 * the bar - so it moves as the crowd or the ground it stands over does, toward whoever is winning more of it. The
 * sides' names stand at their ends with their pennants. Drawn rather than painted; the split moves in half a second.
 * See docs/UI-COMPONENTS.md and decision record 0116.
 */
export function TugBar({
  first,
  second,
  tug,
  said,
  width,
}: {
  first: SideShown;
  second: SideShown;
  /** From -100, all the second's, to +100, all the first's. */
  tug: number;
  /** What it says over the split: `28.3 toward Varga`. */
  said: string;
  width?: number | string;
}) {
  const share = shareOf(tug);
  return (
    <div
      className="ui-tug ui-on-night"
      style={
        {
          width,
          '--ui-tug-first': first.colour,
          '--ui-tug-second': second.colour,
          '--ui-tug-share': `${share}%`,
          '--ui-tug-frac': share / 100,
        } as CSSProperties
      }
      role="meter"
      aria-valuemin={-100}
      aria-valuemax={100}
      aria-valuenow={Math.round(tug * 10) / 10}
      aria-valuetext={said}
      aria-label="The tug"
    >
      <div className="ui-tug__said-row">
        <span className="ui-tug__said ui-numeral">{said}</span>
      </div>
      <div className="ui-tug__row">
        <span className="ui-tug__side">
          <span className="ui-tug__pennant" style={{ background: first.colour }} aria-hidden="true" />
          {first.name}
        </span>
        <span className="ui-tug__bar" aria-hidden="true">
          <span className="ui-tug__first" />
          <span className="ui-tug__middle" />
        </span>
        <span className="ui-tug__side">
          {second.name}
          <span className="ui-tug__pennant" style={{ background: second.colour }} aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

/**
 * The happening going on: the discs of its aspects, its name, the seconds it runs, and whom it lights - the slices
 * that match it and the ones that answer it. A plate of night over the stage. See docs/UI-COMPONENTS.md.
 */
export function HappeningPlate({
  aspects,
  name,
  when,
  said,
}: {
  aspects: readonly AspectShown[];
  /** `Violence and Industry`. */
  name: string;
  /** `second 15 to 30`. */
  when: string;
  /** Whom it lights: `Varga’s Holy matches, ×1.5 · Brannock’s Reason answers its anti-aspect`. */
  said: string;
}) {
  return (
    <div className="ui-happening ui-on-night" aria-live="polite">
      <span className="ui-happening__discs">
        {aspects.map((aspect) => (
          <AspectDisc key={aspect.name} aspect={aspect} size={32} />
        ))}
      </span>
      <span className="ui-happening__words">
        <span className="ui-happening__name">
          {name} <span className="ui-happening__when">· {when}</span>
        </span>
        <span className="ui-happening__said">{said}</span>
      </span>
    </div>
  );
}
