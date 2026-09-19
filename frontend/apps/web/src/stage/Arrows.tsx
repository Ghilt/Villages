import type { Which } from './panes';

/**
 * The two arrows: which pane a thing would go into.
 *
 * One control in two places, because they are one gesture. The kebab lists the views and each carries a
 * pair; an inspect window's links each carry a pair. "Open this" and "open this *there*" are not two
 * decisions the player makes one after the other, so they are not two controls. See `LOOK-AND-FEEL.md`.
 *
 * Drawn as a compass needle rather than a chevron, so that the pair reads as two ends of one thing pointing
 * apart rather than as two buttons that happen to be next to each other. They turn with the stage: up and
 * down when it is cut into rows, left and right when it is cut into columns.
 */

/** A needle pointing up, which the other three are this one turned. */
const NEEDLE = 'M12 3.5 L17 19 L12 15.4 L7 19 Z';

const TURN: Record<'rows' | 'columns', [number, number]> = {
  rows: [0, 180],
  columns: [-90, 90],
};

interface ArrowsProps {
  along: 'rows' | 'columns';
  /** Where it already is, so that arrow reads as the one you are standing on rather than a place to go. */
  here?: Which | null;
  /** What it is, for anyone reading the page rather than looking at it. */
  what: string;
  onPick: (which: Which) => void;
}

export function Arrows({ along, here = null, what, onPick }: ArrowsProps) {
  const turns = TURN[along];
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
          <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
            <path d={NEEDLE} transform={`rotate(${turns[which]} 12 12)`} />
          </svg>
        </button>
      ))}
    </span>
  );
}
