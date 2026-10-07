import type { ReactNode } from 'react';

import { Divider } from '../divider/Divider';
import { ReportCard } from './ReportCard';
import type { OmenLine } from './ReportCard';
import type { Play } from './timing';

/**
 * How a rolled hand is laid out:
 *
 * - `full`, opened out on a desktop: the report card on top, a divider, and the options in a row along the bottom.
 * - `stacked`, on a phone: the report card and the options under it one after another, scrolling when they do not
 *   fit. Only here does anything scroll; on a desktop the options are written to fit their room.
 */
export type HandForm = 'full' | 'stacked';

/**
 * **A rolled hand**: the omens a roll read and the options it dealt, played as the roll goes - the omens landing,
 * then the options popping in one after another - and drawn whole once it is settled. The options are whatever the
 * caller draws them as, a card each, in order. See decision record 0083 and `MECHANICS.md`, the choice roll.
 */
export function RolledHand({
  form,
  omens,
  play,
  options,
  onHurry,
}: {
  form: HandForm;
  omens: readonly OmenLine[];
  /** Where the roll stands: how many omens have landed and how many options are in. */
  play: Play;
  options: readonly ReactNode[];
  /** Lands the omens still to come at once. */
  onHurry?: () => void;
}) {
  const playing = play.phase !== 'settled';
  const landed = playing ? play.landed : Infinity;
  const popping = play.phase === 'cards';
  const hand = (
    <ol className="ui-hand__options">
      {options.map((option, at) => (
        <li
          // The options are dealt once and never reordered, so where they stand is who they are.
          key={at}
          className={at >= play.cardsIn ? 'ui-hand__unpopped' : popping ? 'ui-pop' : undefined}
        >
          {option}
        </li>
      ))}
    </ol>
  );

  return (
    <div className={`ui-hand ui-hand--${form}`}>
      <div className="ui-hand__report">
        <ReportCard
          omens={omens}
          landed={landed}
          {...(playing && onHurry !== undefined ? { onHurry } : {})}
        />
      </div>
      <Divider />
      {hand}
    </div>
  );
}
