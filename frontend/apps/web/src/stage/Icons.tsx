/**
 * The marks a pane is known by where there is no room for its name.
 *
 * A tab bar is icons only, so every pane that can share a bay needs one. They are drawn in one place rather
 * than inside the components that use them, because the same mark has to appear on a tab, in the navigation
 * list and wherever a pane is referred to later - and a mark that is redrawn is a mark that drifts.
 *
 * See `LOOK-AND-FEEL.md`.
 */

/** A needle, the one mark that means *there*: what turns a finished conversation back to its quest. */
const NEEDLE = 'M12 3.5 L17 19 L12 15.4 L7 19 Z';

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

/** A lake: a shore all the way round, and one of the river's waves inside it. A placeholder, like the waves. */
const SHORE = {
  rim: 'M12 5.5 C18 5.5 21.5 8.5 21.5 12 C21.5 15.5 18 18.5 12 18.5 C6 18.5 2.5 15.5 2.5 12 C2.5 8.5 6 5.5 12 5.5 Z',
  wave: 'M7 12.5 Q9.5 10 12 12.5 T17 12.5',
} as const;

/** The sea: an anchor, its ring, its stock across and its arms up either side. A placeholder, like the waves. */
const ANCHOR = {
  ring: { cx: 12, cy: 4.75, r: 2 },
  body: 'M12 6.75 V20.5 M8 10 H16 M4.5 14 Q5.5 20.5 12 20.5 Q18.5 20.5 19.5 14',
} as const;

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

/**
 * A structure: a tower with three merlons and a door, the one thing every type has in common at the size of a mark,
 * as a house is a shield whatever its arms. A placeholder, like the bust, until Adam draws it.
 */
const TOWER = {
  walls: 'M7 21 V9 H5.5 V3.5 H8.5 V6 H10.5 V3.5 H13.5 V6 H15.5 V3.5 H18.5 V9 H17 V21 Z',
  door: 'M10.25 21 V17.5 A1.75 1.75 0 0 1 13.75 17.5 V21',
} as const;

/** The quests' tab, as the library draws its `quests` mark. See decision record 0096. */
const QUESTS = {
  seals:
    'M12 3.5 A1.9 1.9 0 1 1 11.99 3.5 M6.5 10.5 A1.9 1.9 0 1 1 6.49 10.5 M17.5 10.5 A1.9 1.9 0 1 1 17.49 10.5 M12 17 A1.9 1.9 0 1 1 11.99 17',
  roads: 'M10.7 6.6 L7.6 10.7 M13.3 6.6 L16.4 10.7 M7.6 14.1 L10.7 17.5 M16.4 14.1 L13.3 17.5',
} as const;

/**
 * Where the player has been: a clock's face with the hands on it, and its rim an arrow turning back,
 * against the clock. The usual sign for a history. A placeholder, like the bust.
 */
const RECENT = {
  rim: 'M5.5 9.3 A8 8 0 1 1 5.5 14.7',
  head: 'M4.3 6 L5.5 9.3 L8.5 7.5',
  hands: 'M13 7.5 V12 L16 14',
} as const;

export type IconName =
  | 'shield'
  | 'recent'
  | 'map'
  | 'window'
  | 'letter'
  | 'close'
  | 'figure'
  | 'nine'
  | 'area'
  | 'speech'
  | 'list'
  | 'river'
  | 'lake'
  | 'sea'
  | 'tower'
  | 'quests';

/** Which way a needle points. The four are one drawing turned, never four drawings. */
export type Point = 'up' | 'down' | 'left' | 'right';

const TURN: Record<Point, number> = { up: 0, down: 180, left: -90, right: 90 };

/**
 * One needle, pointing: *there*. It pointed at a bay from navigation until a phone's top became the map or a
 * window (0109); a finished conversation still turns back to its quest with it (0096).
 */
export function Needle({ point }: { point: Point }) {
  return (
    <svg className="icon icon--needle" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path d={NEEDLE} className="icon__fill" transform={`rotate(${TURN[point]} 12 12)`} />
    </svg>
  );
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
      {name === 'lake' && (
        <>
          <path d={SHORE.rim} className="icon__line" />
          <path d={SHORE.wave} className="icon__line" />
        </>
      )}
      {name === 'sea' && (
        <>
          <circle {...ANCHOR.ring} className="icon__line" />
          <path d={ANCHOR.body} className="icon__line" />
        </>
      )}
      {name === 'speech' && <path d={SPEECH} className="icon__line" />}
      {/* The quests' tab: four seals joined, one road forking and meeting again, the library's `quests` mark. */}
      {name === 'quests' && (
        <>
          <path d={QUESTS.seals} className="icon__line" />
          <path d={QUESTS.roads} className="icon__line" />
        </>
      )}
      {name === 'tower' && (
        <>
          <path d={TOWER.walls} className="icon__line" />
          <path d={TOWER.door} className="icon__line" />
        </>
      )}
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
      {name === 'recent' && (
        <>
          <path d={RECENT.rim} className="icon__line" />
          <path d={RECENT.head} className="icon__line" />
          <path d={RECENT.hands} className="icon__line" />
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
