import './quest.css';

import type { Showing } from '../button/Button';
import { Mark } from '../mark/Mark';
import type { MarkName } from '../mark/Mark';

/** What a node is, when it is shown for what it is. */
export type QuestNodeKind = 'dialogue' | 'checklist' | 'reward' | 'challenge';

/** What a node is to the quest now. */
export type QuestNodeState = 'done' | 'current' | 'ahead' | 'lost';

const KIND_MARKS: Record<QuestNodeKind, MarkName> = {
  dialogue: 'talk',
  checklist: 'checklist',
  reward: 'reward',
  challenge: 'challenge',
};

const STATE_WORDS: Record<QuestNodeState, string> = {
  done: 'done',
  current: 'where the quest stands',
  ahead: 'ahead',
  lost: 'lost',
};

/**
 * One node of a quest's map: a round seal with the mark of its kind, a question mark while it is not shown for what
 * it is, and its title under it. Done, it carries a tick; where the quest stands, it is lit; lost, it is struck
 * through and faded. Pressable when there is something to open, and `chosen` while it is open. Drawn rather than
 * painted for now. See decision record 0096 and docs/UI-COMPONENTS.md.
 */
export function QuestNode({
  kind,
  state,
  title,
  size = 44,
  onPress,
  chosen = false,
  showing,
}: {
  /** Left out for a question mark. */
  kind?: QuestNodeKind;
  state: QuestNodeState;
  title?: string;
  /** How big the seal is drawn, in pixels. */
  size?: number;
  onPress?: () => void;
  chosen?: boolean;
  /** Draw it as if hovered, pressed or focused: for the page, never for the game. */
  showing?: Showing;
}) {
  const mark = kind === undefined ? 'unknown' : KIND_MARKS[kind];
  const said = `${title ?? 'not yet known'}: ${STATE_WORDS[state]}`;
  return (
    <span className={`ui-quest-node ui-quest-node--${state}`} style={{ width: Math.max(size * 2.4, 96) }}>
      <button
        type="button"
        className={`ui-quest-node__seal${chosen ? ' ui-quest-node__seal--chosen' : ''}${kind === undefined ? ' ui-quest-node__seal--unknown' : ''}`}
        style={{ width: size, height: size }}
        onClick={onPress}
        disabled={onPress === undefined}
        aria-label={said}
        aria-pressed={onPress === undefined ? undefined : chosen}
        data-showing={showing}
      >
        <Mark name={mark} size={Math.round(size * 0.55)} />
        {state === 'done' && (
          <span className="ui-quest-node__badge">
            <Mark name="done" size={Math.round(size * 0.32)} />
          </span>
        )}
        {state === 'lost' && (
          <span className="ui-quest-node__struck">
            <Mark name="lost" size={size} />
          </span>
        )}
      </button>
      {title !== undefined && <span className="ui-quest-node__title ui-label">{title}</span>}
    </span>
  );
}
