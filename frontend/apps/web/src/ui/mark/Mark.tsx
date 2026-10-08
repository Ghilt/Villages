import './mark.css';

import type { ReactNode } from 'react';

import { pictureIn, sourcesOf, usePictures } from '../art/pictures';

/**
 * A mark: a small sign a thing is known by where there is no room for its name - a close, an eye, a step.
 *
 * **Drawn or painted, one mark at a time.** Every mark has a drawing here, stroked at the weight every mark
 * in the interface is drawn at, and a painted picture in `world/ui/marks/` by the same name is drawn
 * instead of it wherever there is one. So a mark is painted by saving a picture, and drawn again by
 * deleting it. See decision record 0068 and docs/UI-COMPONENTS.md.
 */

/** The eye, open and shut: one almond in both, as the house's own eye has it, so the mark does not change. */
const EYE = {
  almond: 'M2.2 12 C6 6.2 18 6.2 21.8 12 C18 17.8 6 17.8 2.2 12 Z',
  lid: 'M2.8 10.4 C6.5 15.8 17.5 15.8 21.2 10.4',
  lashes: ['M5.2 13.9 L3.5 16.6', 'M9.2 15.6 L8.4 18.6', 'M14.8 15.6 L15.6 18.6', 'M18.8 13.9 L20.5 16.6'],
} as const;

/**
 * A structure, and the Holdings tab that lists a house's: a tower with three merlons and a door, the game's own
 * drawing in `stage/Icons.tsx`, which the library cannot import. See docs/plans/structures.md.
 */
const TOWER = {
  walls: 'M7 21 V9 H5.5 V3.5 H8.5 V6 H10.5 V3.5 H13.5 V6 H15.5 V3.5 H18.5 V9 H17 V21 Z',
  door: 'M10.25 21 V17.5 A1.75 1.75 0 0 1 13.75 17.5 V21',
} as const;

/**
 * The marks a number is known by, the same drawings as the game's own in `marks/Mark.tsx`, which the
 * library cannot import: each a different silhouette before it is a different picture, because five of
 * them have to be told apart at seventeen pixels. See `LOOK-AND-FEEL.md`.
 */
const NUMBERS = {
  /** A coin, with a boss struck in the middle of it. */
  wealth: ['M12 5 A7 7 0 1 1 11.99 5', 'M12 10 A2 2 0 1 1 11.99 10'],
  /** The ridge of land a house holds, and the ground it stands on. */
  domain: ['M3 16 L8 8 L12.5 13.5 L16 9.5 L21 16', 'M3 19.5 H21'],
  /** Two rings that overlap, which is what reach over people amounts to. */
  influence: ['M9.5 7 A5 5 0 1 1 9.49 7', 'M14.5 7 A5 5 0 1 1 14.49 7'],
  /** A pair of dividers over the arc they have scribed, hinged and with no crossbar, so it is not an A. */
  reason: [
    'M12 7 L7 18.5',
    'M12 7 L17 18.5',
    'M6.6 19.6 Q12 22.4 17.4 19.6',
    'M12 4.2 A1.6 1.6 0 1 1 11.99 4.2',
  ],
  /** A cross. */
  piety: ['M12 4 V20', 'M7.5 9.5 H16.5'],
  /** A heart; the game's placeholder too. */
  kindness: [
    'M12 19.4 C7.2 16 4 13 4 9.6 C4 7.2 5.8 5.4 8.1 5.4 C9.8 5.4 11.2 6.4 12 7.8 C12.8 6.4 14.2 5.4 15.9 5.4 C18.2 5.4 20 7.2 20 9.6 C20 13 16.8 16 12 19.4 Z',
  ],
  /** An arm bent at the elbow, the fist up; a placeholder. */
  physical: [
    'M3.5 19 H14.2 C16.9 19 18.6 17.2 18.2 14.6 L17.3 8',
    'M13.3 8.2 L13.8 12.6 C11.8 11.4 8.6 11.5 6.6 13.3 L3.5 13.8',
    'M15.4 3.4 A2.4 2.4 0 1 1 15.39 3.4',
  ],
  /** An hourglass, the sand run mostly through; a placeholder. */
  age: [
    'M6.5 3.5 H17.5',
    'M6.5 20.5 H17.5',
    'M8 3.5 C8 8.4 11.6 10.2 11.6 12 C11.6 13.8 8 15.6 8 20.5',
    'M16 3.5 C16 8.4 12.4 10.2 12.4 12 C12.4 13.8 16 15.6 16 20.5',
    'M9.6 20.2 C10 18.4 11 17.4 12 17.4 C13 17.4 14 18.4 14.4 20.2',
  ],
} as const;

