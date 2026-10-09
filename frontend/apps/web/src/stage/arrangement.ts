import type { Asking } from './bayBox';
import { STRIP } from './bayBox';
import type { PaneSize } from './panes';

/*
 * How the two bays of a phone divide the stage: three arrangements, and what each means for the bay at either
 * end. Pure arithmetic, and the bay manager's to keep; see `bays.ts` and decision record 0046.
 */

/** Which of the two. `0` is the top or the left, `1` is the bottom or the right. */
export type Which = 0 | 1;

/**
 * How the two bays divide the stage between them. Three settings, and there is no fourth.
 *
 * **A property of the fold, not of the panes in it.** A bay is not a pane's own room: it is one end of a
 * stage two things are sharing, and what happens to be standing in it has nothing to say about how much of
 * it there is. That is what makes moving a pane free - the bottom bar puts Recent where the house status
 * was and the seam does not move, because the seam was never the house's.
 *
 * It is also what makes the three sizes mean the same thing on every pane, which they did not while each
 * declared its own pixel count: **a strip, half the stage, or the rest**. See decision record 0046.
 */
export type Arrangement = 'firstAway' | 'halfEach' | 'secondAway';

/**
 * What each bay asks the layout for, in each of the three arrangements.
 *
 * Three constants and not a derivation, which is the point. React compares what `useStore` picks from a store
 * hands back by identity, so this returns the **same object** across every change that is not an
 * arrangement change - and the stage does not so much as recompute its layout when the bar puts a pane
 * below. "Moving a pane does not resize the bays" stops being a behaviour to be careful about and becomes
 * an identity. It also retires the cache that used to sit here for the same identity reason.
 *
 * `bayBox` is untouched by any of it: `['big', 'big']` already meant half each and `[{ small }, 'big']`
 * already meant a strip and the rest, floor, cap and all. The arithmetic was never what was wrong.
 */
const ASKING: Readonly<Record<Arrangement, readonly [Asking, Asking]>> = {
  firstAway: [{ small: STRIP }, 'big'],
  halfEach: ['big', 'big'],
  secondAway: ['big', { small: STRIP }],
};

/** What each bay is asking the layout for, which is the arrangement and nothing else. */
export function askingOf(bays: { readonly arrangement: Arrangement }): readonly [Asking, Asking] {
  return ASKING[bays.arrangement];
}

/**
 * Which size the control marks on the pane in this bay.
 *
 * The two bays are always a mirrored pair and can never disagree, because there is one value under both of
 * them. **Both put away is not reachable**, which decision 0045 wanted and had to enforce with a rule;
 * here there is no rule, because there is no arrangement that says it.
 */
export function askedIn(how: Arrangement, which: Which): PaneSize {
  if (how === 'halfEach') {
    return 'small';
  }
  return (how === 'firstAway' ? 0 : 1) === which ? 'strip' : 'full';
}

/**
 * What a bay asking for one of the three sizes means for the arrangement.
 *
 * The other bay follows by reading the same value rather than by having one written into it, which is what
 * 0045 had to do while the size was a pane's own. Asking for half *is* the arrangement; asking to be
 * opened out puts the other one away; asking to be put away opens the other one out.
 */
export function arrangementFor(which: Which, size: PaneSize): Arrangement {
  if (size === 'small') {
    return 'halfEach';
  }
  const away = size === 'strip' ? which : which === 0 ? 1 : 0;
  return away === 0 ? 'firstAway' : 'secondAway';
}
