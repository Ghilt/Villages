import type { ChallengeRowView, ChallengeRunFrame, QuestNodeView, QuestView } from '@villages/protocol';
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

/** Who won a challenge, by name: the house, who stood against it, or nobody at an even tug. */
function winnerOf(row: ChallengeRowView): string | null {
  const { wonBy } = row.outcome;
  return wonBy === 'a' ? row.house : wonBy === 'b' ? row.against.name : null;
}

/** How a challenge ended: `pulled to the end in second 12`, or `time ran out in second 30, 41.5 toward Ravenscar`. */
function endedSaid(row: ChallengeRowView): string {
  const { outcome } = row;
  return outcome.ended === 'pulled'
    ? `pulled to the end in second ${outcome.second}`
    : `time ran out in second ${outcome.second}, ${towardSaid(outcome.tug, row.house, row.against.name)}`;
}

/**
 * A challenge fought, in a line of its history: who stood against whom, its kind, who won it, and how it ended -
 * `Ravenscar against Brother Anselm, a debate, won by Ravenscar: time ran out in second 30, 41.5 toward Ravenscar`.
 */
export function historyLine(row: ChallengeRowView): string {
  const kind = kindSaid(row.kind);
  const won = `won by ${winnerOf(row) ?? 'nobody'}`;
  return `${row.house} against ${row.against.name}, ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}, ${won}: ${endedSaid(row)}`;
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

/** The house's colour in a challenge's spectacle, until a house's banner gives one: the map's lapis. */
export const HOUSE_COLOUR = '#3d6aa6';

/** Who stands on each side of a challenge's spectacle: the house on the first, who stood against it on the second. */
export function housesOf(row: ChallengeRowView): Record<'a' | 'b', { name: string; colour: string }> {
  return { a: { name: row.house, colour: HOUSE_COLOUR }, b: row.against };
}

/** A challenge's result, as the card after it says it: who won, how it ended, what each side gained and lost. */
export interface ResultSaid {
  /** `Ravenscar won`, `Brother Anselm won`, `Nobody won`. */
  readonly won: string;
  /** `Time ran out in second 30, 41.5 toward Ravenscar.` */
  readonly how: string;
  /** A line for each thing gained and lost: `Brother Anselm: 5 piety gained`, `Brother Anselm: the chapel damaged`. */
  readonly spoils: readonly string[];
}

export function resultSaid(row: ChallengeRowView): ResultSaid {
  const side = (which: 'a' | 'b') => (which === 'a' ? row.house : row.against.name);
  const ended = endedSaid(row);
  return {
    won: `${winnerOf(row) ?? 'Nobody'} won`,
    how: `${ended.charAt(0).toUpperCase()}${ended.slice(1)}.`,
    spoils: [
      ...row.outcome.gains.map(
        (gain) => `${side(gain.side)}: ${Math.round(gain.amount * 10) / 10} ${gain.resource} gained`,
      ),
      ...row.outcome.losses.map((loss) => `${side(loss.side)}: ${loss.name} ${loss.became}`),
    ],
  };
}

/** Where the quest goes on to after a challenge, once that is known: `The debate in the square goes on to A penance.` */
export function nextSaid(row: ChallengeRowView): string | null {
  return row.then === undefined ? null : `${row.quest} goes on to ${row.then}.`;
}

/**
 * What a challenge fought again says of itself beside what was recorded: nothing when it comes out the same; that it
 * cannot be watched when the challenges in force could not fight it again; and that it comes out otherwise when they
 * did, what was recorded standing.
 */
export function replaySaid(run: ChallengeRunFrame): string | null {
  if (!run.differs) return null;
  return run.moments.length === 0
    ? 'It cannot be watched again: the challenges have changed since it was fought.'
    : 'The challenges have changed since it was fought, and fought again it comes out otherwise; what was recorded stands.';
}

/** The challenge newly fought for the challenge that was accepted: its row in the history, once it is there. */
export function foughtFor(
  rows: readonly ChallengeRowView[],
  accepted: ChallengeAsked | null,
): ChallengeRowView | null {
  if (accepted === null) return null;
  return rows.find((row) => row.questId === accepted.questId && row.nodeId === accepted.nodeId) ?? null;
}

/** A log line for a challenge fought again to be watched: `watching "Brother Anselm's challenge" again`. */
export function watchingSaid(run: ChallengeRunFrame, rows: readonly ChallengeRowView[] | null): string {
  const title = rows?.find((row) => row.id === run.id)?.title ?? 'a challenge';
  return `watching "${title}"${run.differs ? ', which comes out otherwise now than recorded' : ''}`;
}
