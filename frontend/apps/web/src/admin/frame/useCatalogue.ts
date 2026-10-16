import { useEffect, useState } from 'react';

/** What the dev server says when a catalogue changes on disk: `CATALOGUE_CHANGED` in `vite/catalogueApi.ts`. */
const CATALOGUE_CHANGED = 'villages:catalogue-changed';

/** A catalogue as an inspect page holds it: what it says, its text, and the fingerprint a save is based on. */
export interface Shelved<T> {
  readonly value: T;
  readonly text: string;
  readonly fingerprint: string;
}

/** Where reading one has got to. */
export type Reading<T> =
  | { readonly state: 'reading' }
  | { readonly state: 'read'; readonly shelved: Shelved<T> }
  | { readonly state: 'unread'; readonly problem: string };

/**
 * A catalogue file from `world/catalogues/`, read through the dev server and read again whenever it changes on disk -
 * saved by hand, or by the game server for this page or another - so a page shows what the file says now. `file` is
 * its path on the shelf, `structures.json` or `dialogues/letter.json`; `parse` is the world package's reader for it,
 * which says what it cannot read rather than guessing. See decision record 0097.
 */
export function useCatalogue<T>(file: string, parse: (text: string) => T): Reading<T> {
  const [reading, setReading] = useState<Reading<T>>({ state: 'reading' });

  useEffect(() => {
    let live = true;
    const read = () =>
      fetch(`/catalogues/${file}`, { cache: 'no-store' })
        .then(async (response) => {
          const text = await response.text();
          if (!response.ok) throw new Error(text || response.statusText);
          const fingerprint = response.headers.get('X-Catalogue-Fingerprint') ?? '';
          return { value: parse(text), text, fingerprint };
        })
        .then((shelved) => live && setReading({ state: 'read', shelved }))
        .catch(
          (unread: unknown) =>
            live &&
            setReading({
              state: 'unread',
              problem: unread instanceof Error ? unread.message : String(unread),
            }),
        );
    const changed = (data: { file: string }) => {
      if (data.file === file) void read();
    };
    void read();
    import.meta.hot?.on(CATALOGUE_CHANGED, changed);
    return () => {
      live = false;
      import.meta.hot?.off(CATALOGUE_CHANGED, changed);
    };
  }, [file, parse]);

  return reading;
}

/**
 * The files of a catalogue that is a folder, `dialogues`, by their names in it - `letter` for `dialogues/letter.json` -
 * listed by the dev server, and listed again when one changes on disk; null until they have been. See 0097.
 */
export function useCatalogueFiles(folder: string): readonly string[] | null {
  const [names, setNames] = useState<readonly string[] | null>(null);
  useEffect(() => {
    let live = true;
    const list = () =>
      fetch('/catalogues/', { cache: 'no-store' })
        .then((response) => response.json() as Promise<{ files: string[] }>)
        .then(({ files }) =>
          files
            .filter((file) => file.startsWith(`${folder}/`))
            .map((file) => file.slice(folder.length + 1).replace(/\.json$/, '')),
        )
        .then((found) => live && setNames(found))
        .catch(() => live && setNames([]));
    const changed = (data: { file: string }) => {
      if (data.file.startsWith(`${folder}/`)) void list();
    };
    void list();
    import.meta.hot?.on(CATALOGUE_CHANGED, changed);
    return () => {
      live = false;
      import.meta.hot?.off(CATALOGUE_CHANGED, changed);
    };
  }, [folder]);
  return names;
}
