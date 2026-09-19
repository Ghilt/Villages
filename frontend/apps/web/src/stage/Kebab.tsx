import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Arrows } from './Arrows';
import { baysNow, put, type Which, watchBays } from './bays';
import { panesNow } from './panes';

/**
 * The kebab at the divider: what else there is, and where to put it.
 *
 * It sits on the seam between the two bays because that is what it is about. Every pane is listed, whether
 * or not it is already up, and each carries **the arrows** saying which bay it would go into - so the
 * player never has to open a thing and then move it.
 *
 * Only in the bays. The spread shows everything at once, so there is nothing to choose between and no
 * kebab; that difference is the whole of what the two forms are. See decision record 0040.
 */

interface KebabProps {
  along: 'rows' | 'columns';
}

export function Kebab({ along }: KebabProps) {
  const bays = useSyncExternalStore(watchBays, baysNow);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // A menu that stays up after you have clicked past it is a menu in the way. Escape closes it too, because
  // on a phone there is nowhere to click past to.
  useEffect(() => {
    if (!open) {
      return;
    }
    const elsewhere = (event: PointerEvent) => {
      if (box.current !== null && !box.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', elsewhere);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', elsewhere);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const pick = (which: Which, id: string) => {
    put(which, id);
    setOpen(false);
  };

  return (
    <div className={`kebab kebab--${along}`} ref={box}>
      <button
        type="button"
        className="kebab__open"
        aria-expanded={open}
        aria-label="what else there is"
        title="what else there is"
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
          <circle cx="12" cy="5.5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="18.5" r="1.7" />
        </svg>
      </button>

      {open && (
        <ul className="kebab__list">
          {panesNow().map((pane) => {
            const at = bays.holding.indexOf(pane.id);
            return (
              <li className="kebab__row" key={pane.id}>
                <span className="kebab__what">{pane.title}</span>
                <Arrows
                  along={along}
                  here={at === -1 ? null : (at as Which)}
                  what={pane.title}
                  onPick={(which) => pick(which, pane.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
