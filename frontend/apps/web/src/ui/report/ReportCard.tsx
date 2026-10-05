import './report.css';

import type { Rarity } from '../card/Card';
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

const RARITY_WORDS: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary!',
};

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

/** The rarity a roll came up, stamped across the report card in its colour: the moment the roll is for. */
export function RarityStamp({ rarity }: { rarity: Rarity }) {
  return (
    <div className={`ui-stamp ui-stamp--${rarity}`} role="status">
      {RARITY_WORDS[rarity]}
    </div>
  );
}

/**
 * **The report card**: what a roll took into account, filling like the scores at the end of a level - each omen
 * slamming into the list as it lands - and then the rarity stamped across it. `landed` says how many have landed;
 * the newest of them is the one slamming in. A press anywhere on it is `onHurry`, which lands the rest at once; the
 * stamp is the caller's to keep, because it is never skipped. See decision record 0083.
 */
export function ReportCard({
  omens,
  landed,
  stamp = null,
  onHurry,
  title = 'The omens',
}: {
  omens: readonly OmenLine[];
  landed: number;
  stamp?: Rarity | null;
  onHurry?: () => void;
  title?: string;
}) {
  const shown = omens.slice(0, landed);
  return (
    <div className="ui-report" onClick={onHurry} aria-live="polite">
      <h3 className="ui-heading ui-report__title">{title}</h3>
      <ol className="ui-report__rows">
        {shown.map((omen, at) => (
          <OmenRow key={omen.key} omen={omen} landing={stamp === null && at === shown.length - 1} />
        ))}
      </ol>
      {stamp !== null && <RarityStamp rarity={stamp} />}
    </div>
  );
}

/**
 * The report card folded away: a row of the omens' marks, each with its words for a tooltip, so the marks on an
 * option can be matched against what the roll read. `small` is the size an option card carries them at.
 */
export function OmenStrip({ omens, small = false }: { omens: readonly OmenLine[]; small?: boolean }) {
  return (
    <ul className={`ui-omen-strip${small ? ' ui-omen-strip--small' : ''}`} aria-label="omens">
      {omens.map((omen) => (
        <li key={omen.key}>
          <Tooltip text={omen.value === undefined ? omen.words : `${omen.words} ${omen.value}`}>
            <Mark name={`omen-${omen.kind}`} size={small ? 14 : 18} title={omen.words} />
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}
