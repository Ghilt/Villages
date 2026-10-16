import { useEffect, useState } from 'react';

/** What the dev server says when a catalogue changes on disk: `CATALOGUE_CHANGED` in `vite/catalogueApi.ts`. */
const CATALOGUE_CHANGED = 'villages:catalogue-changed';

/** A catalogue as the game reads it: once a page load and shared, and again whenever it changes on disk. */
export interface Shelved<T> {
  /** The catalogue, or null when it cannot be read, which its next change or a reload tries again. */
  read(): Promise<T | null>;
  /** The catalogue for a component: null until it has been read, and while it cannot be. */
  use(): T | null;
}

/**
 * A catalogue file of `world/catalogues/`, as the dev server serves it at `/catalogues/<file>`, read by [parse]: once a
 * page load whoever asks first, and again when it changes on disk, as the game server takes it on, so what the page
 * shows of it follows a retune. See decision record 0097.
 */
export function shelved<T>(file: string, parse: (text: string) => T): Shelved<T> {
  let reading: Promise<T | null> | null = null;
  const holders = new Set<() => void>();

  const read = () => {
    reading ??= fetch(`/catalogues/${file}`, { cache: 'no-store' })
      .then((response) =>
        response.ok ? response.text() : Promise.reject(new Error(String(response.status))),
      )
      .then(parse)
      .catch(() => null);
    return reading;
  };

  const changed = (data: { file: string }) => {
    if (data.file !== file) return;
    reading = null;
    holders.forEach((tell) => tell());
  };
  import.meta.hot?.on(CATALOGUE_CHANGED, changed);

  const use = () => {
    const [held, setHeld] = useState<T | null>(null);
    useEffect(() => {
      let live = true;
      const again = () => void read().then((read) => live && setHeld(read));
      again();
      holders.add(again);
      return () => {
        live = false;
        holders.delete(again);
      };
    }, []);
    return held;
  };

  return { read, use };
}
