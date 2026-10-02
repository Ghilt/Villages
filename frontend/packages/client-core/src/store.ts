/**
 * A value, what changes it, and who is told when it does: the shape every piece of state a page watches takes.
 * One object a change, so that whatever reads it - React's `useSyncExternalStore` above all - can tell whether
 * anything happened by asking whether it is the same object as before.
 */
export interface Store<S extends object> {
  get(): S;
  /** Changes some of it, and tells everyone watching. */
  set(change: Partial<S>): void;
  /** Hears of every change until the returned function is called. */
  watch(listener: () => void): () => void;
}

/**
 * All a reader of a store is handed: the value, and being told when it changes, and no way to change it. Whatever
 * owns a store keeps it, and hands out this; what changes it is the owner's own functions, which say why.
 */
export type Readable<S extends object> = Pick<Store<S>, 'get' | 'watch'>;

export function createStore<S extends object>(initial: S): Store<S> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (change) => {
      value = { ...value, ...change };
      for (const listener of listeners) listener();
    },
    watch: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
