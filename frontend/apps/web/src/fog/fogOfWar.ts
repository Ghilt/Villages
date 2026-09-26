import { note } from '../debug/log';

/**
 * Whether this window draws the fog of war: Adam's switch, in the Debug map section.
 *
 * On at every page load, because the fog is the game and a switch that stayed off across a reload is how
 * a window comes to look fogless and nobody remembers why. Off, nothing is drawn over the map. Once the
 * gateway holds back what a house cannot see, off will lift that for this window too, as `see everything`
 * sets significance aside; it is a way of looking, so it is neither stored nor recorded. See decision
 * record 0061.
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
      ? 'the fog of war is drawn over what your house cannot see'
      : 'the fog of war is lifted in this window: nothing is drawn over the map',
  );
  for (const listener of listeners) {
    listener();
  }
}
