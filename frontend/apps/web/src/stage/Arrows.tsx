import { Needle, pointAt } from './Icons';
import type { Which } from './bays';

/**
 * The two arrows: which bay a thing would go into.
 *
 * One control in two places, because they are one gesture. An **inspect window**'s links each carry a pair,
 * and so does anywhere else a player says not only which pane but where. "Open this" and "open this *there*"
 * are not two decisions made one after the other, so they are not two controls. See `LOOK-AND-FEEL.md`.
 *
 * The mark is the shared **needle**, which is also what the compass has inside its ring and what
 * **navigation** puts on every row. One drawing, turned: a player learns it once.
 */

interface ArrowsProps {
  along: 'rows' | 'columns';
  /** Where it already is, so that arrow reads as the one you are standing on rather than a place to go. */
  here?: Which | null;
  /** What it is, for anyone reading the page rather than looking at it. */
  what: string;
  onPick: (which: Which) => void;
}

export function Arrows({ along, here = null, what, onPick }: ArrowsProps) {
  const names = along === 'rows' ? (['top', 'bottom'] as const) : (['left', 'right'] as const);

  return (
    <span className="arrows">
      {([0, 1] as const).map((which) => (
        <button
          key={which}
          type="button"
          className={here === which ? 'arrows__one arrows__one--here' : 'arrows__one'}
          aria-label={here === which ? `${what} is already ${names[which]}` : `put ${what} ${names[which]}`}
          aria-pressed={here === which}
          title={here === which ? `already ${names[which]}` : `put it ${names[which]}`}
          onClick={() => onPick(which)}
        >
          <Needle point={pointAt(along, which)} />
        </button>
      ))}
    </span>
  );
}
