import './tag.css';

import type { ReactNode } from 'react';

/**
 * A word or two of quiet context beside a name: how fresh what is shown of it is, `current` or the day it was last
 * seen. Small, soft and faintly outlined, so the name it stands beside keeps the eye; it is read when looked for and
 * not before. Drawn rather than painted. See docs/UI-COMPONENTS.md.
 */
export function Tag({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="ui-tag" title={title}>
      {children}
    </span>
  );
}
