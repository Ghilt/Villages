import './topBar.css';

import type { CSSProperties, ReactNode } from 'react';

import { Container } from '../container/Container';
import { Mark } from '../mark/Mark';
import type { MarkName } from '../mark/Mark';
import { BAR_THICKNESS } from './bar';

/**
 * The top bar: a window on top of a phone, said in one band a thumb thick - the mark it is known by, its
 * name, a word or two beside the name, and its controls at the far end. Put away, a window on top is its
 * top bar and nothing else, which is why it is exactly a strip thick. The map wears none: a bar across it
 * was too heavy in the picture, Adam's word of 2026-10-08, and it carries its controls alone.
 *
 * **Turned**, it is a sliver down the side of a turned phone, 44 wide: the controls at the top, the mark
 * under them and the name reading down from there, turned rather than dropped, because there is no room for
 * a word across 44 pixels and the whole height of the phone along one. The word beside the name has no room
 * there and is left out.
 *
 * **Framed** it stands in `bar.top`, the strip's narrow gilt on stone; unframed, for a bar inside something
 * already framed, it is the same row on whatever it stands on. See docs/UI-COMPONENTS.md.
 */
export function TopBar({
  mark,
  kind,
  name,
  beside,
  end,
  turned = false,
  framed = true,
}: {
  mark: MarkName;
  /** What kind of thing it is, in words: what the mark says to a pointer resting on it and to a screen reader. */
  kind: string;
  /** Which one: on one line, trimmed when it is too long for the bar. */
  name: string;
  /** A word or two of quiet context beside the name, a `Tag`. Not drawn turned. */
  beside?: ReactNode;
  /** What stands at the far end: the pane's controls. */
  end?: ReactNode;
  turned?: boolean;
  framed?: boolean;
}) {
  return (
    <div
      className={`ui-top-bar ui-top-bar--${turned ? 'turned' : 'across'}`}
      style={{ '--ui-bar-thick': `${BAR_THICKNESS}px` } as CSSProperties}
    >
      {framed && <Container recipe="bar.top" fills />}
      <div className={framed ? 'ui-top-bar__row ui-on-night' : 'ui-top-bar__row'}>
        <span className="ui-top-bar__mark" role="img" aria-label={kind} title={kind}>
          <Mark name={mark} size={20} />
        </span>
        <span className="ui-top-bar__named">
          <h2 className="ui-top-bar__name" title={name}>
            {name}
          </h2>
          {!turned && beside}
        </span>
        {end !== undefined && <span className="ui-top-bar__end">{end}</span>}
      </div>
    </div>
  );
}
