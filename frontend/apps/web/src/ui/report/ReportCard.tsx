import './report.css';

import { Mark } from '../mark/Mark';
import { Tooltip } from '../tooltip/Tooltip';

/** Where an omen came from: the house, a change in it, a window, a dialogue, a key figure, the map, the season. */
export type OmenKindName = 'house' | 'change' | 'window' | 'dialogue' | 'keyFigure' | 'map' | 'season';

/** One omen as the report card shows it: the words, sometimes a value, and the kind its mark is drawn from. */
export interface OmenLine {
  readonly key: string;
  readonly kind: OmenKindName;
  readonly words: string;
  readonly value?: number;
}

/** One omen in the list: its kind's mark, its words, and its value at the far end. Slams in when it is `landing`. */
export function OmenRow({ omen, landing = false }: { omen: OmenLine; landing?: boolean }) {
  return (
    <li className={`ui-report__row${landing ? ' ui-report__row--landing' : ''}`}>
      <Mark name={`omen-${omen.kind}`} size={18} />
      <span className="ui-report__words">{omen.words}</span>
      {omen.value !== undefined && <span className="ui-report__value">{omen.value}</span>}
    </li>
  );
}

/**
 * **The report card**: what a roll took into account, filling like the scores at the end of a level - each omen
 * slamming into the list as it lands. `landed` says how many have landed, and while some are still to come the
 * newest is the one slamming in. A press anywhere on it is `onHurry`, which lands the rest at once. The rarity is
 * not said here: the options say it, by their tag and their glow. See decision record 0083.
 */
export function ReportCard({
  omens,
  landed = Infinity,
  onHurry,
  title = 'The omens',
}: {
  omens: readonly OmenLine[];
  landed?: number;
  onHurry?: () => void;
  title?: string;
}) {
  const shown = omens.slice(0, landed);
  return (
    <div className="ui-report" onClick={onHurry} aria-live="polite">
      <h3 className="ui-heading ui-report__title">{title}</h3>
      <ol className="ui-report__rows">
        {shown.map((omen, at) => (
          <OmenRow key={omen.key} omen={omen} landing={Number.isFinite(landed) && at === shown.length - 1} />
        ))}
      </ol>
    </div>
  );
}

/**
 * The report card folded away: a row of the omens' marks, each with its words for a tooltip, so the marks on an
 * option can be matched against what the roll read. `landed` lands them one at a time, as the list's rows land.
 * Given `onOpen`, the whole row is one button that opens the list out - the medium pane's way back to it. `small`
 * is the size an option card carries them at.
 */
export function OmenStrip({
  omens,
  landed = Infinity,
  small = false,
  onOpen,
}: {
  omens: readonly OmenLine[];
  landed?: number;
  small?: boolean;
  onOpen?: () => void;
}) {
  const shown = omens.slice(0, landed);
  const marks = (
    <ul className={`ui-omen-strip${small ? ' ui-omen-strip--small' : ''}`} aria-label="omens">
      {shown.map((omen, at) => (
        <li
          key={omen.key}
          className={
            Number.isFinite(landed) && at === shown.length - 1 ? 'ui-omen-strip__landing' : undefined
          }
        >
          <Tooltip text={omen.value === undefined ? omen.words : `${omen.words} ${omen.value}`}>
            <Mark name={`omen-${omen.kind}`} size={small ? 14 : 18} title={omen.words} />
          </Tooltip>
        </li>
      ))}
    </ul>
  );
  if (onOpen === undefined) {
    return marks;
  }
  return (
    <button type="button" className="ui-omen-strip__open" onClick={onOpen} aria-label="show the omens">
      {marks}
    </button>
  );
}
