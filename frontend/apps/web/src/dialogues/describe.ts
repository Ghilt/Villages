import type { DialogueView, RequirementView, RevealImpactView, SpeakerView } from '@villages/protocol';

import { RESOURCE_WORDS } from '../house/describe';

function lines(count: number): string {
  return count === 1 ? '1 line' : `${count} lines`;
}

/**
 * How an option shows what taking it will do, in words, as whoever wrote it chose: what it gains and costs,
 * `−40 wealth, +100 wealth`; `???` when it is hidden; and nothing at all when it shows nothing. See 0067.
 */
export function impactWords(impact: RevealImpactView | undefined): string | null {
  if (impact === undefined) {
    return null;
  }
  if (impact.kind === 'hidden') {
    return '???';
  }
  return impact.impacts
    .map(
      ({ resource, amount }) =>
        `${amount > 0 ? '+' : '−'}${Math.abs(amount)} ${RESOURCE_WORDS[resource].toLowerCase()}`,
    )
    .join(', ');
}

/** A requirement in words, naming a character by the speaker they are when they speak in the dialogue. */
export function requirementWords(requirement: RequirementView, speakers: readonly SpeakerView[]): string {
  switch (requirement.kind) {
    case 'alive':
      return `${nameOf(requirement.character, speakers)} alive`;
  }
}

/** Why a dialogue was lost, in words: what became of the requirement that failed. See decision record 0067. */
export function whyLost(requirement: RequirementView, speakers: readonly SpeakerView[]): string {
  switch (requirement.kind) {
    case 'alive':
      return `${nameOf(requirement.character, speakers)} died`;
  }
}

/** A character by the name they speak under in the dialogue, or by their id when they do not speak in it. */
function nameOf(character: string, speakers: readonly SpeakerView[]): string {
  return speakers.find((one) => one.character === character)?.name ?? `character ${character.slice(0, 8)}`;
}

/**
 * How many of the house's dialogues are waiting and how many are finished, in the pane's words, until the
 * pane lists them. A lost one is finished: it ended where it stood. See decision record 0067.
 */
export function howMany(dialogues: readonly DialogueView[]): string {
  const waiting = dialogues.filter((one) => one.ending.kind === 'open').length;
  return `${waiting} waiting, ${dialogues.length - waiting} finished`;
}

/** Where a dialogue stands, in the log's words: what is left to read, and whether a dialogue choice waits. */
export function standing(dialogue: DialogueView): string {
  switch (dialogue.ending.kind) {
    case 'completed':
      return `finished, ${lines(dialogue.said.length)} said`;
    case 'lost':
      return `lost, ${lines(dialogue.said.length)} said: ${whyLost(dialogue.ending.because, dialogue.speakers)}`;
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
