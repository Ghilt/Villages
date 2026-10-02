import './toast.css';

import { useEffect, useMemo, useRef, useState } from 'react';

import { MarkButton } from '../button/Button';
import { Container } from '../container/Container';
import { Mark } from '../mark/Mark';
import type { MarkName } from '../mark/Mark';
import { lifeOf, stayOf } from './life';

/** Something that happened, said in a few words. */
export interface Toast {
  /** Its own, for as long as it is shown. */
  readonly id: string;
  /** What happened: Sister Agathe joined the house. */
  readonly title: string;
  /** A line more about it. */
  readonly text?: string;
  readonly mark?: MarkName;
  /** It stays until it is put away, rather than going when it has been read. */
  readonly stays?: boolean;
}

/** How long a toast takes to go once its time is up, which its leaving is drawn in. */
const LEAVING_MS = 200;

/**
 * Toasts: things that happened, said in a corner and gone when they have been read - longer for more
 * words, and never while the pointer or the keyboard is on one - or when their close mark is pressed. The
 * newest is nearest the corner. A screen reader is told each as it comes, without being taken from what it
 * was reading.
 *
 * Whoever uses it holds the `items` and takes one away at `onGone`; the game's event log keeps what they
 * said, because a toast is gone for good. `corner` lays them in the bottom right corner of whatever
 * positioned box holds them, the stage; `flow` lays them where they are, for a page. See
 * docs/UI-COMPONENTS.md.
 */
export function Toasts({
  items,
  onGone,
  label = 'What happened',
  place = 'corner',
}: {
  items: readonly Toast[];
  onGone: (id: string) => void;
  label?: string;
  place?: 'corner' | 'flow';
}) {
  return (
    <div className={`ui-toasts ui-toasts--${place}`} role="log" aria-live="polite" aria-label={label}>
      <ol className="ui-toasts__list">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onGone={onGone} />
        ))}
      </ol>
    </div>
  );
}

function ToastCard({ item, onGone }: { item: Toast; onGone: (id: string) => void }) {
  const [leaving, setLeaving] = useState(false);
  const letters = item.title.length + (item.text?.length ?? 0);
  const life = useMemo(
    () =>
      lifeOf(stayOf(letters), () => setLeaving(true), {
        set: (then, ms) => setTimeout(then, ms),
        clear: (handle) => clearTimeout(handle as number),
        now: () => performance.now(),
      }),
    [letters],
  );
  // Its time stops while the pointer is on it or the keyboard is in it, and runs only when neither is.
  const held = useRef({ pointer: false, keyboard: false });
  const hold = (by: 'pointer' | 'keyboard', on: boolean) => {
    held.current[by] = on;
    if (held.current.pointer || held.current.keyboard) {
      life.stop();
    } else if (item.stays !== true) {
      life.run();
    }
  };

  useEffect(() => {
    if (item.stays !== true) {
      life.run();
    }
    return () => life.stop();
  }, [life, item.stays]);
  useEffect(() => {
    if (!leaving) {
      return;
    }
    const gone = setTimeout(() => onGone(item.id), LEAVING_MS);
    return () => clearTimeout(gone);
  }, [leaving, onGone, item.id]);

  return (
    <li
      className="ui-toasts__item"
      {...(leaving ? { 'data-leaving': true } : {})}
      onPointerEnter={() => hold('pointer', true)}
      onPointerLeave={() => hold('pointer', false)}
      onFocus={() => hold('keyboard', true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          hold('keyboard', false);
        }
      }}
    >
      <Container recipe="toast.plain" className="ui-toast">
        <div className="ui-toast__row">
          {item.mark !== undefined && (
            <span className="ui-toast__mark">
              <Mark name={item.mark} size={20} />
            </span>
          )}
          <div className="ui-toast__words">
            <p className="ui-toast__title">{item.title}</p>
            {item.text !== undefined && <p className="ui-label ui-toast__text">{item.text}</p>}
          </div>
          <MarkButton label="Put it away" face="close" size="small" onClick={() => setLeaving(true)} />
        </div>
      </Container>
    </li>
  );
}
