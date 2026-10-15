import type { DialogueView } from '@villages/protocol';

import { arrive } from '../stage/arrive';
import { DIALOGUE_PANE } from './pane';

/**
 * A dialogue arriving, and the pane opening for it.
 *
 * The policy that joins what the gateway has heard to the bay manager, as `inspect/opening.ts` joins the
 * subject store to it for a window: neither knows the other, and what should happen when a dialogue is
 * offered is neither's business. See `MECHANICS.md`.
 */

/**
 * The dialogues in a list that have arrived: waiting, and in no list this page was shown before.
 *
 * It remembers every one it is shown, finished ones too, so a dialogue arrives once in the life of the
 * page however often the list comes again - a step taken, a reconnect, the requirements switch. The first
 * list after a load counts, as the letter does when a page loads with a question standing.
 */
export function arrivals(seen: Set<string>, dialogues: readonly DialogueView[]): readonly DialogueView[] {
  const arrived = dialogues.filter((one) => one.ending.kind === 'open' && !seen.has(one.id));
  for (const one of dialogues) {
    seen.add(one.id);
  }
  return arrived;
}

/** Every dialogue this page has been shown, for the life of the page. A reload is a new page. */
const shown = new Set<string>();

/**
 * Open the pane for a dialogue that has arrived, if one has.
 *
 * In the spread the pane is standing already, so one put away comes back to its normal size, and one open
 * stays as the player left it. On a phone it takes the bay that is not the map's, as a window does, and
 * opens it to at least half, because a dialogue that arrives as a strip is one nobody can read.
 */
export function openOnArrival(
  dialogues: readonly DialogueView[],
  throughAQuest: ReadonlySet<string> = new Set(),
): void {
  // A dialogue a quest leads to arrives through its quest, whose tab comes up instead. See decision record 0096.
  if (arrivals(shown, dialogues).filter((one) => !throughAQuest.has(one.id)).length === 0) {
    return;
  }
  arrive(DIALOGUE_PANE.id, { inTheSpread: 'small' });
}
