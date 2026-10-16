import { useEffect, useState } from 'react';

import { parseStructureCatalogue } from '@villages/world';
import type { StructureCatalogue } from '@villages/world';

/** The catalogue being read, once a page load, by whatever asks first. */
let reading: Promise<StructureCatalogue | null> | null = null;

/**
 * The catalogue of structures as the dev server serves it, `world/catalogues/structures.json`: read once a page load and shared,
 * or null when it cannot be read, which a reload tries again. What the map sizes a structure by. See
 * docs/plans/structures.md.
 */
export function readStructureCatalogue(): Promise<StructureCatalogue | null> {
  reading ??= fetch('/catalogues/structures.json')
    .then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
    .then(parseStructureCatalogue)
    .catch(() => null);
  return reading;
}

/** The catalogue, or null until it has been read, and for good when it cannot be. */
export function useStructureCatalogue(): StructureCatalogue | null {
  const [catalogue, setCatalogue] = useState<StructureCatalogue | null>(null);
  useEffect(() => {
    let live = true;
    void readStructureCatalogue().then((read) => live && setCatalogue(read));
    return () => {
      live = false;
    };
  }, []);
  return catalogue;
}
