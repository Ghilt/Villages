import type { DialogueView } from '@villages/protocol';

function lines(count: number): string {
  return count === 1 ? '1 line' : `${count} lines`;
}

/** Where a dialogue stands, in the log's words: what is left to read, and whether a dialogue choice waits. */
export function standing(dialogue: DialogueView): string {
  switch (dialogue.ending.kind) {
    case 'completed':
      return `finished, ${lines(dialogue.said.length)} said`;
    case 'lost':
      return `lost, ${lines(dialogue.said.length)} said`;
    case 'open':
      if (dialogue.options.length === 0) {
        return `${lines(dialogue.next.length)} to read, up to the next step`;
      }
      return dialogue.next.length === 0
        ? `waiting on a dialogue choice of ${dialogue.options.length}`
        : `${lines(dialogue.next.length)} to read, then a dialogue choice of ${dialogue.options.length}`;
  }
}

/**
 * The log lines a new list of the player's dialogues is worth, against the list heard before it.
 *
 * The first list a connection hears is said whole, a line a dialogue, because it is what the player arrived
 * to; after that only the dialogues offered or moved on since, which a changed revision says. The switch that
 * shows requirements sends the list again unchanged, and so says nothing. See decision record 0067.
 */
export function whatChangedIn(
  before: readonly DialogueView[] | null,
  after: readonly DialogueView[],
): string[] {
  if (before === null) {
    return after.length === 0 ? ['no dialogues yet'] : after.map((one) => `"${one.title}": ${standing(one)}`);
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
