import { note } from '../debug/log';

/**
 * What is selected on the map.
 *
 * A module with a listener set rather than a context, the same shape as the debug log, the gateway and
 * the areas, because that is what `useSyncExternalStore` wants and it keeps the state out of the tree.
 *
 * Only a house so far. It is a tagged shape rather than a bare id because the next thing that can be
 * selected will not be one: an area already has a selection of its own, and joining the two is a change
 * to this file and nothing else.
 */

export type Selected = { kind: 'house'; id: string } | null;

let selected: Selected = null;
const listeners = new Set<() => void>();

export function selectionNow(): Selected {
  return selected;
}

export function watchSelection(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function select(next: Selected): void {
  if (selected?.id === next?.id && selected?.kind === next?.kind) {
    return;
  }
  selected = next;
  note('selected', next === null ? 'nothing' : `${next.kind} ${next.id.slice(0, 8)}`);
  for (const listener of listeners) {
    listener();
  }
}
