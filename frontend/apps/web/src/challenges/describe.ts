import type { QuestNodeView, QuestView } from '@villages/protocol';
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
