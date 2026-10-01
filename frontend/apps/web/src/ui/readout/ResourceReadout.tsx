import './readout.css';

import { Mark } from '../mark/Mark';
import type { MarkName } from '../mark/Mark';
import { Tooltip } from '../tooltip/Tooltip';
import { amountSaid, trendOf, useNow } from './readout';

/**
 * A resource as the player reads it: its mark, what it stands at, and - when there is room - how fast it
 * moves. The amount is asked for again four times a second while it is moving, so it counts up between
 * the events that set it rather than standing still until the next one.
 *
 * The word is the mark's tooltip, and is beside it when `showWord` asks, because a mark is learnt: until
 * it is, the word is one pointer away. A screen reader always hears it. See docs/UI-COMPONENTS.md.
 */
export function ResourceReadout({
  mark,
  word,
  amountAt,
  ratePerSecond,
  rate,
  showWord = false,
  size = 17,
}: {
  mark: MarkName;
  /** The resource's name, as the player knows it: `Wealth`. */
  word: string;
  /** What it stands at, at a moment, as a number or already in words: `830/1,240` for a pledge. */
  amountAt: (now: number) => number | string;
  /** How fast it moves, which says whether it has to be asked again and which way it is going. */
  ratePerSecond?: number;
  /** How fast it moves, in words the game has chosen: `+48 a day`. Left out, none is shown. */
  rate?: string;
  showWord?: boolean;
  /** How big its mark is drawn. Seventeen, where five of them have to be told apart in a row. */
  size?: number;
}) {
  const trend = trendOf(ratePerSecond);
  const now = useNow(trend !== 'still');
  const amount = amountSaid(amountAt(now));
  return (
    <Tooltip text={rate === undefined ? word : `${word}, ${rate}`} describes={false}>
      <span className="ui-readout" data-trend={trend}>
        <span className="ui-readout__mark">
          <Mark name={mark} size={size} />
        </span>
        <span className={showWord ? 'ui-readout__word' : 'ui-readout__unseen'}>{word}</span>
        <span className="ui-readout__amount ui-numeral">{amount}</span>
        {rate !== undefined && <span className="ui-readout__rate ui-numeral">{rate}</span>}
      </span>
    </Tooltip>
  );
}
