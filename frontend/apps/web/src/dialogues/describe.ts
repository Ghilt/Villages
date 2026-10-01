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

/**
 * Why a dialogue was lost, in words: what became of the requirement that failed, naming a character by the
 * speaker they are in it. The one thing a player ever learns of a requirement. See decision record 0067.
 */
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
 * How many of the house's dialogues are waiting and how many are finished, in the pane's words, which is
 * what its strip says. A lapsed one is finished: it ended where it stood. See decision record 0067.
 */
export function howMany(dialogues: readonly DialogueView[]): string {
  const waiting = dialogues.filter((one) => one.ending.kind === 'open').length;
  return `${waiting} waiting, ${dialogues.length - waiting} finished`;
}

/** One dialogue as the pane lists it. */
export interface ListedDialogue {
  readonly id: string;
  readonly title: string;
  /**
   * Who speaks in it, each name standing alone as it does on a bubble, because a name like "A messenger"
   * is right on its own and wrong inside a sentence; or, for one that lapsed, why it ended.
   */
  readonly line: string;
  /** For one waiting, whether a step has been taken in it yet; nothing for one finished. */
  readonly progress: 'new' | 'begun' | null;
  readonly lapsed: boolean;
}

/** The pane's list, in its two groups. */
export interface DialogueList {
  readonly waiting: readonly ListedDialogue[];
  readonly finished: readonly ListedDialogue[];
}

/**
 * The pane's list: the dialogues waiting, and under them the ones finished, a lapsed one saying why.
 *
 * Newest first in both, because the server sends them in the order they were offered and the one a player
 * looks for is the one that has just arrived. A dialogue is begun once a step has been taken in it, which is
 * what the server knows; lines read and not yet stepped past are the browser's and are read again after a
 * reload. See `MECHANICS.md`.
 */
export function listOf(dialogues: readonly DialogueView[]): DialogueList {
  const listed = [...dialogues].reverse().map((one): ListedDialogue => {
    const lapse =
      one.ending.kind === 'lost'
        ? `${whyLost(one.ending.because, one.speakers)} before it was finished`
        : null;
    return {
      id: one.id,
      title: one.title,
      line: lapse ?? one.speakers.map((speaker) => speaker.name).join(' · '),
      progress: one.ending.kind === 'open' ? (one.said.length === 0 ? 'new' : 'begun') : null,
      lapsed: lapse !== null,
    };
  });
  return {
    waiting: listed.filter((one) => one.progress !== null),
    finished: listed.filter((one) => one.progress === null),
  };
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
 * to; after that only the dialogues offered or moved on since, which a changed revision says, so a list sent
 * again unchanged says nothing. See decision record 0067.
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
