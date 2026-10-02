import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../log/log';

/**
 * The eye: whether the player's own holdings stay drawn wherever the camera goes.
 *
 * Yours and nobody else's. The world thins out as you pull back, because significance decides how far
 * out a thing stays drawn and most things are not worth a continent; what the eye says is that your own
 * seat and the ground about it are the exception, so that leaving them is a decision and not an
 * accident. Everybody else's houses come and go with the zoom as they always did.
 *
 * It costs nothing on the wire. Your own house already reaches you wherever you are looking - the
 * gateway sends `yourHouse` to your session rather than to a cell - so this is a page deciding to draw
 * what it already knows. Adam's `see everything` in the debug panel is the other switch and a different
 * one: every house, from the gateway. See decision record 0038.
 *
 * A store, the one shape every piece of state the page watches takes, read in a component through `useStore`.
 */

const eye = createStore({ open: false });

export const eyeStore: Readable<{ open: boolean }> = eye;

export function openEye(next: boolean): void {
  if (next === eye.get().open) {
    return;
  }
  note('eye', next ? 'your holdings stay drawn at any zoom' : 'your holdings thin out with the rest');
  eye.set({ open: next });
}

export function toggleEye(): void {
  openEye(!eye.get().open);
}
