import type { QuestNodeView, QuestView } from '@villages/protocol';

/** A node in the player's words: its title, or a question mark for one not yet shown. */
function named(node: QuestNodeView): string {
  return node.title === undefined ? 'a question mark' : `"${node.title}"`;
}

/**
 * Where a quest stands, in a line: the node it stands at, how much of a checklist is ticked, and the roads lost, or
 * how it ended. See decision record 0096.
 */
export function standing(quest: QuestView): string {
  if (quest.ending.kind === 'completed') {
    return 'finished';
  }
  if (quest.ending.kind === 'lost') {
    return 'lost, a dialogue in it lapsed';
  }
  const at = quest.nodes.find((node) => node.state === 'current');
  const objectives = at?.objectives;
  const ticked =
    objectives === undefined
      ? ''
      : `, ${objectives.filter((one) => one.met).length} of ${objectives.length} ticked`;
  const lost = quest.nodes.filter((node) => node.state === 'lost').map(named);
  return (
    (at === undefined ? 'standing nowhere' : `stands at ${named(at)}${ticked}`) +
    (lost.length === 0 ? '' : `; lost ${lost.join(', ')}`)
  );
}

/**
 * The log lines a new list of the player's quests is worth, against the list heard before it: the first list said
 * whole, a line a quest, and after that only the quests offered or moved on since, which a changed revision says.
 */
export function whatChangedIn(before: readonly QuestView[] | null, after: readonly QuestView[]): string[] {
  if (before === null) {
    return after.length === 0 ? ['no quests yet'] : after.map((one) => `"${one.title}": ${standing(one)}`);
  }
  const heard = new Map(before.map((one) => [one.id, one.revision]));
  return after.flatMap((one) => {
    const revision = heard.get(one.id);
    if (revision === undefined) {
      return [`"${one.title}" offered: ${standing(one)}`];
    }
    return revision === one.revision ? [] : [`"${one.title}": ${standing(one)}`];
  });
}

/** A quest as the list shows it: its title, and where it stands or how it ended. */
export interface ListedQuest {
  readonly id: string;
  readonly title: string;
  readonly line: string;
  readonly lost: boolean;
}

/** The pane's list: the quests open, then those finished and lost, newest first in both. */
export function listOf(quests: readonly QuestView[]): {
  open: readonly ListedQuest[];
  finished: readonly ListedQuest[];
} {
  const listed = [...quests].reverse().map((one) => ({
    id: one.id,
    title: one.title,
    line: standing(one),
    lost: one.ending.kind === 'lost',
  }));
  return {
    open: listed.filter((one) => quests.find((quest) => quest.id === one.id)!.ending.kind === 'open'),
    finished: listed.filter((one) => quests.find((quest) => quest.id === one.id)!.ending.kind !== 'open'),
  };
}

/** How many quests there are, for the pane put away: how many are open, and how many are finished. */
export function howMany(quests: readonly QuestView[]): string {
  const open = quests.filter((one) => one.ending.kind === 'open').length;
  return `${open} open, ${quests.length - open} finished`;
}
