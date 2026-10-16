import { parseStructureCatalogue } from '@villages/world';
import type { StructureCatalogue } from '@villages/world';

import { shelved } from './shelved';

/**
 * The catalogue of structures, `world/catalogues/structures.json`: what the map sizes a structure by, read once a page
 * load and again when it changes. See docs/plans/structures.md and decision record 0097.
 */
const structures = shelved('structures.json', parseStructureCatalogue);

/** The catalogue, or null until it has been read, and while it cannot be. */
export const useStructureCatalogue = (): StructureCatalogue | null => structures.use();
