import './bar.css';

import { useRef } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';

import { FaceLayer } from '../button/Button';
import type { Showing } from '../button/Button';
import { Container } from '../container/Container';
import { Mark } from '../mark/Mark';
import type { MarkName } from '../mark/Mark';
import { Tooltip } from '../tooltip/Tooltip';
import { BAR_THICKNESS, stepAlong, stopOf } from './bar';
import type { BarAlong } from './bar';

/**
 * The bottom bar: a row of marks along the bottom of what it chooses for, one of them lit, saying what is
 * standing there and putting something else there at a press. A phone's way between its panes, where a
 * row of tabs over a pane would be a row of things too small to hit: each mark has an even share of the
 * bar, a thumb thick.
 *
 * **Marks and no words**, Adam's call of 2026-10-08, so each carries its meaning in words for the
 * pointer's tooltip, a finger held on it and a screen reader. The lit one stands on the chosen tab's
 * parchment, turned so that it opens into what it chose for - upward, or to the left when the bar is
 * turned to run down the side - and the rest stand on the bar's own stone.
 *
 * It is a toolbar of buttons that say whether they are pressed, not a row of tabs: pressing the lit one
 * is a thing in its own right, which is the game's to say, and the arrow keys move along it without
 * pressing anything. See docs/UI-COMPONENTS.md.
 */

export interface BarButton {
  readonly id: string;
  /** What it stands for, in words: its tooltip, and what a screen reader says. */
  readonly label: string;
  readonly mark: MarkName;
  readonly disabled?: boolean;
  /** Draw it as if hovered, pressed or focused: for the page, never for the game. */
  readonly showing?: Showing;
}

/** The face the lit button stands on: the tab that is chosen, turned to open into what it chose for. */
const LIT = 'tab-chosen';

export function BottomBar({
  buttons,
  chosen,
  onPress,
  label,
  along = 'across',
}: {
  buttons: readonly BarButton[];
  /** The id of the one that is lit, or null for none. */
  chosen: string | null;
  onPress: (id: string) => void;
  /** What the bar chooses between, for a screen reader: What is in the bottom. */
  label: string;
  along?: BarAlong;
}) {
  const row = useRef<HTMLDivElement>(null);
  const enabled = buttons.map((button) => button.disabled !== true);
  const stop = stopOf(
    enabled,
    buttons.findIndex((button) => button.id === chosen),
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = [...(row.current?.querySelectorAll<HTMLButtonElement>('.ui-bar__button') ?? [])];
    const on = all.indexOf(document.activeElement as HTMLButtonElement);
    const to = stepAlong(on >= 0 ? on : (stop ?? 0), event.key, enabled);
    if (to === null) {
      return;
    }
    event.preventDefault();
    all[to]?.focus();
  };

  return (
    <div
      className={`ui-bar ui-bar--${along}`}
      style={{ '--ui-bar-thick': `${BAR_THICKNESS}px` } as CSSProperties}
    >
      <Container recipe="bar.bottom" fills />
      <div
        ref={row}
        className="ui-bar__row"
        role="toolbar"
        aria-label={label}
        aria-orientation={along === 'down' ? 'vertical' : 'horizontal'}
        onKeyDown={onKeyDown}
      >
        {buttons.map((button, at) => {
          const lit = button.id === chosen;
          return (
            <Tooltip key={button.id} text={button.label} describes={false}>
              <button
                type="button"
                className="ui-button ui-bar__button"
                aria-label={button.label}
                aria-pressed={lit}
                tabIndex={at === stop ? 0 : -1}
                disabled={button.disabled === true}
                data-showing={button.showing}
                onClick={() => onPress(button.id)}
              >
                {lit && <FaceLayer name={LIT} height={BAR_THICKNESS} />}
                <span className="ui-button__mark">
                  <Mark name={button.mark} size={Math.round(BAR_THICKNESS * 0.55)} />
                </span>
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
