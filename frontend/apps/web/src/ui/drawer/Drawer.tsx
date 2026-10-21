import './drawer.css';

import type { ReactNode } from 'react';

import { MarkButton } from '../button/Button';
import { Container } from '../container/Container';
import { ScrollArea } from '../scroll/ScrollArea';

/**
 * A drawer: what a mark opens over a stage without leaving it - a challenge's history - sliding in from the stage's
 * right edge when it is held wide and from its bottom when it is held deep, so it takes the stage's longer side and
 * leaves the rest to be watched. Its title and close mark at its head, what it holds scrolling under them. It slides in
 * a fifth of a second, and while it is shut nothing in it can be reached. Held by whoever opens it, inside a stage
 * that is `position: relative`. In the `pane.drawer` recipe. See docs/UI-COMPONENTS.md and decision record 0116.
 */
export function Drawer({
  title,
  open,
  onClose,
  from,
  size,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  /** The edge it slides in from: the right of a stage held wide, the bottom of one held deep. */
  from: 'right' | 'bottom';
  /** How far it reaches in from that edge, in pixels or any CSS length. */
  size?: number | string;
  children: ReactNode;
}) {
  return (
    <div
      className={`ui-drawer ui-drawer--${from}`}
      data-open={open}
      style={from === 'right' ? { width: size } : { height: size }}
      inert={!open}
      role="dialog"
      aria-label={title}
      aria-hidden={!open}
    >
      <Container recipe="pane.drawer" fills>
        <div className="ui-drawer__inside">
          <div className="ui-drawer__head">
            <h3 className="ui-heading ui-drawer__title">{title}</h3>
            <MarkButton
              label={`Close the ${title.toLowerCase()}`}
              mark="close"
              size="small"
              onClick={onClose}
            />
          </div>
          <ScrollArea className="ui-drawer__body" label={title}>
            {children}
          </ScrollArea>
        </div>
      </Container>
    </div>
  );
}
