import './choice.css';

import { useRef } from 'react';
import type { KeyboardEvent } from 'react';

import type { Showing } from '../button/Button';
import { FillLayer } from '../border/Border';
import { Container } from '../container/Container';
import { Mark } from '../mark/Mark';
import type { MarkName } from '../mark/Mark';
import { stepTo } from '../tabs/tabs';
import { Tooltip } from '../tooltip/Tooltip';

/**
 * A choice of a few: one of several, side by side in a frame of their own, the chosen one on parchment -
 * as the page's own width and ground are chosen. An option is words or a mark, as a button is.
 *
 * To a screen reader it is a group of radio buttons, and to the keyboard the same: only the chosen one is
 * a stop for Tab, and the arrows go along the options and choose as they go, Home and End to the ends,
 * passing over one that cannot be chosen. Its frame is the `choice.frame` recipe. See docs/UI-COMPONENTS.md.
 */

export interface Option {
  readonly id: string;
  /** What it is, in words: written on it, or its tooltip and what a screen reader says, when it is a mark. */
  readonly label: string;
  /** A mark on it instead of the words. */
  readonly mark?: MarkName;
  readonly disabled?: boolean;
  /** Draw it as if hovered, pressed or focused: for the page, never for the game. */
  readonly showing?: Showing;
}

/** How tall an option is drawn, by the size asked for, in pixels. */
export const CHOICE_HEIGHTS = { small: 24, regular: 30 } as const;
export type ChoiceSize = keyof typeof CHOICE_HEIGHTS;

/** The arrow keys that go along the options: across, and down and up for a screen reader's habit. */
const ALONG: Record<string, string> = { ArrowUp: 'ArrowLeft', ArrowDown: 'ArrowRight' };

export function Choice({
  options,
  chosen,
  onChoose,
  label,
  size = 'regular',
}: {
  options: readonly Option[];
  /** The id of the option that is chosen. */
  chosen: string;
  onChoose: (id: string) => void;
  /** What is being chosen, for a screen reader: Width. */
  label: string;
  size?: ChoiceSize;
}) {
  const group = useRef<HTMLDivElement>(null);
  const height = CHOICE_HEIGHTS[size];
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])];
    const on = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const to = stepTo(
      on >= 0 ? on : options.findIndex((option) => option.id === chosen),
      ALONG[event.key] ?? event.key,
      options.map((option) => option.disabled !== true),
    );
    if (to === null) {
      return;
    }
    event.preventDefault();
    onChoose(options[to]!.id);
    buttons[to]?.focus();
  };
  return (
    <Container recipe="choice.frame" className="ui-choice">
      <div
        ref={group}
        className={`ui-choice__options ui-choice--${size}`}
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        {options.map((option) => {
          const isChosen = option.id === chosen;
          const button = (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isChosen}
              tabIndex={isChosen ? 0 : -1}
              className={`ui-choice__option${option.mark === undefined ? '' : ' ui-choice__option--mark'}`}
              style={{ height }}
              disabled={option.disabled === true}
              data-showing={option.showing}
              onClick={() => onChoose(option.id)}
              {...(option.mark === undefined ? {} : { 'aria-label': option.label })}
            >
              {isChosen && <FillLayer name="parchment" />}
              <span className="ui-choice__words">
                {option.mark === undefined ? (
                  option.label
                ) : (
                  <Mark name={option.mark} size={Math.round(height * 0.6)} />
                )}
              </span>
            </button>
          );
          return option.mark === undefined ? (
            button
          ) : (
            <Tooltip key={option.id} text={option.label} describes={false}>
              {button}
            </Tooltip>
          );
        })}
      </div>
    </Container>
  );
}
