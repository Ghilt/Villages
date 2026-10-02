import './badge.css';

import type { ReactNode } from 'react';

/**
 * A count on a mark or a button: three letters unread, twelve new. Nothing at all at nought, because a
 * badge that says nothing is a mark the player learns to ignore. Past `most` it says `99+`, because a
 * pip with four figures in it is a label. Drawn, a velvet pip in a gilt ring, until one is painted.
 * See docs/UI-COMPONENTS.md.
 */

/** The most a badge counts before it says that many and more. */
export const BADGE_MOST = 99;

/** A count as a badge says it, or null when there is nothing to say. */
export function countSaid(count: number, most = BADGE_MOST): string | null {
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }
  return count > most ? `${most}+` : String(Math.floor(count));
}

export function Badge({ count, most = BADGE_MOST, what }: { count: number; most?: number; what?: string }) {
  const said = countSaid(count, most);
  if (said === null) {
    return null;
  }
  return (
    <span className="ui-badge ui-numeral" aria-label={what === undefined ? said : `${said} ${what}`}>
      {said}
    </span>
  );
}

/** A badge on the top right corner of whatever it is on. */
export function Badged({
  count,
  most,
  what,
  children,
}: {
  count: number;
  most?: number;
  /** What is being counted, for a screen reader: `letters`. */
  what?: string;
  children: ReactNode;
}) {
  return (
    <span className="ui-badged">
      {children}
      <Badge
        count={count}
        {...(most === undefined ? {} : { most })}
        {...(what === undefined ? {} : { what })}
      />
    </span>
  );
}
