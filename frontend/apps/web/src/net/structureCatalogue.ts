import { useEffect, useState } from 'react';

import { parseStructureCatalogue } from '@villages/world';
import type { StructureCatalogue } from '@villages/world';

/** What the dev server says when a catalogue changes on disk: `CATALOGUE_CHANGED` in `vite/catalogueApi.ts`. */
const CATALOGUE_CHANGED = 'villages:catalogue-changed';

/** The catalogue being read, once a page load and again when it changes, by whatever asks first. */
let reading: Promise<StructureCatalogue | null> | null = null;

/** Whatever holds the catalogue, told when it has changed on disk. */
const holders = new Set<() => void>();

/**
 * The catalogue of structures as the dev server serves it, `world/catalogues/structures.json`: read once a page load
 * and shared, and read again when it changes on disk, as the game server takes it on; null when it cannot be read,
 * which a reload tries again. What the map sizes a structure by. See docs/plans/structures.md and decision record
 * 0097.
 */
export function readStructureCatalogue(): Promise<StructureCatalogue | null> {
  reading ??= fetch('/catalogues/structures.json', { cache: 'no-store' })
    .then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
    .then(parseStructureCatalogue)
    .catch(() => null);
  return reading;
}

const changed = (data: { file: string }) => {
  if (data.file !== 'structures.json') return;
  reading = null;
  holders.forEach((tell) => tell());
};
import.meta.hot?.on(CATALOGUE_CHANGED, changed);
import.meta.hot?.dispose(() => import.meta.hot?.off(CATALOGUE_CHANGED, changed));

/** The catalogue, or null until it has been read, and for good when it cannot be. */
export function useStructureCatalogue(): StructureCatalogue | null {
  const [catalogue, setCatalogue] = useState<StructureCatalogue | null>(null);
  useEffect(() => {
    let live = true;
    const read = () => void readStructureCatalogue().then((read) => live && setCatalogue(read));
    read();
    holders.add(read);
    return () => {
      live = false;
      holders.delete(read);
    };
  }, []);
  return catalogue;
}
