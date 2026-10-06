import { decodeOrigin } from '@villages/world';
import type { OriginFile, OriginGrid, WorldName } from '@villages/world';

import { worldRootOf } from './masters';

/**
 * Everything the world knows about where its ground came from and what Earth called it, read once per master:
 * the origin map `npm run world:origin` works out, and the names it carries through it into `names.json` and
 * `regions.bin`. The Origin renderer's clicks and the Info map both read this one copy. See
 * `docs/plans/real-world-names.md`.
 */

/** A named region, a sea or a stretch of land, as `names.json` lists them; `regions.bin` numbers them from one. */
export interface NamedRegion {
  readonly id: string;
  readonly kind: 'sea' | 'land';
  /** In English. Natural Earth writes the largest in capitals, which `displayName` softens. */
  readonly name: string;
  /** What the source says it is: a sea, a gulf, a strait; a range, a desert, an island. */
  readonly feature: string;
  readonly rank?: number;
  readonly from?: number;
  /** Where in the world its name goes, and how many squares it covers; absent where it covers none. */
  readonly at?: readonly [number, number];
  readonly squares?: number;
}

export interface WorldNames {
  readonly file: OriginFile;
  readonly grid: OriginGrid;
  /** Earth's names carried into this world, or none if `world:names` has not been run for it. */
  readonly names: readonly WorldName[] | null;
  /** For every square, the land it is in and the sea it is by, or none if they were not worked out. */
  readonly regions: {
    readonly list: readonly NamedRegion[];
    readonly land: Uint16Array;
    readonly sea: Uint16Array;
  } | null;
}

const loaded = new Map<string, Promise<WorldNames | null>>();

/** A master's origin map and names, or null if it has no origin map yet. Fetched once, however often asked. */
export function loadWorldNames(master: string): Promise<WorldNames | null> {
  let found = loaded.get(master);
  if (found === undefined) {
    const root = worldRootOf(master);
    found = Promise.all([
      fetch(`${root}/origin/origin.json`),
      fetch(`${root}/origin/origin.bin`),
      fetch(`${root}/names.json`),
      fetch(`${root}/regions.bin`),
    ])
      .then(async ([json, bin, names, regions]) => {
        if (!json.ok || !bin.ok) return null;
        const file = (await json.json()) as OriginFile;
        const carried = names.ok
          ? ((await names.json()) as { names: WorldName[]; regions?: NamedRegion[] })
          : null;
        const squares = file.columns * file.rows;
        const layers =
          regions.ok && carried?.regions !== undefined ? new Uint16Array(await regions.arrayBuffer()) : null;
        return {
          file,
          grid: decodeOrigin(await bin.arrayBuffer(), file),
          names: carried?.names ?? null,
          regions:
            layers === null || layers.length !== squares * 2
              ? null
              : { list: carried!.regions!, land: layers.subarray(0, squares), sea: layers.subarray(squares) },
        };
      })
      .catch(() => null);
    loaded.set(master, found);
  }
  return found;
}

/** A region's name as it is written: Natural Earth's capitals put into ordinary case. */
export function displayName(region: NamedRegion): string {
  const { name } = region;
  return name === name.toUpperCase()
    ? name.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase())
    : name;
}
