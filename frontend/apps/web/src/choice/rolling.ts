/**
 * Whether this page pressed Take action and is waiting on the hand it rolled: the hand that answers it is played,
 * the report card filling and the stamp landing, and any other - one already pending at a reload, one the world
 * gave - is drawn as it ends. A module of its own because the button that sets it is gone by the time the hand
 * arrives. See decision record 0083.
 */
let awaiting = false;

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
