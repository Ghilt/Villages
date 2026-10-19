import { GROUND_LATTICE, frameOf, worldXOf, worldYOf } from '@villages/world';

import { classesOfTile, terrainPalette } from '../../geometry/terrainClasses';
import { FLAT_MAX_ZOOM, TILE } from '../../geometry/world';
import type { Footing, GroundOf } from './paths';

const FRAME = frameOf(GROUND_LATTICE);

/** The classes a path keeps off, and the one it fords, by their names in `world/palette.json`. */
const OPEN_WATER = new Set(['ocean', 'shallow-sea', 'lake']);
const RIVER = 'river';

/**
 * The ground under a diamond for a path, read from the flat tiles of class ids at zoom 7, a world unit a texel, as the
 * land's motion reads them: a tile asked for the first time it is needed, and the ground under it not known until it
 * comes, when `changed` is called so the paths waiting on it are walked. A tile that is not there is open water.
 */
export function createGroundTiles(root: string, changed: () => void): GroundOf {
  const tiles = new Map<string, Uint8Array | null>();
  const asked = new Set<string>();
  let footings: Footing[] | null = null;

  async function ask(key: string, x: number, y: number): Promise<void> {
    const palette = await terrainPalette();
    footings ??= Array.from({ length: 256 }, (_, id) => {
      const name = palette.classes.find((one) => one.id === id)?.name;
      return name === undefined ? 'land' : OPEN_WATER.has(name) ? 'water' : name === RIVER ? 'river' : 'land';
    });
    tiles.set(key, await classesOfTile(root, FLAT_MAX_ZOOM, x, y, palette));
    changed();
  }

  return (u, v) => {
    const x = worldXOf(FRAME, u + 0.5, v + 0.5);
    const y = worldYOf(FRAME, u + 0.5, v + 0.5);
    const tileX = Math.floor(x / TILE);
    const tileY = Math.floor(y / TILE);
    const key = `${tileX}/${tileY}`;
    const tile = tiles.get(key);
    if (tile === undefined || footings === null) {
      if (!asked.has(key)) {
        asked.add(key);
        void ask(key, tileX, tileY);
      }
      return null;
    }
    if (tile === null) {
      return 'water';
    }
    const across = Math.floor(x) - tileX * TILE;
    const down = Math.floor(y) - tileY * TILE;
    return footings[tile[down * TILE + across]!] ?? 'land';
  };
}
