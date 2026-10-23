import type { ChallengeRowView, QuestNodeView, QuestView } from '@villages/protocol';
import type { Challenges } from '@villages/world';

import type { ChallengeAsked } from './toChoose';

/** At most this many slices are brought to a challenge, the engine's own limit. */
export const MOST_BROUGHT = 3;

/** A challenge a quest stands at, waiting to be accepted: its quest and its node. */
export interface ChallengeWaiting {
  readonly quest: QuestView;
  readonly node: QuestNodeView;
}

/**
 * The challenge the pane chooses for: the one asked, while its quest is open and still stands at it. Null once it is
 * accepted, its quest moved on, or its quest ended - nothing is chosen for a challenge that no longer waits.
 */
export function waitingAt(
  quests: readonly QuestView[],
  asked: ChallengeAsked | null,
): ChallengeWaiting | null {
  if (asked === null) return null;
  const quest = quests.find((one) => one.id === asked.questId && one.ending.kind === 'open');
  const node = quest?.nodes.find((one) => one.id === asked.nodeId);
  return quest !== undefined && node?.kind === 'challenge' && node.state === 'current'
    ? { quest, node }
    : null;
}

/** Whether any open quest stands at a challenge, which is reason enough for the pane to stand. */
export function anyWaiting(quests: readonly QuestView[]): boolean {
  return quests.some(
    (quest) =>
      quest.ending.kind === 'open' &&
      quest.nodes.some((node) => node.kind === 'challenge' && node.state === 'current'),
  );
}

/** A starting slice's effects in words, by their names in the catalogue: `Refutation and Foresight`. */
export function effectsSaid(effects: readonly string[], content: Challenges): string {
  const names = effects.map((id) => content.effects.find((effect) => effect.id === id)?.name ?? id);
  return names.length <= 1 ? (names[0] ?? 'nothing') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** The slices brought, one pressed added or taken away: never more than may be brought, never one twice. */
export function bringing(brought: readonly string[], pressed: string): readonly string[] {
  if (brought.includes(pressed)) return brought.filter((one) => one !== pressed);
  return brought.length >= MOST_BROUGHT ? brought : [...brought, pressed];
}

/** The first challenge any open quest stands at, waiting to be accepted, or none. */
export function firstWaiting(quests: readonly QuestView[]): ChallengeWaiting | null {
  for (const quest of quests) {
    if (quest.ending.kind !== 'open') continue;
    const node = quest.nodes.find((one) => one.kind === 'challenge' && one.state === 'current');
    if (node !== undefined) return { quest, node };
  }
  return null;
}

/** A challenge's kind in words, from its name in the challenge catalogue: `tradeWar` is a trade war. */
export function kindSaid(kind: string): string {
  return kind.replace(/([A-Z])/g, ' $1').toLowerCase();
}

/** A tug in words, toward whichever side it leans, as the spectacle says it: `41.5 toward Ravenscar`. */
function towardSaid(tug: number, house: string, against: string): string {
  if (tug === 0) return 'even';
  return `${Math.round(Math.abs(tug) * 10) / 10} toward ${tug > 0 ? house : against}`;
}

/**
 * A challenge fought, in a line of its history: who stood against whom, its kind, who won it, and how it ended -
 * `Ravenscar against Brother Anselm, a debate, won by Ravenscar: time ran out in second 30, 41.5 toward Ravenscar`.
 */
export function historyLine(row: ChallengeRowView): string {
  const { house, against, outcome } = row;
  const kind = kindSaid(row.kind);
  const won =
    outcome.wonBy === 'a'
      ? `won by ${house}`
      : outcome.wonBy === 'b'
        ? `won by ${against.name}`
        : 'won by nobody';
  const how =
    outcome.ended === 'pulled'
      ? `pulled to the end in second ${outcome.second}`
      : `time ran out in second ${outcome.second}, ${towardSaid(outcome.tug, house, against.name)}`;
  return `${house} against ${against.name}, ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}, ${won}: ${how}`;
}

/** Where the challenge's quest went on to, in a line, once it is known. */
export function thenSaid(row: ChallengeRowView): string | null {
  return row.then === undefined ? null : `${row.quest} went on to ${row.then}.`;
}

/** A challenge's row in the history, said whole: its line, and where its quest went on to once that is known. */
export function historySaid(row: ChallengeRowView): string {
  const then = thenSaid(row);
  return then === null ? `${historyLine(row)}.` : `${historyLine(row)}. ${then}`;
}

/** The history newest first, as a list of what was done reads. */
export function newestFirst(rows: readonly ChallengeRowView[]): readonly ChallengeRowView[] {
  return [...rows].reverse();
}

/**
 * The log lines a new history is worth, against the one heard before it: the first said in a line, and after that
 * each challenge newly fought said whole, and each whose quest's road was heard since said by where it went.
 */
export function whatChangedIn(
  before: readonly ChallengeRowView[] | null,
  after: readonly ChallengeRowView[],
): string[] {
  if (before === null) {
    return [after.length === 0 ? 'no challenges fought yet' : `${after.length} challenges fought`];
  }
  return after.flatMap((row) => {
    const was = before.find((one) => one.id === row.id);
    if (was === undefined) return [`fought "${row.title}": ${historyLine(row)}`];
    const then = thenSaid(row);
    return was.revision !== row.revision && then !== null ? [then] : [];
  });
}