/**
 * The marks a pane is known by, the game's own drawings in `stage/Icons.tsx`, which the library cannot
 * import: what the bottom bar shows, a mark a pane. Named for the pane rather than the picture - `house` is
 * the shield, `figures` the bust, `dialogues` the bubble - and `recent` is the clock turned back that the
 * trail of where the player has been is known by.
 */
const PANES = {
  house: ['M5 4 H19 V13 C19 18 12 21.5 12 21.5 C12 21.5 5 18 5 13 Z'],
  figures: [
    'M12 4.4 A3.7 3.7 0 1 1 11.99 4.4',
    'M4.6 20.4 C5.1 15.9 8.1 13.7 12 13.7 C15.9 13.7 18.9 15.9 19.4 20.4 Z',
  ],
  letter: ['M3.5 6.5 H20.5 V17.5 H3.5 Z', 'M3.5 6.5 L12 13 L20.5 6.5'],
  dialogues: [
    'M5 4.5 H19 A2 2 0 0 1 21 6.5 V14 A2 2 0 0 1 19 16 H10.5 L6 20 V16 H5 A2 2 0 0 1 3 14 V6.5 A2 2 0 0 1 5 4.5 Z',
  ],
  map: ['M3 6.5 L9 4 L15 6.5 L21 4 V17.5 L15 20 L9 17.5 L3 20 Z', 'M9 4 V17.5 M15 6.5 V20'],
  recent: ['M5.5 9.3 A8 8 0 1 1 5.5 14.7', 'M4.3 6 L5.5 9.3 L8.5 7.5', 'M13 7.5 V12 L16 14'],
} as const;

const stroked = (paths: readonly string[]) => (
  <>
    {paths.map((d) => (
      <path key={d} d={d} className="ui-mark__line" />
    ))}
  </>
);

