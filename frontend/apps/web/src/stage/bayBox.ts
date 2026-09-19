/**
 * How the stage divides itself: tiles on a map in the spread, two boxes in the bays.
 *
 * The player's half of the arithmetic that `debug/stageBox.ts` is Adam's half of. That one says how big the
 * stage is, given the window and the debug panel; this one says what happens inside it. Both are pure and
 * both have a test, because a layout that can only be checked by looking at it is a layout nobody can say is
 * right. See decision records 0040 and 0041.
 *
 * Every bay comes out as a **rectangle**, in both forms. That is what makes the one promise this module
 * exists to keep checkable rather than hoped for: **no two tiles overlap, and none leaves the stage.** The
 * floor is the exception and it is exempt by definition - it is the whole stage, under everything, and the
 * tiles lie on it.
 *
 * It stays here rather than moving down to `client-core`. The layer rule is there so that the game's own
 * logic can be tested without a browser; this is presentation arithmetic that would mean nothing to a
 * headless client, and `stageBox.ts` set the precedent by being pure without leaving the app.
 */

/**
 * Below this, on the stage's shorter side, everything no longer fits and the stage folds into two bays.
 *
 * The shorter side because that is the one that runs out. A number somebody picked rather than one derived
 * from anything, and it moves once there is a real layout to judge at the boundary; dragging the side grip
 * across it is how it gets judged.
 */
export const FOLDS_UNDER = 600;

/**
 * And above this it unfolds again, which is not the same number on purpose.
 *
 * A single threshold makes the boundary a cliff: a drag that rests on 600, or a window a pixel from it,
 * flickers between two whole layouts. Sixty pixels of dead band between folding and unfolding means the
 * width that folds it is never the width that unfolds it, so it cannot oscillate however slowly the grip
 * is dragged. Between the two numbers the stage keeps whichever form it already had.
 */
export const UNFOLDS_OVER = 660;

/** The least room a bay is ever given. Below this there is nothing to put in it, not even a strip. */
export const BAY_LEAST = 32;

/** The air between one tile and the next, and between a tile and the stage's edge where it has one. */
export const GUTTER = 16;

/**
 * What is kept clear at the top of the column, for the game's name.
 *
 * The one number in the layout that exists for a decoration, and it is here rather than in the stylesheet
 * so that the tile below it starts where the label stops. The label itself is in no bay: it lies on the
 * floor, which is why it has to be given room rather than taking it.
 */
export const TITLE_ROOM = 56;

/**
 * How wide the column down the side wants to be, and the least it will be squeezed to.
 *
 * The wanted width is the house card's own, which is what it has been drawn at since it was written: the
 * column is that card's width so that the card keeps its proportions and the tiles share one edge. Below
 * the least, the card would have less room than a phone gives it, and a column that narrow is a rail.
 */
export const COLUMN_WANTS = 416;
export const COLUMN_LEAST = 288;

/**
 * How wide the tile along the bottom middle will grow before it stops.
 *
 * Not a layout constraint but a reading one - the same 46rem the parchment has always capped itself at,
 * because three options across a 1600-pixel monitor read as a banner rather than as a choice.
 */
export const MIDDLE_WANTS = 736;

/**
 * What a bay is asking for, in the bays form.
 *
 * Two cases and not three: `big` is "as much as is going", and a number is "this many pixels and no more".
 * **Minimising is not a third case** - a minimised pane asks for a smaller number than a small one does, and
 * the arithmetic never learns the difference. That is what keeps minimise a property of a pane everywhere
 * rather than a mode the layout has to know about.
 */
export type Asking = 'big' | { small: number };

export interface Box {
  w: number;
  h: number;
}

/** Where a bay is, in stage pixels, measured from the stage's top left. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The bays there are, across both forms.
 *
 * `floor` is the whole stage with everything else lying on it, and only the spread has one: it is what
 * makes the map the ground the interface stands on rather than a tile competing with the rest. `left`,
 * `bottomLeft` and `bottomMiddle` are the spread's tiles. `first` and `second` are the bays form's two.
 *
 * They are named for **where they are, not for what goes in them**, which is the rule that keeps the
 * layout from knowing what a map is. Which pane takes which is the pane's own declaration; see `panes.ts`.
 */
export type BayName = 'floor' | 'left' | 'bottomLeft' | 'bottomMiddle' | 'first' | 'second';

/** The tiles, in the order they are cut. The floor is not one of them and is never tested against them. */
export const TILES: readonly BayName[] = ['left', 'bottomLeft', 'bottomMiddle', 'first', 'second'];

