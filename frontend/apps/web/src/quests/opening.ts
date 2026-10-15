import type { QuestView } from '@villages/protocol';

import { arrive } from '../stage/arrive';
import { QUEST_PANE } from './pane';
import { openQuest } from './toOpen';

/**
 * A quest arriving, and the pane opening for it: the policy that joins what the gateway has heard to the bay manager,
 * as `dialogues/opening.ts` does for a dialogue. See `MECHANICS.md`.
 */

/** The quests in a list that have arrived: open, and in no list this page was shown before. */
export function arrivals(seen: Set<string>, quests: readonly QuestView[]): readonly QuestView[] {
  const arrived = quests.filter((one) => one.ending.kind === 'open' && !seen.has(one.id));
  for (const one of quests) {
    seen.add(one.id);
  }
  return arrived;
}

/** Every quest this page has been shown, for the life of the page. A reload is a new page. */
const shown = new Set<string>();

/**
 * Open the pane for a quest that has arrived, if one has: in the spread its tab comes up in the column, from its
 * strip if the column was put away, and on a phone it takes the bay that is not the map's, as a dialogue does.
 */
export function openOnArrival(quests: readonly QuestView[]): void {
  const arrived = arrivals(shown, quests);
  const newest = arrived[arrived.length - 1];
  if (newest === undefined) {
    return;
  }
  openQuest(newest.id);
  arrive(QUEST_PANE.id, { inTheSpread: 'small' });
}

/** The dialogues a quest leads to, which arrive through their quest rather than on their own. */
export function questDialogues(quests: readonly QuestView[] | null): ReadonlySet<string> {
  return new Set((quests ?? []).flatMap((quest) => quest.nodes.flatMap((node) => node.dialogueId ?? [])));
}
