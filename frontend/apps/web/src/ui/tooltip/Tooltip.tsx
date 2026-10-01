import './tooltip.css';

import { cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';

import { Container } from '../container/Container';
import { placeTooltip } from './place';
import type { Side } from './place';

/**
 * A few words about what is under the pointer, in a small container of its own over everything else.
 *
 * It opens a moment after the pointer arrives, at once when the keyboard does, and on a phone when a
 * finger holds the thing down; it goes when they leave, or at Escape. It is drawn in a layer of its own
 * over the page rather than inside what it is about, so a pane that clips its content cannot clip it, and
 * it follows what it is about when the page scrolls. See docs/UI-COMPONENTS.md.
 */

/** How long the pointer rests on a thing before its tooltip opens, so passing over a row opens nothing. */
const HOVER_WAIT_MS = 350;
/** How long a finger holds a thing down before its tooltip opens, and how long it stays after. */
const TOUCH_HOLD_MS = 450;
const TOUCH_LINGER_MS = 1400;

export function Tooltip({
  text,
  children,
  prefer = 'above',
  showing = false,
  describes = true,
}: {
  text: ReactNode;
  children: ReactNode;
  /** Which side it goes when there is room on both. */
  prefer?: Side;
  /** Open whatever the pointer is doing: for the page, never for the game. */
  showing?: boolean;
  /**
   * Whether what it is about is described by it for a screen reader. Not when the words are already its
   * name, as a mark button's are, or they would be read twice.
   */
  describes?: boolean;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const opened = useRef(open);
  opened.current = open;
  const id = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const after = (ms: number, then: () => void) => {
    cancel();
    timer.current = setTimeout(then, ms);
  };

  useEffect(() => cancel, []);
  useEffect(() => {
    if (!open) {
      return;
    }
    const shut = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', shut);
    return () => window.removeEventListener('keydown', shut);
  }, [open]);

  const shown = open || showing;
  const child =
    describes && isValidElement(children)
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          'aria-describedby': shown ? id : undefined,
        })
      : children;

  return (
    <span
      ref={anchor}
      className="ui-tooltip-anchor"
      onPointerEnter={(event) => event.pointerType === 'mouse' && after(HOVER_WAIT_MS, () => setOpen(true))}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') {
          cancel();
          setOpen(false);
        }
      }}
      onPointerDown={(event) => event.pointerType !== 'mouse' && after(TOUCH_HOLD_MS, () => setOpen(true))}
      onPointerUp={(event) => {
        if (event.pointerType !== 'mouse') {
          cancel();
          if (opened.current) {
            after(TOUCH_LINGER_MS, () => setOpen(false));
          }
        }
      }}
      onFocus={(event) => {
        if ((event.target as Element).matches(':focus-visible')) {
          cancel();
          setOpen(true);
        }
      }}
      onBlur={() => {
        cancel();
        setOpen(false);
      }}
    >
      {child}
      {shown &&
        createPortal(<TooltipBox id={id} anchor={anchor} prefer={prefer} text={text} />, document.body)}
    </span>
  );
}

function TooltipBox({
  id,
  anchor,
  prefer,
  text,
}: {
  id: string;
  anchor: RefObject<HTMLSpanElement | null>;
  prefer: Side;
  text: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<ReturnType<typeof placeTooltip> | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const about = anchor.current?.getBoundingClientRect();
      const self = box.current?.getBoundingClientRect();
      if (about === undefined || self === undefined) {
        return;
      }
      const next = placeTooltip(
        about,
        self,
        { width: window.innerWidth, height: window.innerHeight },
        prefer,
      );
      setPlace((was) =>
        was !== null && was.left === next.left && was.top === next.top && was.side === next.side ? was : next,
      );
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [anchor, prefer]);

  return (
    <div
      ref={box}
      id={id}
      role="tooltip"
      className="ui-tooltip ui-root"
      data-side={place?.side}
      style={
        place === null ? { visibility: 'hidden', left: 0, top: 0 } : { left: place.left, top: place.top }
      }
    >
      <Container recipe="tooltip.plain">
        <span className="ui-tooltip__text">{text}</span>
      </Container>
    </div>
  );
}
