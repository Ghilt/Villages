import { useEffect, useState } from 'react';

/** What the dev server says when a catalogue changes on disk: `CATALOGUE_CHANGED` in `vite/catalogueApi.ts`. */
const CATALOGUE_CHANGED = 'villages:catalogue-changed';

/**
 * The files of a folder on the shelf by their names, `letter` for `world/catalogues/dialogues/letter.json`, as the dev
 * server lists them, and listed again as they come and go: what the panel's levers offer by name. See 0097.
 */
export function useShelfNames(folder: string): readonly string[] {
  const [names, setNames] = useState<readonly string[]>([]);
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
        .catch(() => undefined);
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
