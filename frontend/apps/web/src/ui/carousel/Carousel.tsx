import './carousel.css';

import { Children, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';

import { MarkButton } from '../button/Button';
import { Dots } from '../dots/Dots';
import { keyStepOf, stepOf, swipeOf } from './step';

/**
 * A carousel: one thing at a time, with a step either side and a dot for each thing beneath - the small
 * form of a pane whose whole form is a list, so the list can be glanced through in a strip of screen
 * while the map stays up beside it (LOOK-AND-FEEL.md). The steps are the moodboard's round arrows.
 *
 * Stepped by the arrows either side, the dots, the arrow keys and Home and End while it is the keyboard's,
 * and a swipe of a finger; round from the last to the first unless it is told not to wrap, when the step
 * that would go past an end is disabled there. The thing that comes in slides in from the side it came
 * from, and a screen reader is told which of how many it is. Every thing is laid in the same place and
 * only the one shown is seen, so the carousel is as tall as the tallest of them and its steps and dots
 * never jump as it goes. Held by whoever uses it with `at`, or by itself from `startAt`. See
 * docs/UI-COMPONENTS.md.
 */
export function Carousel({
  children,
  label,
  at,
  onAt,
  startAt = 0,
  wrap = true,
}: {
  /** The things, one shown at a time. */
  children: ReactNode;
  /** What they are, for a screen reader: "The options". */
  label: string;
  /** Which is shown, from nought, when whoever uses it holds that. */
  at?: number;
  onAt?: (at: number) => void;
  startAt?: number;
  /** Round from the last to the first and back; true unless it says otherwise. */
  wrap?: boolean;
}) {
  const things = Children.toArray(children);
  const count = things.length;
  const [own, setOwn] = useState(startAt);
  const shown = Math.min(Math.max(at ?? own, 0), Math.max(count - 1, 0));
  // Which side the one shown came in from, so it slides in from there; nothing at first.
  const [from, setFrom] = useState<'before' | 'after' | null>(null);
  const pressedAt = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  /** Shows another, coming in from `side`: a step round from the last comes in after it, as a step does. */
  const show = (to: number, side: 'before' | 'after') => {
    if (to === shown) {
      return;
    }
    setFrom(side);
    if (at === undefined) {
      setOwn(to);
    }
    onAt?.(to);
  };
  const go = (to: number) => show(to, to > shown ? 'after' : 'before');
  const step = (by: -1 | 1) => show(stepOf(shown, by, count, wrap), by > 0 ? 'after' : 'before');

  // The keys are the carousel's while the keyboard is on its steps or its dots, not on what it shows.
  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.target as Element).closest('.ui-carousel__slide') !== null) {
      return;
    }
    const to = keyStepOf(event.key, shown, count, wrap);
    if (to !== null) {
      event.preventDefault();
      show(to, event.key === 'ArrowLeft' || (event.key === 'Home' && to < shown) ? 'before' : 'after');
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pressedAt.current = event.isPrimary ? { x: event.clientX, y: event.clientY } : null;
    // A finger's swipe is often followed by no click at all, so a swipe is forgotten when the next begins.
    swiped.current = false;
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = pressedAt.current;
    pressedAt.current = null;
    if (start === null || count < 2) {
      return;
    }
    const by = swipeOf(event.clientX - start.x, event.clientY - start.y, event.currentTarget.clientWidth);
    if (by !== 0) {
      swiped.current = true;
      step(by);
    }
  };

  const atFirst = !wrap && shown === 0;
  const atLast = !wrap && shown === count - 1;
  return (
    <section className="ui-carousel" aria-roledescription="carousel" aria-label={label} onKeyDown={onKeyDown}>
      <div className="ui-carousel__row">
        <MarkButton
          face="previous"
          label="The one before"
          onClick={() => step(-1)}
          disabled={count < 2 || atFirst}
        />
        <div
          className="ui-carousel__view"
          aria-live="polite"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (pressedAt.current = null)}
          onClickCapture={(event) => {
            // A swipe that ends on something pressable is a swipe, not a press of it.
            if (swiped.current) {
              swiped.current = false;
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          {things.map((thing, one) => (
            <div
              key={one}
              className="ui-carousel__slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${one + 1} of ${count}`}
              {...(one !== shown
                ? { 'data-away': true, 'aria-hidden': true, inert: true }
                : from === null
                  ? {}
                  : { 'data-from': from })}
            >
              {thing}
            </div>
          ))}
        </div>
        <MarkButton
          face="next"
          label="The one after"
          onClick={() => step(1)}
          disabled={count < 2 || atLast}
        />
      </div>
      {count > 1 && <Dots count={count} at={shown} onAt={go} label="Which one" />}
    </section>
  );
}
