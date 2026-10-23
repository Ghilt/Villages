import './list.css';

import { Children, isValidElement } from 'react';
import type { ReactNode } from 'react';

import type { Showing } from '../button/Button';

/**
 * A list: things one under another with a fine rule between them - the house's holdings, its letters, its
 * key figures in a column - each a **row**. As long as it has to be; one too long for its room goes in a
 * scroll area. See docs/UI-COMPONENTS.md.
 */
export function List({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className="ui-list" role="list" aria-label={label}>
      {Children.toArray(children).map((child, at) => (
        <li key={isValidElement(child) && child.key !== null ? child.key : at} className="ui-list__item">
          {child}
        </li>
      ))}
    </ul>
  );
}

/**
 * One row of a list: something at its start - a mark, a small portrait - its name and what is said about
 * it under the name, and something at its end - a figure, a badge, a button of its own.
 *
 * Given `onPress`, the whole row is one button, its name stretched over all of it, as a card's is, and
 * whatever stands at its end stays a thing of its own to press. It is lighter under the pointer, darker
 * pressed, ringed inside its edge focused, marked down its start chosen, and dim disabled.
 *
 * A row says its name and its line in one line each, cut short where its room ends; given `whole`, it says them
 * whole instead, wrapping onto as many lines as they need, for a row whose every word is the point.
 */
export function ListRow({
  lead,
  title,
  line,
  trail,
  onPress,
  label,
  chosen = false,
  disabled = false,
  whole = false,
  showing,
}: {
  /** At its start: a mark, or a small picture. */
  lead?: ReactNode;
  /** Its name: Paris. */
  title: ReactNode;
  /** What is said about it, under its name: Prosperity, 3,245 souls. */
  line?: ReactNode;
  /** At its end: a figure, a badge, a button of its own. */
  trail?: ReactNode;
  /** What pressing it does: a row given this is a button. */
  onPress?: () => void;
  /** What a screen reader calls it, when its title is not the whole of its name. */
  label?: string;
  /** The one of the list that is chosen: the holding whose details are open. */
  chosen?: boolean;
  disabled?: boolean;
  /** Say its name and its line whole, wrapping, rather than cutting them short: a challenge in a house's history. */
  whole?: boolean;
  /** Draw it as if hovered, pressed or focused: for the page, never for the game. */
  showing?: Showing;
}) {
  const classes = [
    'ui-row',
    onPress === undefined ? '' : 'ui-row--press',
    chosen ? 'ui-row--chosen' : '',
    disabled ? 'ui-row--disabled' : '',
    whole ? 'ui-row--whole' : '',
    showing === undefined ? '' : `ui-row--showing-${showing}`,
  ]
    .filter((one) => one !== '')
    .join(' ');
  return (
    <div className={classes}>
      {lead !== undefined && <span className="ui-row__lead">{lead}</span>}
      <span className="ui-row__words">
        <span className="ui-row__title">
          {onPress === undefined ? (
            title
          ) : (
            <button
              type="button"
              className="ui-row__press"
              onClick={onPress}
              disabled={disabled}
              {...(chosen ? { 'aria-current': true } : {})}
              {...(label === undefined ? {} : { 'aria-label': label })}
            >
              {title}
            </button>
          )}
        </span>
        {line !== undefined && <span className="ui-label ui-row__line">{line}</span>}
      </span>
      {trail !== undefined && <span className="ui-row__trail">{trail}</span>}
    </div>
  );
}
