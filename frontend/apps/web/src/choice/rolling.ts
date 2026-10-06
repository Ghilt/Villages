import type { Along } from '../stage/panes';

/**
 * Whether this page pressed Take action and is waiting on the hand it rolled: the hand that answers it is played,
 * the report card filling and the stamp landing, and any other - one already pending at a reload, one the world
 * gave - is drawn as it ends. A module of its own because the button that sets it is gone by the time the hand
 * arrives. See decision record 0083.
 */
let awaiting = false;

/**
 * What a press on the pane put away to its strip does: opens it out, wherever on the strip it lands, unless it
 * lands on a button of its own - Take action, the size control - which does what it says. Adam's word, 2026-10-06.
 */
export function openingOut(open: () => void): (event: { target: EventTarget | null }) => void {
  return (event) => {
    if (!(event.target instanceof Element && event.target.closest('button') !== null)) open();
  };
}

/** Take action was pressed: the next rolled hand to arrive is this page's to play. */
export function expectHand(): void {
  awaiting = true;
}

/** Whether a hand arriving now was asked for here, which answers it: only the first hand after a press plays. */
export function handExpected(): boolean {
  const was = awaiting;
  awaiting = false;
  return was;
}

/**
 * The class the letter takes opened out on a desktop, lying over everything: what it says fades in once its box
 * has grown there, the cards' details a beat after their titles. See `choice.css` and decision record 0086.
 */
export function overOf(along: Along): string {
  return along === null ? ' choice--over' : '';
}
