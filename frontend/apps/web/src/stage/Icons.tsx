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

/**
 * A head and shoulders, for the key figures: a bust, as a portrait is framed, rather than a whole figure,
 * because what the pane holds is portraits. Adam's placeholder, to be drawn properly when the rest are.
 */
const BUST = {
  head: 'M12 4.4 A3.7 3.7 0 1 1 11.99 4.4',
  shoulders: 'M4.6 20.4 C5.1 15.9 8.1 13.7 12 13.7 C15.9 13.7 18.9 15.9 19.4 20.4 Z',
} as const;

/**
 * Nine small squares, three by three: the way back from one key figure to all of them, drawn as the grid
 * it goes back to. Filled rather than outlined, because nine outlines at the size of a mark are a blur.
 */
const NINE = [4.5, 10.25, 16].flatMap((y) => [4.5, 10.25, 16].map((x) => ({ x, y })));

/**
 * An area: a fence that steps along square corners, because an area is fenced between the painted pixels
 * of the master rather than drawn freehand. See decision record 0032.
 */
const FENCE = 'M4 8 H9 V4 H20 V14 H16 V20 H4 Z';

/**
 * A river: two waves, one over the other, the way water is drawn at the size of a mark. A placeholder, like the
 * bust, until Adam draws it.
 */
const WAVES = 'M2.5 9.5 Q6 6 9.5 9.5 T16.5 9.5 T21.5 9.5 M2.5 15.5 Q6 12 9.5 15.5 T16.5 15.5 T21.5 15.5';

/**
 * Character dialogue: a speech bubble, its tail down to the left where somebody is speaking from. One
 * bubble and not two, because two at the size of a mark are one blot. A placeholder, like the bust.
 */
const SPEECH =
  'M5 4.5 H19 A2 2 0 0 1 21 6.5 V14 A2 2 0 0 1 19 16 H10.5 L6 20 V16 H5 A2 2 0 0 1 3 14 V6.5 A2 2 0 0 1 5 4.5 Z';

/**
 * The way back from a conversation to all of them, drawn as the list it goes back to - three rows, each with
 * its point - as the way back from one key figure is drawn as the grid it goes back to. Adam's call: a mark.
 */
const LIST = { rows: 'M9.5 7 H19.5 M9.5 12 H19.5 M9.5 17 H19.5', points: [7, 12, 17] } as const;

export type IconName =
  | 'shield'
  | 'compass'
  | 'map'
  | 'window'
  | 'letter'
  | 'close'
  | 'figure'
  | 'nine'
  | 'area'
  | 'speech'
  | 'list'
  | 'river';

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
      {name === 'area' && <path d={FENCE} className="icon__line" />}
      {name === 'river' && <path d={WAVES} className="icon__line" />}
      {name === 'speech' && <path d={SPEECH} className="icon__line" />}
      {name === 'list' && (
        <>
          <path d={LIST.rows} className="icon__line" />
          {LIST.points.map((y) => (
            <circle key={y} cx="5.5" cy={y} r="1.4" className="icon__fill" />
          ))}
        </>
      )}
      {name === 'nine' &&
        NINE.map(({ x, y }) => (
          <rect key={`${x},${y}`} x={x} y={y} width="3.5" height="3.5" rx="0.5" className="icon__fill" />
        ))}
      {name === 'figure' && (
        <>
          <path d={BUST.head} className="icon__line" />
          <path d={BUST.shoulders} className="icon__line" />
        </>
      )}
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
      {/* Two strokes crossed, at the weight every other mark is drawn at. Shorter than the box it is
          in, because a cross that runs corner to corner reads as a deletion rather than as a shut. */}
      {name === 'close' && <path d="M7 7 L17 17 M17 7 L7 17" className="icon__line" />}
      {name === 'window' && (
        <>
          <path d="M4 5 H20 V19 H4 Z" className="icon__line" />
          <path d="M4 9 H20" className="icon__line" />
        </>
      )}
    </svg>
  );
}
