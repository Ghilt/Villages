/**
 * The marks a pane is known by where there is no room for its name.
 *
 * A tab bar is icons only, so every pane that can share a bay needs one. They are drawn in one place rather
 * than inside the components that use them, because the same mark has to appear on a tab, in the navigation
 * list and wherever a pane is referred to later - and a mark that is redrawn is a mark that drifts.
 *
 * The compass is **the arrows' needle inside a ring**, deliberately: the arrows say which bay a thing opens
 * into and the compass opens the pane that lists them, so they should read as one family. See
 * `LOOK-AND-FEEL.md`.
 */

/** The needle the arrows are drawn from, so the compass and the arrows are the same shape. */
const NEEDLE = 'M12 3.5 L17 19 L12 15.4 L7 19 Z';

/**
 * A compass rose: four cardinal points filled, four between them drawn, inside a ring.
 *
 * The ordinals are outlined rather than filled so the rose reads as eight points and not as a blob at the
 * size a tab draws it. The two stars are one shape, the second turned by an eighth and drawn smaller.
 */
const ROSE = {
  cardinal: 'M12 1.7 L13.5 10.5 L22.3 12 L13.5 13.5 L12 22.3 L10.5 13.5 L1.7 12 L10.5 10.5 Z',
  ordinal: 'M12 5.4 L12.9 11.1 L18.6 12 L12.9 12.9 L12 18.6 L11.1 12.9 L5.4 12 L11.1 11.1 Z',
} as const;

/** The house's own frame, the achievement's contour at the size of a mark. */
const SHIELD = 'M5 4 H19 V13 C19 18 12 21.5 12 21.5 C12 21.5 5 18 5 13 Z';

export type IconName = 'shield' | 'compass' | 'map' | 'window' | 'letter';

/** Which way a needle points. The four are one drawing turned, never four drawings. */
export type Point = 'up' | 'down' | 'left' | 'right';

const TURN: Record<Point, number> = { up: 0, down: 180, left: -90, right: 90 };

/**
 * One needle, pointing at a bay.
 *
 * The same shape the compass has inside its ring, and the same one the **arrows** are a pair of. A player
 * learns it once: this mark means *there*, and the ringed one means *the pane that lists the theres*.
 */
export function Needle({ point }: { point: Point }) {
  return (
    <svg className="icon icon--needle" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path d={NEEDLE} className="icon__fill" transform={`rotate(${TURN[point]} 12 12)`} />
    </svg>
  );
}

/** Which way a needle points at one of the two bays, given how the stage is cut. */
export function pointAt(along: 'rows' | 'columns', which: 0 | 1): Point {
  if (along === 'rows') {
    return which === 0 ? 'up' : 'down';
  }
  return which === 0 ? 'left' : 'right';
}

interface IconProps {
  name: IconName;
  /** What it is, for anyone reading the page rather than looking at it. Omitted when a label is beside it. */
  title?: string;
}

export function Icon({ name, title }: IconProps) {
  return (
    <svg className={`icon icon--${name}`} viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      {title !== undefined && <title>{title}</title>}
      {name === 'shield' && <path d={SHIELD} className="icon__line" />}
      {name === 'compass' && (
        <>
          <circle cx="12" cy="12" r="10.6" className="icon__line" />
          <path d={ROSE.ordinal} className="icon__line" transform="rotate(45 12 12)" />
          <path d={ROSE.cardinal} className="icon__fill" />
        </>
      )}
      {name === 'map' && (
        <>
          <path d="M3 6.5 L9 4 L15 6.5 L21 4 V17.5 L15 20 L9 17.5 L3 20 Z" className="icon__line" />
          <path d="M9 4 V17.5 M15 6.5 V20" className="icon__line" />
        </>
      )}
      {name === 'letter' && (
        <>
          <path d="M3.5 6.5 H20.5 V17.5 H3.5 Z" className="icon__line" />
          <path d="M3.5 6.5 L12 13 L20.5 6.5" className="icon__line" />
        </>
      )}
      {name === 'window' && (
        <>
          <path d="M4 5 H20 V19 H4 Z" className="icon__line" />
          <path d="M4 9 H20" className="icon__line" />
        </>
      )}
    </svg>
  );
}
