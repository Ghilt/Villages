/**
 * How the stage divides itself: one box when there is room for everything, two when there is not.
 *
 * The player's half of the arithmetic that `debug/stageBox.ts` is Adam's half of. That one says how big the
 * stage is, given the window and the debug panel; this one says what happens inside it. Both are pure and
 * both have a test, because a layout that can only be checked by looking at it is a layout nobody can say is
 * right. See decision record 0040.
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

/** The least room a bay is ever given. Below this there is nothing to put in it, not even a strip. */
export const BAY_LEAST = 32;

/**
 * What a bay is asking for.
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

/** Which way the stage was cut, and how much each side of the cut got. */
export interface BayLayout {
  /** `spread` when everything fits at once, `bays` when it does not. */
  form: 'spread' | 'bays';
  /** `rows` splits top from bottom, `columns` splits left from right. The stage's longer side is cut. */
  along: 'rows' | 'columns';
  /** The top or left bay. In the spread this is the whole stage. */
  first: number;
  /** The bottom or right bay. Zero in the spread, because there is only one box. */
  second: number;
}

function clamp(value: number, least: number, most: number): number {
  return Math.max(least, Math.min(most, value));
}

/**
 * How the long side is shared out, given what each end of it asked for.
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
 * Where the stage's contents go, given how big it is and what each bay is asking for.
 *
 * The longer side is the one that is cut, so a portrait stage gives a top and a bottom and a landscape one
 * gives a left and a right - which is the same interface turned on its side rather than a second layout. A
 * square stage is cut into rows, arbitrarily but always the same way.
 *
 * `first` and `second` always add up to the long side exactly. That is the invariant worth holding: a layout
 * that loses a pixel to rounding grows a seam that nobody can find later.
 */
export function bayLayout(stage: Box, asking: readonly [Asking, Asking]): BayLayout {
  const along = stage.h >= stage.w ? 'rows' : 'columns';
  const long = Math.max(0, along === 'rows' ? stage.h : stage.w);
  const shorter = Math.min(stage.w, stage.h);

  if (shorter > FOLDS_UNDER) {
    return { form: 'spread', along, first: long, second: 0 };
  }

  // Too small to divide and still have anything on either side of the divide. One box, and whatever is in
  // the first bay has it: better a map with nothing under it than two slivers.
  if (long < BAY_LEAST * 2) {
    return { form: 'bays', along, first: long, second: 0 };
  }

  const [first, second] = share(long, asking);
  return { form: 'bays', along, first, second };
}
