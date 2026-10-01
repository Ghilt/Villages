import './expander.css';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';

import { Rule } from '../divider/Divider';
import { Mark } from '../mark/Mark';

/**
 * An expandable section: a heading that folds what is under it open and shut. The heading is its name
 * on a rule, as the moodboard heads its sections, with a mark pointing at what it holds that turns down
 * when it is open, and whatever it says at the far end whether it is open or not - a count, a total.
 *
 * It opens and shuts in a fifth of a second rather than at once, because nothing in the interface pops,
 * and while it is shut nothing in it can be reached by the keyboard. Held by whoever uses it, with `open`,
 * or by itself from `startOpen`. See docs/UI-COMPONENTS.md.
 */
export function Expander({
  title,
  open,
  startOpen = false,
  onToggle,
  aside,
  showing,
  children,
}: {
  title: ReactNode;
  /** Open or shut, when whoever holds it says; left out, it keeps its own. */
  open?: boolean;
  /** Whether it starts open, when it keeps its own. */
  startOpen?: boolean;
  onToggle?: (open: boolean) => void;
  /** Said at the far end of its heading, open or shut: 3 letters. */
  aside?: ReactNode;
  /** Draw its heading as if hovered or focused: for the page, never for the game. */
  showing?: 'hover' | 'focus';
  children: ReactNode;
}) {
  const [own, setOwn] = useState(startOpen);
  const isOpen = open ?? own;
  const id = useId();
  const toggle = () => {
    if (open === undefined) {
      setOwn(!isOpen);
    }
    onToggle?.(!isOpen);
  };
  return (
    <div className="ui-expander" data-open={isOpen}>
      <button
        type="button"
        id={`${id}head`}
        className="ui-expander__head"
        aria-expanded={isOpen}
        aria-controls={`${id}body`}
        onClick={toggle}
        data-showing={showing}
      >
        <span className="ui-expander__fold">
          <Mark name="fold" size={16} />
        </span>
        <span className="ui-expander__title ui-caps">{title}</span>
        <span className="ui-expander__rule">
          <Rule />
        </span>
        {aside !== undefined && <span className="ui-expander__aside">{aside}</span>}
      </button>
      <div
        id={`${id}body`}
        className="ui-expander__body"
        role="region"
        aria-labelledby={`${id}head`}
        inert={!isOpen}
      >
        <div className="ui-expander__inner">
          <div className="ui-expander__content">{children}</div>
        </div>
      </div>
    </div>
  );
}
