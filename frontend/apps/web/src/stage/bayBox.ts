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

/**
 * How thick a pane put away is: in either form, and whichever way the stage is cut.
 *
 * **The same for every pane.** A strip is the pane's name and the way back and nothing else, so there is
 * nothing one pane could need more of than another - and four declarations each carrying their own 44 were
 * four chances to disagree about a number none of them had a reason to change. Cut into columns it is a
 * width rather than a height, and it is still this.
 *
 * Here rather than in the stylesheet for the reason {@link TAB_BAR} is: it is room. A bay is this many
 * pixels across, and what is drawn inside it fills what it was given.
 */
export const STRIP = 44;

/** The least room a bay is ever given. Below this there is nothing to put in it, not even a strip. */
export const BAY_LEAST = 32;

/** The air between one tile and the next, and between a tile and the stage's edge where it has one. */
export const GUTTER = 16;

/**
 * How much of a tile the strip of tabs takes, when more than one pane is sharing it.
 *
 * Here rather than in the stylesheet because it is room: a tile with two panes in it is that much taller
 * than the pane inside it, and the tile below has to start below all of it.
 */
export const TAB_BAR = 30;

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
 * How wide the letter is put away, and the least the bottom row always leaves it. Put away it is a **chip**:
 * Take action and what it costs, or the hand that is waiting, in the middle of what the corner and the right
 * column leave. The least caps how far they reach, so what they leave is never less than Take action can be
 * pressed in. See decision record 0085.
 */
export const CHIP_WANTS = 280;
export const CHIP_LEAST = 136;

/**
 * How wide the column down the right edge wants to be, and the least it will be squeezed to.
 *
 * Wider than the column on the left, because what stands in it is a conversation with a picture of where
 * it is happening at its top. Squeezed to a third of a narrow stage as the left one is, and never below the
 * left one's least, so that the two columns never close over the map between them. See decision record
 * 0069.
 */
export const RIGHT_WANTS = 480;
export const RIGHT_LEAST = COLUMN_LEAST;

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
 * `bottomLeft`, `bottomMiddle` and `right` are the spread's tiles. `first` and `second` are the bays form's
 * two.
 *
 * They are named for **where they are, not for what goes in them**, which is the rule that keeps the
 * layout from knowing what a map is. Which pane takes which is the pane's own declaration; see `panes.ts`.
 */
export type BayName = 'floor' | 'left' | 'bottomLeft' | 'bottomMiddle' | 'right' | 'first' | 'second';

/** The tiles, in the order they are cut. The floor is not one of them and is never tested against them. */
export const TILES: readonly BayName[] = ['left', 'bottomLeft', 'bottomMiddle', 'right', 'first', 'second'];

/**
 * The bays whose panes **stack** rather than take turns.
 *
 * The rail is the one: up to three inspect windows, one under another, all drawn. They are about different
 * things and comparing two of them should not mean remembering one, which is the whole argument for a rail
 * and is why `MOST_OPEN` is three. Everywhere else, panes sharing a bay are alternatives and take turns
 * behind a **tab bar**.
 */
const STACKS: ReadonlySet<BayName> = new Set<BayName>(['left']);

/**
 * How the panes sharing a bay divide it.
 *
 * A property of the **bay** and not of the panes in it: two panes in one bay either take turns or they are
 * both drawn, and it cannot differ between them. Reading it off the count alone was the bug - three windows
 * in the rail are not three tabs, and the rail grew a strip of tabs over the top of its first window.
 */
export function sharedBy(where: BayName): 'tabs' | 'stack' {
  return STACKS.has(where) ? 'stack' : 'tabs';
}

/** Whether this bay is showing a tab bar: more than one pane in it, and they take turns. */
export function isTabbed(where: BayName | null, sharing: number): boolean {
  return where !== null && sharing > 1 && sharedBy(where) === 'tabs';
}

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
  /**
   * How wide the corner wants to be, when it is opened out and reaches along the bottom; absent or null,
   * and it is the column's width. The corner's width and not a tab's, so it is the same whichever of its
   * panes is up. See decision records 0056 and 0057.
   */
  bottomLeftWide?: number | null;
  /**
   * How tall the letter along the bottom middle is opened out, `strip` when it is put away to its chip, or
   * null when nothing is in it. Two sizes and not three: in the spread it is one or the other. See 0085.
   */
  bottomMiddle: number | 'strip' | null;
  /**
   * How the column down the right edge is asked to be, or absent or null when nothing is in it. Which of
   * three, and not a number, because its widths are the layout's as the left column's is: a pane cannot
   * know half of a stage it has never been told the size of. See {@link RightWants}.
   */
  right?: RightWants | null;
}

/**
 * The three ways the column down the right edge can be: its own width top to bottom, opened out to half
 * the stage, or put away to a strip across its top. See decision record 0069.
 */
export type RightWants = 'normal' | 'half' | 'strip';

export const WANTS_NOTHING: SpreadWants = { left: false, bottomLeft: null, bottomMiddle: null };

export interface BayLayout {
  /** `spread` when everything fits at once, `bays` when it does not. */
  form: Form;
  /** How the bays form cut the stage. `rows` splits top from bottom, `columns` left from right. */
  along: 'rows' | 'columns';
  /** Where each bay is, or null when this form has no such bay or nobody asked for it. */
  bays: Readonly<Record<BayName, Rect | null>>;
  /** The tile lying over all the others with a **veil** between, the letter opened out; exempt from no-overlap. */
  over: BayName | null;
}

