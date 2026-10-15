import './quest.css';

import type { ReactNode } from 'react';

import { MarkButton } from '../button/Button';
import { Mark } from '../mark/Mark';
import type { MarkName } from '../mark/Mark';

/** What pressing a row does, for a row the player meets: its mark, what it means in words, and whether it can. */
export interface RowAction {
  readonly mark: MarkName;
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}

/**
 * One row of a quest's checklist: a box, ticked once the objective is met, what it asks, and at its end the button
 * that meets it when the player is the one who does - or nothing, for a row the world ticks. A line under it says
 * what the row cannot say itself: why its button is greyed, or that the world ticks it. Drawn rather than painted.
 * See decision record 0096 and docs/UI-COMPONENTS.md.
 */
export function ChecklistRow({
  words,
  met,
  lead,
  action,
  note,
}: {
  /** What it asks, in the player's words. */
  words: string;
  met: boolean;
  /** A mark before the words: the resource it asks for, say. */
  lead?: ReactNode;
  /** The button that meets it, for a row the player meets and has not; left out once it is met. */
  action?: RowAction;
  /** A line under it. */
  note?: string;
}) {
  return (
    <div className={`ui-checklist-row${met ? ' ui-checklist-row--met' : ''}`}>
      <span className="ui-checklist-row__box" role="img" aria-label={met ? 'met' : 'not yet met'}>
        {met && <Mark name="done" size={16} />}
      </span>
      <span className="ui-checklist-row__words">
        <span className="ui-checklist-row__asks ui-body">
          {lead !== undefined && <span className="ui-checklist-row__lead">{lead}</span>}
          {words}
        </span>
        {note !== undefined && <span className="ui-checklist-row__note">{note}</span>}
      </span>
      {action !== undefined && !met && (
        <MarkButton
          size="small"
          label={action.label}
          mark={action.mark}
          onClick={action.onPress}
          disabled={action.disabled ?? false}
        />
      )}
    </div>
  );
}
