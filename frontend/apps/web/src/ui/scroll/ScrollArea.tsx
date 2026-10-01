import './scroll.css';

import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { edgesOf, moreOf } from './scroll';

/**
 * A scroll area: a box whose content scrolls inside it, down or across, and says so by fading at the edge
 * there is more beyond, so a list that goes on is seen to go on without a scrollbar to read.
 *
 * Its bar is a thin gilt one where the screen draws bars at all. Scrolling it never scrolls what is under
 * it, so a list in a pane does not drag the map behind it. When there is more than fits, the keyboard can
 * stop on it to scroll it, unless everything in it can be stopped on already. See docs/UI-COMPONENTS.md.
 */
export function ScrollArea({
  children,
  axis = 'down',
  label,
  focusable = true,
  className,
  style,
}: {
  children: ReactNode;
  /** Which way it scrolls: down, a list; across, a row. */
  axis?: 'down' | 'across';
  /** What is in it, for a screen reader, which says it when the keyboard stops on it. */
  label?: string;
  /** Whether the keyboard stops on it to scroll it: not when everything in it is a stop of its own. */
  focusable?: boolean;
  className?: string;
  /** Its size: a `maxHeight` for one that scrolls down, or the width it is held to for one across. */
  style?: CSSProperties;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState('');
  const [bar, setBar] = useState(0);

  useLayoutEffect(() => {
    const scroller = box.current;
    if (scroller === null) {
      return;
    }
    const measure = () => {
      const down = axis === 'down';
      const edges = down
        ? edgesOf(scroller.scrollTop, scroller.clientHeight, scroller.scrollHeight)
        : edgesOf(Math.abs(scroller.scrollLeft), scroller.clientWidth, scroller.scrollWidth);
      setMore(moreOf(edges));
      // The bar's own room, which the fade is kept off so that the bar stays whole at the ends.
      setBar(
        down ? scroller.offsetWidth - scroller.clientWidth : scroller.offsetHeight - scroller.clientHeight,
      );
    };
    measure();
    scroller.addEventListener('scroll', measure, { passive: true });
    const watch = new ResizeObserver(measure);
    watch.observe(scroller);
    if (scroller.firstElementChild !== null) {
      watch.observe(scroller.firstElementChild);
    }
    return () => {
      scroller.removeEventListener('scroll', measure);
      watch.disconnect();
    };
  }, [axis]);

  const stops = focusable && more !== '';
  return (
    <div
      ref={box}
      className={`ui-scroll ui-scroll--${axis}${className === undefined ? '' : ` ${className}`}`}
      data-more={more}
      style={{ '--ui-scroll-bar': `${bar}px`, ...style } as CSSProperties}
      {...(stops ? { tabIndex: 0, role: 'region', 'aria-label': label } : {})}
    >
      <div className="ui-scroll__content">{children}</div>
    </div>
  );
}
