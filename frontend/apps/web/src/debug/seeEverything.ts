import { note } from './log';
import { seeAll } from '../net/gateway';

/**
 * Whether this window is shown every house in the cells it holds, or only the ones significant enough
 * for the zoom it is looking at.
 *
 * Adam's switch, not a player's, which is why it lives in the debug panel: a house is founded at
 * significance 20, so nothing reaches a connection holding cells shallower than zoom 8, and pulling back
 * past about z7.5 empties the map because the gateway stopped sending rather than because anything is
 * being hidden. With this on, `seeAll` sets significance aside for this connection and the renderer's own
 * floor comes off with it. It is how a world with players in it can be looked at all at once.
 *
 * The player's eye is a different thing and stays a different thing: it keeps the player's own holdings
 * drawn, and nobody else's. See decision record 0038.
 */

let everything = false;
const listeners = new Set<() => void>();

export function seeingEverything(): boolean {
  return everything;
}

export function watchSeeingEverything(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function seeEverything(on: boolean): void {
  if (on === everything) {
    return;
  }
  everything = on;
  note('world', on ? 'showing everything in the held cells, at any zoom' : 'showing what the zoom is worth');
  seeAll(on);
  for (const listener of listeners) {
    listener();
  }
}