export type Form = 'spread' | 'bays';

/**
 * What the spread's tiles are asked for, which comes from the panes that declared they sit in them.
 *
 * A height and not a box: the column's width is the layout's to decide, because two tiles sharing a column
 * have to share an edge and neither of them can know what the other asked for. The height is the pane's,
 * because only it knows how tall the thing it draws is.
 *
 * `null` means **nobody is in that tile**, and an empty tile takes no room at all rather than being
 * reserved against a future: with no choice pending the map runs clean to the bottom edge.
 */
export interface SpreadWants {
  /** Whether anything is in the column above the corner - the inspect rail, today. */
  left: boolean;
  /** How tall the corner tile is, or null when nothing is in it. */
  bottomLeft: number | null;
  /** How tall the tile along the bottom middle is, or null when nothing is in it. */
  bottomMiddle: number | null;
}

export const WANTS_NOTHING: SpreadWants = { left: false, bottomLeft: null, bottomMiddle: null };

export interface BayLayout {
  /** `spread` when everything fits at once, `bays` when it does not. */
  form: Form;
  /** How the bays form cut the stage. `rows` splits top from bottom, `columns` left from right. */
  along: 'rows' | 'columns';
  /** Where each bay is, or null when this form has no such bay or nobody asked for it. */
  bays: Readonly<Record<BayName, Rect | null>>;
}

const NO_BAYS: Readonly<Record<BayName, Rect | null>> = {
  floor: null,
  left: null,
  bottomLeft: null,
  bottomMiddle: null,
  first: null,
  second: null,
};

function clamp(value: number, least: number, most: number): number {
  return Math.max(least, Math.min(most, value));
}

/**
 * Which form the stage is in, given how big it is and which form it was in a moment ago.
 *
 * The dead band is the whole of it: it folds at {@link FOLDS_UNDER} and unfolds at {@link UNFOLDS_OVER},
 * and in between it keeps what it had. Pure, because the form it had is passed in rather than remembered.
 */
export function formFor(stage: Box, was: Form): Form {
  const shorter = Math.min(stage.w, stage.h);
  if (was === 'bays') {
    return shorter >= UNFOLDS_OVER ? 'spread' : 'bays';
  }
  return shorter <= FOLDS_UNDER ? 'bays' : 'spread';
}

/**
 * How the long side is shared out in the bays form, given what each end of it asked for.
 *
 * Three answers, and they are the whole rule:
 *
 * - **One asking small and the other not.** The small one gets what it asked for and the other takes
 *   everything else. The common case, and the one the default opens on: the map wants the room, the house
 *   status wants a sliver.
 * - **Both asking the same**, small or big alike. Half each. The two bays fill the stage between them, so
 *   there is no third place for spare room to go and no reason to leave any - two bays both asking to be
 *   small would otherwise leave a hole where nothing is.
 * - Nobody asks to be more than half, whatever number they named, because a small bay that is most of the
 *   screen is not small and the word would stop meaning anything.
 */
function share(long: number, asking: readonly [Asking, Asking]): [number, number] {
  const half = Math.round(long / 2);
  const [head, tail] = asking;
  const modest = Math.max(BAY_LEAST, Math.min(half, long - BAY_LEAST));

  if (typeof head === 'object' && typeof tail !== 'object') {
    const first = clamp(Math.round(head.small), BAY_LEAST, modest);
    return [first, long - first];
  }
  if (typeof tail === 'object' && typeof head !== 'object') {
    const second = clamp(Math.round(tail.small), BAY_LEAST, modest);
    return [long - second, second];
  }
  return [half, long - half];
}

/**
 * The bays form: two boxes, cut along the stage's longer side.
 *
 * A portrait stage gives a top and a bottom and a landscape one gives a left and a right, which is the same
 * interface turned on its side rather than a second layout. A square stage is cut into rows, arbitrarily but
 * always the same way. The two always add up to the long side exactly: a layout that loses a pixel to
 * rounding grows a seam nobody can find later.
 */