const NO_BAYS: Readonly<Record<BayName, Rect | null>> = {
  floor: null,
  left: null,
  bottomLeft: null,
  bottomMiddle: null,
  right: null,
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
    return { form: 'bays', along, bays: { ...NO_BAYS, first: whole }, over: null };
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

  return { form: 'bays', along, bays: { ...NO_BAYS, ...bays }, over: null };
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

/** How wide the column down the right edge is at its normal size, before anything on the left is asked. */
function rightNormal(stage: Box): number {
  return clamp(Math.round((stage.w - GUTTER * 2) / 3), RIGHT_LEAST, RIGHT_WANTS);
}

/**
 * How wide the column down the right edge is, given the stage, how it was asked to be, and how far what is
 * on the left reaches. Opened out it is half the stage and never less than its normal size; put away, a strip
 * at the normal width. Never within a gutter of what stands on the left, the rail, the corner reaching along
 * the bottom or the letter's chip: it is cut last, from what they leave, so its coming and going resizes
 * none of them. See decision record 0069.
 */
function rightWidth(stage: Box, asked: RightWants, beside: number): number {
  const wanted =
    asked === 'half' ? Math.max(rightNormal(stage), Math.round(stage.w / 2)) : rightNormal(stage);
  return Math.min(wanted, stage.w - (beside > 0 ? beside + GUTTER : GUTTER));
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
 *
 * **The corner can reach along the bottom**, opened out, while the rail above keeps the column's width; see
 * 0056 and 0057. **A second column stands down the right edge**, set into the right, top and bottom edges as
 * the first is into the left, and cut last, from what the others leave; see 0069. **The letter moves
 * nothing**: put away it is a chip in what the bottom row leaves, opened out it lies over it all; see 0085.
 */
function tilesOnAMap(stage: Box, wants: SpreadWants): BayLayout {
  const floor = { x: 0, y: 0, w: stage.w, h: stage.h };
  const column = columnWidth(stage);
  const bays: Record<BayName, Rect | null> = { ...NO_BAYS, floor };

  // The corner, first, because what is left of the column is measured from the top of it.
  let columnFloor = stage.h;
  if (wants.bottomLeft !== null) {
    const tall = clamp(Math.round(wants.bottomLeft), BAY_LEAST, stage.h - GUTTER - BAY_LEAST);
    // Opened out on a pane that asks for it, the corner reaches along the bottom: never narrower than the
    // column, and never so far that the letter's chip and a right column at its normal width no longer fit
    // beside it. Capped whether or not either is there, so neither arriving resizes the corner. See 0056.
    const most = Math.max(column, stage.w - rightNormal(stage) - CHIP_LEAST - GUTTER * 2);
    const wide = clamp(Math.round(wants.bottomLeftWide ?? column), column, most);
    bays.bottomLeft = { x: 0, y: stage.h - tall, w: wide, h: tall };
    columnFloor = stage.h - tall - GUTTER;
  }

  if (wants.left) {
    const tall = columnFloor - TITLE_ROOM;
    // Nothing worth drawing is left above the corner. The corner keeps what it has rather than the two of
    // them splitting a sliver each.
    bays.left = tall >= BAY_LEAST ? { x: 0, y: TITLE_ROOM, w: column, h: tall } : null;
  }

  // What stands at the left of the stage, which the right column and the letter both keep clear of: the
  // column, or the corner reaching past it.
  const beside = Math.max(bays.left?.w ?? 0, bays.bottomLeft?.w ?? 0);
  const clear = beside > 0 ? beside + GUTTER : GUTTER;
  const letter = wants.bottomMiddle;

  // The column down the right edge, top to bottom, or a strip across its bottom put away. It leaves the
  // letter's chip its least whatever size the letter is, so that opening the letter resizes nothing under it.
  if (wants.right != null) {
    const wide = rightWidth(stage, wants.right, letter === null ? beside : clear + CHIP_LEAST);
    const tall = wants.right === 'strip' ? STRIP : stage.h;
    bays.right = wide >= BAY_LEAST ? { x: stage.w - wide, y: stage.h - tall, w: wide, h: tall } : null;
  }

  let over: BayName | null = null;
  if (letter === 'strip') {
    // Put away: a chip in the middle of what the two ends of the bottom row leave, a gutter off the bottom.
    const room = (bays.right?.x ?? stage.w) - GUTTER - clear;
    const wide = Math.min(CHIP_WANTS, room);
    const x = clear + Math.round((room - wide) / 2);
    bays.bottomMiddle = { x, y: stage.h - GUTTER - STRIP, w: wide, h: STRIP };
  } else if (letter !== null) {
    // Opened out: over everything, centred on the stage and standing where the chip stands, capped at a width
    // three options still read as sentences across.
    const wide = Math.min(MIDDLE_WANTS, stage.w - GUTTER * 2);
    const tall = clamp(Math.round(letter), BAY_LEAST, stage.h - GUTTER * 2);
    bays.bottomMiddle = { x: Math.round((stage.w - wide) / 2), y: stage.h - GUTTER - tall, w: wide, h: tall };
    over = 'bottomMiddle';
  }

  return { form: 'spread', along: 'rows', bays, over };
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
