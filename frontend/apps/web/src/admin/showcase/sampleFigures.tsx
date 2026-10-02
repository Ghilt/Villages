import { portraitUrl } from '../../figures/portraits';
import { Mark } from '../../ui/mark/Mark';
import type { MarkName } from '../../ui/mark/Mark';

/*
 * The key figures the page shows its collections with: nine, each with one of the game's own portraits,
 * and the few things a card or a row says about them.
 */

/** A key figure to show, with one of the game's own portraits: the cut-paper placeholders until painted. */
export interface Figure {
  readonly portrait: string;
  readonly given: string;
  readonly full: string;
  readonly what: string;
  readonly stats: readonly (readonly [MarkName, number])[];
}

export const FIGURES: readonly Figure[] = [
  {
    portrait: 'man-01',
    given: 'Henri',
    full: 'Count Henri de Montreuil',
    what: 'Noble · Rationalist',
    stats: [
      ['influence', 12],
      ['reason', 8],
      ['piety', 4],
    ],
  },
  {
    portrait: 'woman-01',
    given: 'Agathe',
    full: 'Sister Agathe',
    what: 'Cleric · Devout',
    stats: [
      ['influence', 6],
      ['reason', 9],
      ['piety', 14],
    ],
  },
  {
    portrait: 'man-02',
    given: 'Voss',
    full: 'Master Anselm Voss',
    what: 'Engineer · Curious',
    stats: [
      ['influence', 5],
      ['reason', 13],
      ['piety', 3],
    ],
  },
  {
    portrait: 'woman-02',
    given: 'Odile',
    full: 'Odile Marchand',
    what: 'Merchant · Shrewd',
    stats: [
      ['influence', 10],
      ['reason', 7],
      ['piety', 5],
    ],
  },
  {
    portrait: 'man-03',
    given: 'Bastien',
    full: 'Captain Bastien Roux',
    what: 'Soldier · Loyal',
    stats: [
      ['influence', 7],
      ['reason', 4],
      ['piety', 8],
    ],
  },
  {
    portrait: 'woman-03',
    given: 'Margarethe',
    full: 'Margarethe von Hals',
    what: 'Scholar · Sceptic',
    stats: [
      ['influence', 4],
      ['reason', 15],
      ['piety', 2],
    ],
  },
  {
    portrait: 'man-04',
    given: 'Lucien',
    full: 'Lucien Ferrand',
    what: 'Steward · Careful',
    stats: [
      ['influence', 8],
      ['reason', 10],
      ['piety', 7],
    ],
  },
  {
    portrait: 'woman-04',
    given: 'Ysolde',
    full: 'Ysolde de Brévannes',
    what: 'Courtier · Ambitious',
    stats: [
      ['influence', 14],
      ['reason', 6],
      ['piety', 6],
    ],
  },
  {
    portrait: 'woman-05',
    given: 'Clémence',
    full: 'Clémence Aubry',
    what: 'Physician · Kind',
    stats: [
      ['influence', 5],
      ['reason', 11],
      ['piety', 9],
    ],
  },
];

export function Portrait({ figure }: { figure: Figure }) {
  return <img src={portraitUrl(figure.portrait)} alt="" draggable={false} />;
}

export function Stats({ figure }: { figure: Figure }) {
  return (
    <p className="ui-body ui-numeral showcase__figure-stats">
      {figure.stats.map(([mark, value]) => (
        <span key={mark} className="showcase__figure-stat">
          <Mark name={mark} size={15} title={mark} />
          {value}
        </span>
      ))}
    </p>
  );
}