function twoBays(stage: Box, asking: readonly [Asking, Asking]): BayLayout {
  const along = stage.h >= stage.w ? 'rows' : 'columns';
  const long = Math.max(0, along === 'rows' ? stage.h : stage.w);

  // Too small to divide and still have anything on either side of the divide. One box, and whatever is in
  // the first bay has it: better a map with nothing under it than two slivers.
  if (long < BAY_LEAST * 2) {
    const whole = { x: 0, y: 0, w: stage.w, h: stage.h };
    return { form: 'bays', along, bays: { ...NO_BAYS, first: whole } };
  }

  const [first, second] = share(long, asking);
  const bays =
    along === 'rows'
      ? {
          first: { x: 0, y: 0, w: stage.w, h: first },
          second: { x: 0, y: first, w: stage.w, h: second },
        }
      : {
          first: { x: 0, y: 0, w: first, h: stage.h },
          second: { x: first, y: 0, w: second, h: stage.h },
        };

  return { form: 'bays', along, bays: { ...NO_BAYS, ...bays } };
}

/**
 * How wide the column down the side is, given the stage it is on.
 *
 * It wants the house card's width and will be squeezed to a third of the stage before it gives that up,
 * because a column that is half the screen is not a column - it is the screen with a map behind it. The
 * spread only ever happens above 600 pixels on the shorter side, so there is always room for the least.
 */
function columnWidth(stage: Box): number {
  return clamp(Math.round((stage.w - GUTTER * 2) / 3), COLUMN_LEAST, COLUMN_WANTS);
}

/**
 * The spread: a map filling the stage, with tiles lying on it.
 *
 * The column is flush with the stage's left and bottom edges rather than floating a gutter away from them,
 * which is the house card's own argument generalised - furniture set into the edge of the desk reads as
 * part of it, and the same card floating in from the corner reads as a dialogue over the world. The air is
 * therefore on the inside edges: above the column, between its two tiles, and around the bottom middle.
 *
 * **An empty tile takes no room.** No pane in the corner and the column runs to the bottom; no choice
 * pending and the map keeps the whole bottom of the stage.
 */
function tilesOnAMap(stage: Box, wants: SpreadWants): BayLayout {
  const floor = { x: 0, y: 0, w: stage.w, h: stage.h };
  const column = columnWidth(stage);
  const bays: Record<BayName, Rect | null> = { ...NO_BAYS, floor };

  // The corner, first, because what is left of the column is measured from the top of it.
  let columnFloor = stage.h;
  if (wants.bottomLeft !== null) {
    const tall = clamp(Math.round(wants.bottomLeft), BAY_LEAST, stage.h - GUTTER - BAY_LEAST);
    bays.bottomLeft = { x: 0, y: stage.h - tall, w: column, h: tall };
    columnFloor = stage.h - tall - GUTTER;
  }

  if (wants.left) {
    const tall = columnFloor - TITLE_ROOM;
    // Nothing worth drawing is left above the corner. The corner keeps what it has rather than the two of
    // them splitting a sliver each.
    bays.left = tall >= BAY_LEAST ? { x: 0, y: TITLE_ROOM, w: column, h: tall } : null;
  }

  if (wants.bottomMiddle !== null) {
    const clear = bays.left !== null || bays.bottomLeft !== null ? column + GUTTER : GUTTER;
    const room = stage.w - clear - GUTTER;
    const tall = clamp(Math.round(wants.bottomMiddle), BAY_LEAST, stage.h - GUTTER * 2);
    // Centred in what the column left, capped at a width three options still read as sentences across.
    const wide = Math.min(MIDDLE_WANTS, room);
    bays.bottomMiddle =
      wide >= BAY_LEAST
        ? { x: clear + Math.round((room - wide) / 2), y: stage.h - GUTTER - tall, w: wide, h: tall }
        : null;
  }

  return { form: 'spread', along: 'rows', bays };
}

/**
 * Where everything goes, given how big the stage is, what each end of the fold asked for, what the
 * spread's tiles asked for, and which form the stage was in a moment ago.
 *
 * The last of those is what gives the fold its dead band, and it is why this takes an argument that looks
 * like state: the function stays pure and the caller holds the memory.
 */
export function bayLayout(
  stage: Box,
  asking: readonly [Asking, Asking],
  wants: SpreadWants = WANTS_NOTHING,
  was: Form = 'spread',
): BayLayout {
  return formFor(stage, was) === 'bays' ? twoBays(stage, asking) : tilesOnAMap(stage, wants);
}

/** Whether two rectangles share so much as a pixel. Touching along an edge is not overlapping. */
export function overlap(one: Rect, other: Rect): boolean {
  return (
    one.x < other.x + other.w &&
    other.x < one.x + one.w &&
    one.y < other.y + other.h &&
    other.y < one.y + one.h
  );
}

/** Whether a rectangle is wholly on the stage, edges included. */
export function inside(rect: Rect, stage: Box): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= stage.w && rect.y + rect.h <= stage.h;
}