/** Every mark the library draws itself, on a square of 24. */
const DRAWN = {
  wealth: stroked(NUMBERS.wealth),
  domain: stroked(NUMBERS.domain),
  influence: stroked(NUMBERS.influence),
  reason: stroked(NUMBERS.reason),
  piety: stroked(NUMBERS.piety),
  kindness: stroked(NUMBERS.kindness),
  physical: stroked(NUMBERS.physical),
  age: stroked(NUMBERS.age),
  house: stroked(PANES.house),
  figures: stroked(PANES.figures),
  letter: stroked(PANES.letter),
  dialogues: stroked(PANES.dialogues),
  map: stroked(PANES.map),
  recent: stroked(PANES.recent),
  // Two strokes crossed, shorter than the box, because corner to corner reads as a deletion.
  close: <path d="M7 7 L17 17 M17 7 L7 17" className="ui-mark__line" />,
  minimise: <path d="M6 12 H18" className="ui-mark__line" />,
  maximise: <path d="M6.5 6.5 H17.5 V17.5 H6.5 Z" className="ui-mark__line" />,
  // A step back and a step on: what a carousel's arrows do, which is not what the needle means.
  previous: <path d="M14.5 5.5 L8 12 L14.5 18.5" className="ui-mark__line" />,
  next: <path d="M9.5 5.5 L16 12 L9.5 18.5" className="ui-mark__line" />,
  // A section folded shut, pointing at what it holds; turned down when it is open. Solid, and smaller
  // than the steps, so it is not read as one.
  fold: <path d="M8.5 6 L16.5 12 L8.5 18 Z" className="ui-mark__fill" />,
  // One less and one more, a stepper's two; the less is a hair shorter than the window's bar.
  less: <path d="M6.5 12 H17.5" className="ui-mark__line" />,
  more: <path d="M6.5 12 H17.5 M12 6.5 V17.5" className="ui-mark__line" />,
  // The omens of a choice roll, one a kind, which the report card lands them under. Drawn placeholders until
  // a picture is painted for each; see decision record 0083.
  /** The house: a shield. */
  'omen-house': (
    <>
      <path d="M5 4.5 H19 V11 C19 15.6 15.8 18.6 12 20 C8.2 18.6 5 15.6 5 11 Z" className="ui-mark__line" />
    </>
  ),
  /** What changed: an arrow rising. */
  'omen-change': (
    <>
      <path d="M5 17 L11 11 L14 14 L19.5 8.5" className="ui-mark__line" />
      <path d="M15 8.5 H19.5 V13" className="ui-mark__line" />
    </>
  ),
  /** A window open: a lens. */
  'omen-window': (
    <>
      <path d="M10.5 4.5 A6 6 0 1 1 10.49 4.5" className="ui-mark__line" />
      <path d="M15 15 L20 20" className="ui-mark__line" />
    </>
  ),
  /** A dialogue: a speech bubble. */
  'omen-dialogue': (
    <>
      <path d="M4.5 6 H19.5 V15 H11 L7 19 V15 H4.5 Z" className="ui-mark__line" />
    </>
  ),
  /** A key figure: a head and shoulders. */
  'omen-keyFigure': (
    <>
      <path d="M12 4.5 A3.5 3.5 0 1 1 11.99 4.5" className="ui-mark__line" />
      <path d="M5 20 C5.6 15.6 8.4 13.5 12 13.5 C15.6 13.5 18.4 15.6 19 20" className="ui-mark__line" />
    </>
  ),
  /** Where the player is looking: a sheet of map folded in three. */
  'omen-map': (
    <>
      <path d="M3.5 6 L9 4 L15 6 L20.5 4 V18 L15 20 L9 18 L3.5 20 Z" className="ui-mark__line" />
      <path d="M9 4 V18" className="ui-mark__line" />
      <path d="M15 6 V20" className="ui-mark__line" />
    </>
  ),
  /** The time of year: a sun. */
  'omen-season': (
    <>
      <path d="M12 8.5 A3.5 3.5 0 1 1 11.99 8.5" className="ui-mark__line" />
      <path
        d="M12 3 V5.5 M12 18.5 V21 M3 12 H5.5 M18.5 12 H21 M5.6 5.6 L7.4 7.4 M16.6 16.6 L18.4 18.4 M5.6 18.4 L7.4 16.6 M16.6 7.4 L18.4 5.6"
        className="ui-mark__line"
      />
    </>
  ),
  'eye-open': (
    <>
      <path d={EYE.almond} className="ui-mark__line" />
      <circle cx="12" cy="12" r="3.2" className="ui-mark__fill" />
    </>
  ),
  'eye-shut': (
    <>
      <path d={EYE.lid} className="ui-mark__line" />
      {EYE.lashes.map((lash) => (
        <path key={lash} d={lash} className="ui-mark__line" />
      ))}
    </>
  ),
  // Something wrong with what was given, as the moodboard marks its rising tensions: a stroke in a ring.
  warning: (
    <>
      <circle cx="12" cy="12" r="8.6" className="ui-mark__line" />
      <path d="M12 7.4 V13.2" className="ui-mark__line" />
      <circle cx="12" cy="16.5" r="1.15" className="ui-mark__fill" />
    </>
  ),
  tower: (
    <>
      <path d={TOWER.walls} className="ui-mark__line" />
      <path d={TOWER.door} className="ui-mark__line" />
    </>
  ),
  // A quest's marks, drawn placeholders until a picture is painted for each; see decision record 0096. The kinds of
  // node first, then what a node can be to the quest, then the quests' own buttons, every one of them a mark on
  // Adam's word of 2026-10-15.
  /** A dialogue node: a speech bubble with what is said in it. */
  talk: (
    <>
      <path d="M4.5 5.5 H19.5 V15.5 H11.5 L7.5 19.5 V15.5 H4.5 Z" className="ui-mark__line" />
      <path d="M8.5 10.5 H15.5" className="ui-mark__line" />
    </>
  ),
  /** An objective node: a sheet of three rows, each with its box. */
  checklist: (
    <>
      <path d="M5.5 3.5 H18.5 V20.5 H5.5 Z" className="ui-mark__line" />
      <path
        d="M8.5 8 H10 M12.5 8 H16 M8.5 12 H10 M12.5 12 H16 M8.5 16 H10 M12.5 16 H16"
        className="ui-mark__line"
      />
    </>
  ),
  /** A reward node: a chest, shut, its clasp on the front. */
  reward: (
    <>
      <path d="M4 10 H20 V19.5 H4 Z" className="ui-mark__line" />
      <path d="M4 10 C4 6 7 4.5 12 4.5 C17 4.5 20 6 20 10" className="ui-mark__line" />
      <path d="M10.5 10 V13.5 H13.5 V10" className="ui-mark__line" />
    </>
  ),
  /** A node not yet shown: a question mark. */
  unknown: (
    <>
      <path
        d="M8.5 9 C8.5 6.4 10 4.8 12.1 4.8 C14.2 4.8 15.6 6.3 15.6 8.3 C15.6 10.9 12.1 11.4 12.1 14.6"
        className="ui-mark__line"
      />
      <path d="M12.1 18.6 A0.9 0.9 0 1 1 12.09 18.6" className="ui-mark__line" />
    </>
  ),
  /** Done: a tick. */
  done: <path d="M5 12.5 L9.8 17.3 L19 7" className="ui-mark__line" />,
  /** Lost, a road that can no longer be taken: a cross from corner to corner, unlike the close's shorter one. */
  lost: <path d="M5 5 L19 19 M19 5 L5 19" className="ui-mark__line" />,
  /** Deliver: a coin dropped into an open hand. */
  deliver: (
    <>
      <path d="M12 3.5 A2.75 2.75 0 1 1 11.99 3.5" className="ui-mark__line" />
      <path d="M3.5 14 C5.5 17.5 8.5 19.5 12 19.5 C15.5 19.5 18.5 17.5 20.5 14" className="ui-mark__line" />
      <path d="M12 10.5 V15" className="ui-mark__line" />
    </>
  ),
  /** Pledge: a seal pressed into wax, its two ribbons hanging. */
  pledge: (
    <>
      <path d="M12 3.5 A5.5 5.5 0 1 1 11.99 3.5" className="ui-mark__line" />
      <path
        d="M9.5 13.5 L8 20.5 L10.5 19 L12 21 M14.5 13.5 L16 20.5 L13.5 19 L12 21"
        className="ui-mark__line"
      />
    </>
  ),
  /** Collect: a chest thrown open. */
  collect: (
    <>
      <path d="M4 12 H20 V19.5 H4 Z" className="ui-mark__line" />
      <path d="M4 12 L6.5 5.5 H17.5 L20 12" className="ui-mark__line" />
      <path d="M9 9 H15" className="ui-mark__line" />
    </>
  ),
  /** The quests: a little map of four seals joined, one road forking and meeting again. */
  quests: (
    <>
      <path
        d="M12 3.5 A1.9 1.9 0 1 1 11.99 3.5 M6.5 10.5 A1.9 1.9 0 1 1 6.49 10.5 M17.5 10.5 A1.9 1.9 0 1 1 17.49 10.5 M12 17 A1.9 1.9 0 1 1 11.99 17"
        className="ui-mark__line"
      />
      <path
        d="M10.7 6.6 L7.6 10.7 M13.3 6.6 L16.4 10.7 M7.6 14.1 L10.7 17.5 M16.4 14.1 L13.3 17.5"
        className="ui-mark__line"
      />
    </>
  ),
  // A glass and its handle, the moodboard's search: the handle to the bottom right, as it is held.
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="5.25" className="ui-mark__line" />
      <path d="M14.4 14.4 L19 19" className="ui-mark__line" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type MarkName = keyof typeof DRAWN;

export const MARK_NAMES = Object.keys(DRAWN) as MarkName[];

export function Mark({
  name,
  size = 24,
  title,
}: {
  name: MarkName;
  /** How big it is drawn, in pixels, both ways. */
  size?: number;
  /** What it means, for anyone reading the page rather than looking at it; left out when words are beside it. */
  title?: string;
}) {
  const { list } = usePictures();
  const painted = pictureIn(list, 'marks', name);
  if (painted !== undefined) {
    const { src, srcSet } = sourcesOf(painted);
    return (
      <img
        className="ui-mark ui-mark--painted"
        src={src}
        srcSet={srcSet}
        width={size}
        height={size}
        alt={title ?? ''}
        draggable={false}
      />
    );
  }
  return (
    <svg
      className="ui-mark"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      {...(title === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': title })}
    >
      {DRAWN[name]}
    </svg>
  );
}
