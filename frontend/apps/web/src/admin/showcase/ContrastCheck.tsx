import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

import { findUnreadable, MARK, markUnreadable } from './unreadable';
import type { Unreadable } from './unreadable';

/** How long the sheet has to stand still before it is measured again: a choice made, a box dragged. */
const SETTLE_MS = 700;

/**
 * Measures every word on the sheet while the contrast switch is on, and again whenever the sheet changes -
 * a ground switched, a state chosen, a picture saved over - and marks those too faint to read. Null while
 * the first measuring is under way, or when the switch is off.
 */
export function useUnreadable(
  sheet: RefObject<HTMLElement | null>,
  on: boolean,
  /** Anything outside the sheet that changes how it looks: the ground and the width. */
  looks: string,
): Unreadable[] | null {
  const [found, setFound] = useState<Unreadable[] | null>(null);
  useEffect(() => {
    const root = sheet.current;
    if (!on || root === null) {
      setFound(null);
      return;
    }
    let gone = false;
    let waiting: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      clearTimeout(waiting);
      waiting = setTimeout(() => {
        void findUnreadable(root).then((now) => {
          if (!gone) {
            markUnreadable(root, now);
            setFound(now);
          }
        });
      }, SETTLE_MS);
    };
    // The marks are themselves a change to the sheet, and are not a reason to measure it again.
    const watching = new MutationObserver((changes) => {
      if (changes.some((change) => change.attributeName !== MARK)) {
        measure();
      }
    });
    watching.observe(root, { subtree: true, childList: true, attributes: true });
    measure();
    return () => {
      gone = true;
      clearTimeout(waiting);
      watching.disconnect();
      markUnreadable(root, []);
    };
  }, [sheet, on, looks]);
  return found;
}

/**
 * What the measuring found, beside the switch: every word readable, or how many are not, and pressed, the
 * next of them brought into view with what it measures and what it needs.
 */
export function ContrastSummary({ found }: { found: readonly Unreadable[] | null }) {
  const [at, setAt] = useState(-1);
  if (found === null) {
    return <span className="showcase__contrast">measuring…</span>;
  }
  if (found.length === 0) {
    return <span className="showcase__contrast showcase__contrast--fine">every word readable</span>;
  }
  const shown = found[at];
  return (
    <button
      type="button"
      className="showcase__contrast showcase__contrast--faint"
      onClick={() => {
        const next = (at + 1) % found.length;
        setAt(next);
        found[next]!.element.scrollIntoView({ block: 'center' });
      }}
    >
      {found.length} too faint
      {shown === undefined
        ? ': press for each'
        : ` · ${at + 1}: ${shown.contrast.toFixed(1)} to 1, needs ${shown.needed} · “${shown.words}”`}
    </button>
  );
}
