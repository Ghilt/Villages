import './inspect-page.css';

import type { ReactNode } from 'react';

import { INSPECT_INDEX } from '../address';

/**
 * The frame every inspect page stands in: paper, with a bar across its head - the page's name, a line on what it
 * is, whatever the page keeps up there, and the way back to the index - and the page under it. One frame, so the
 * pages beside the game read as one set and each says only what is its own.
 */
export function InspectPage({
  title,
  epigraph,
  bar,
  back = true,
  className,
  children,
}: {
  title: string;
  epigraph?: string;
  /** What stands in the bar after the name: a count, a connection's state, a button. */
  bar?: ReactNode;
  /** Whether the bar carries the way back, which the index itself does not. */
  back?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <main className={className === undefined ? 'inspect-page' : `inspect-page ${className}`}>
      <header className="inspect-page__bar">
        <div className="inspect-page__heading">
          <h1 className="inspect-page__title">{title}</h1>
          {epigraph !== undefined && <p className="inspect-page__epigraph">{epigraph}</p>}
        </div>
        {bar}
        {back && <BackToIndex />}
      </header>
      {children}
    </main>
  );
}

/** The way back to the index, at the end of every inspect page's bar. */
export function BackToIndex() {
  return (
    <a className="inspect-back" href={INSPECT_INDEX}>
      ← all inspect views
    </a>
  );
}
