import { note } from '../debug/log';

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
 * A module with a listener set rather than a context, the same shape as the selection, the debug log and
 * the gateway, because that is what `useSyncExternalStore` wants and it keeps the state out of the tree.
 */

let open = false;
const listeners = new Set<() => void>();

export function eyeIsOpen(): boolean {
  return open;
}

export function watchEye(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openEye(next: boolean): void {
  if (next === open) {
    return;
  }
  open = next;
  note('eye', next ? 'your holdings stay drawn at any zoom' : 'your holdings thin out with the rest');
  for (const listener of listeners) {
    listener();
  }
}

export function toggleEye(): void {
  openEye(!open);
}
