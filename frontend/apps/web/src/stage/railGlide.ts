import type { RefObject } from 'react';
import { useLayoutEffect, useRef } from 'react';

/**
 * The windows on the rail glide, as the tiles do: one opened or put away grows or shrinks to its new height, one
 * arriving grows in from nothing, and the rest slide to where that leaves them - a window brought to the top
 * included. Adam's word of 2026-10-06; see decision record 0086.
 *
 * A tile is a rectangle the stage writes, so a transition moves it. A window on the rail is not: it is a flow item
 * as tall as what it says, so nothing about its style changes when it opens. It is measured instead, after every
 * layout, and each one that moved is animated from where it was to where it is: its height, and a shift that
 * makes up the difference between where the flow puts it at the start and where it actually stood. Both run on
 * one curve, so between them every window travels straight from its old place to its new one.
 */

/** Where a window stands on the rail: its top and its height, in pixels from the rail's own top. */
export interface Placed {
  id: string;
  top: number;
  h: number;
}

/** How one window glides: its height from and to, and how far it starts shifted from where the flow puts it. */
export interface Glide {
  id: string;
  fromH: number;
  toH: number;
  shift: number;
  /** Whether it was not on the rail before, and fades in as it grows. */
  arriving: boolean;
}

/**
 * How each window glides, given where they stood and where they stand now, top first, and the air between them.
 *
 * At the start every window is at the height it had - nothing, if it is arriving - so the flow puts each one where
 * the heights above it add up to. The shift is what it takes from there to where it stood; it runs to nought as the
 * heights run to their new ones. A window gone leaves nothing to animate: the rest slide up into its room.
 */
export function glidesOnTheRail(before: readonly Placed[], after: readonly Placed[], gap: number): Glide[] {
  const was = new Map(before.map((one) => [one.id, one]));
  const glides: Glide[] = [];
  let flow = after[0]?.top ?? 0;
  for (const now of after) {
    const old = was.get(now.id);
    const fromH = old?.h ?? 0;
    const shift = old === undefined ? 0 : old.top - flow;
    if (fromH !== now.h || shift !== 0) {
      glides.push({ id: now.id, fromH, toH: now.h, shift, arriving: old === undefined });
    }
    flow += fromH + gap;
  }
  return glides;
}

/** A CSS time as milliseconds: `160ms`, `0.16s`, or nought for anything else. */
export function msOf(time: string): number {
  const value = Number.parseFloat(time);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return time.trim().endsWith('ms') ? value : time.trim().endsWith('s') ? value * 1000 : 0;
}

/**
 * Glide the windows on the rail after every layout that changed what is on it, but never the first, and never while
 * the stage itself is being resized or is not the spread: `on` is the stage saying so. `stacked` names what is on
 * it - each window and the size it was asked for - so that a render that changed neither leaves a glide running
 * rather than cutting it short. How long, and on what curve, are the stage's own `--glide` and `--glide-ease`, so
 * one number is the whole of the motion, and nought for a player who asked for less.
 */
export function useGlideOnTheRail(
  rail: RefObject<HTMLDivElement | null>,
  on: boolean,
  stacked: string,
): void {
  const last = useRef<{ stacked: string; placed: readonly Placed[] } | null>(null);
  useLayoutEffect(() => {
    const held = rail.current;
    if (held === null) {
      last.current = null;
      return;
    }
    const windows = [...held.children] as HTMLElement[];
    const gliding = windows.some((one) => one.getAnimations().length > 0);
    if (last.current?.stacked === stacked && gliding) {
      return;
    }
    // A glide still running is ended first, so that what is measured is where each window is going to be.
    for (const one of windows) {
      for (const running of one.getAnimations()) running.cancel();
    }
    const now = windows.map((one) => ({
      id: one.dataset.pane ?? '',
      top: one.offsetTop,
      h: one.offsetHeight,
    }));
    const before = last.current;
    last.current = { stacked, placed: now };

    const style = getComputedStyle(held);
    const duration = msOf(style.getPropertyValue('--glide'));
    if (before === null || before.stacked === stacked || !on || duration === 0) {
      return;
    }
    const easing = style.getPropertyValue('--glide-ease').trim() || 'ease-out';
    const gap = Number.parseFloat(style.rowGap) || 0;
    for (const glide of glidesOnTheRail(before.placed, now, gap)) {
      const one = windows.find((window) => window.dataset.pane === glide.id);
      if (one === undefined) {
        continue;
      }
      // Gliding, its box is shorter than what it says, and what scrolls in it would show a scrollbar for the
      // length of the glide: `rail.css` hides them until it has landed.
      one.dataset.gliding = 'yes';
      const landed = () => {
        if (one.getAnimations().length === 0) delete one.dataset.gliding;
      };
      const animation = one.animate(
        [
          {
            height: `${glide.fromH}px`,
            transform: `translateY(${glide.shift}px)`,
            opacity: glide.arriving ? 0 : 1,
          },
          { height: `${glide.toH}px`, transform: 'none', opacity: 1 },
        ],
        { duration, easing },
      );
      animation.onfinish = landed;
      animation.oncancel = landed;
    }
  });
}
