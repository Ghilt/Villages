import { note } from '../debug/log';
import { fogOfWar } from '../net/gateway';

/**
 * Whether this window draws the fog of war: Adam's switch, in the Debug map section.
 *
 * On at every page load, because the fog is the game and a switch that stayed off across a reload is how
 * a window comes to look fogless and nobody remembers why. Off lifts the whole of it for this window: nothing
 * is drawn over the map, and the gateway sends what the house cannot see as well as what it can, as `see
 * everything` sets significance aside. It is a way of looking, so it is neither stored nor recorded. See
 * decision record 0061.
 *
 * A module with a listener set rather than a context, the shape of the eye and of `see everything`.
 */

let on = true;
const listeners = new Set<() => void>();

export function fogIsOn(): boolean {
  return on;
}

export function watchFog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setFogOfWar(next: boolean): void {
  if (next === on) {
    return;
  }
  on = next;
  note(
    'fog',
    next
      ? 'the fog of war is drawn over what your house cannot see, and the gateway holds that back'
      : 'the fog of war is lifted in this window: nothing is drawn over the map, and the gateway sends everything',
  );
  fogOfWar(next);
  for (const listener of listeners) {
    listener();
  }
}
