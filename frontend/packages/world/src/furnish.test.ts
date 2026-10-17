import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { growingTable } from './biome.ts';
import { EXAMPLE_BIOMES as biomesFile } from './fixture.ts';
import { furnishCell } from './furnish.ts';
import type { RuinsAround } from './furnish.ts';
import type { RuinPiece } from './ruinLayout.ts';
import type { Palette } from './palette.ts';
import { parseRuins } from './ruins.ts';
import { CELL, scatterCell } from './scatter.ts';
import type { Ground, ScatteredPoint } from './scatter.ts';
import type { SpriteMap, SpriteMapFile } from './spriteMap.ts';
import { NO_STANDS } from './stands.ts';
import type { StandChunk } from './stands.ts';

const RUINS = parseRuins(readFileSync(new URL('../../../../world/ruins.json', import.meta.url), 'utf8'));
const TAIGA = 7;
const palette: Palette = {
  master: { width: 32768, height: 16384, projection: 'equirectangular' },
  classes: [
    { id: 0, name: 'ocean', colour: '#104058', water: true, group: 'water' },
    { id: 7, name: 'taiga', colour: '#105028', group: 'forest' },
  ],
};

/** A sprite map with the fixture's wood everywhere, as the scatter's own tests have it. */
function makeMap(): SpriteMap {
  const file: SpriteMapFile = {
    master: 'test',
    layer: 'biome',
    at: new Date(0).toISOString(),
    world: { side: 32768, tileUnits: 256, biomeSide: 2048 },
    boundary: biomesFile.boundary,
    biomes: biomesFile.biomes.map((biome) => ({
      name: biome.name,
      colour: biome.colour,
      outside: biome.stands.outside,
    })),
    kinds: biomesFile.kinds,
    grows: biomesFile.biomes.map((biome) => biome.grows),
    stands: 0,
    chunks: 0,
    bytes: 0,
    density: { worst: 'test', perUnit: 0, ceiling: biomesFile.ceiling, most: biomesFile.most },
  };
  return {
    file,
    biomeOf: new Uint8Array(2048 * 2048),
    cellUnits: 16,
    growing: growingTable(
      biomesFile.kinds,
      biomesFile.biomes.map((one) => one.grows),
      palette,
    ),
    kinds: biomesFile.kinds,
    colours: file.biomes.map((biome) => biome.colour),
    names: file.biomes.map((biome) => biome.name),
  };
}

/** A thick wood of the fixture's own everywhere, so there are trees to thin. */
const WOOD: StandChunk = {
  count: 1,
  x: Float32Array.of(16400),
  y: Float32Array.of(11000),
  reach: Float32Array.of(60),
  dominant: Uint8Array.of(255),
  thickness: Float32Array.of(0.3),
  seed: Uint8Array.of(3),
};
const map = makeMap();
const ground: Ground = { classAt: () => TAIGA, standsOf: () => WOOD };

/** One town in the middle of the wood, its record in every tile, as the bake writes it into every tile it reaches. */
const TOWN = { x: 16400, y: 11000, reach: 30 };
const townChunk: StandChunk = {
  count: 1,
  x: Float32Array.of(TOWN.x),
  y: Float32Array.of(TOWN.y),
  reach: Float32Array.of(TOWN.reach),
  dominant: Uint8Array.of(0),
  thickness: Float32Array.of(0.6),
  seed: Uint8Array.of(9),
};
const around = (chunk: StandChunk): RuinsAround => ({
  ground: {
    look: { ...RUINS.look, ring: RUINS.size.ring },
    side: 32768,
    classAt: () => TAIGA,
    water: () => false,
  },
  standsOf: () => chunk,
});
const BUILT = TOWN.reach / (1 + RUINS.size.ring);

/** Every cell the town's reach and a cell more touch. */
const cells: [number, number][] = [];
for (let y = Math.floor((TOWN.y - 40) / CELL); y <= Math.floor((TOWN.y + 40) / CELL); y += 1) {
  for (let x = Math.floor((TOWN.x - 40) / CELL); x <= Math.floor((TOWN.x + 40) / CELL); x += 1)
    cells.push([x, y]);
}
const key = (one: { x: number; y: number }) => `${one.x.toFixed(5)},${one.y.toFixed(5)}`;
const out = (one: { x: number; y: number }) => Math.hypot(one.x - TOWN.x, one.y - TOWN.y) / BUILT;

describe('a cell furnished with its trees and its ruins', () => {
  it('grows exactly what the scatter grows where no town stood', () => {
    for (const [x, y] of cells.slice(0, 6)) {
      const scattered = scatterCell(x, y, 1, ground, map);
      expect(furnishCell(x, y, 1, ground, map, null).trees).toEqual(scattered);
      expect(furnishCell(x, y, 1, ground, map, around(NO_STANDS))).toEqual({ trees: scattered, ruins: [] });
    }
  });

  it('stands no tree within a piece of the ruins, nor across the edge of a cell', () => {
    const trees: ScatteredPoint[] = [];
    const pieces: RuinPiece[] = [];
    for (const [x, y] of cells) {
      const furnished = furnishCell(x, y, 1, ground, map, around(townChunk));
      trees.push(...furnished.trees);
      pieces.push(...furnished.ruins);
    }
    expect(pieces.length).toBeGreaterThan(40);
    const through = trees.filter((tree) =>
      pieces.some((piece) => {
        const clear = RUINS.look.pieces[piece.piece]!.width / 2 + RUINS.look.layout.trees.clear;
        return Math.hypot(tree.x - piece.x, tree.y - piece.y) < clear;
      }),
    );
    expect(through).toEqual([]);
  });

  it('opens the core and leaves the land its woods beyond the town', () => {
    let inCore = 0;
    let wildCore = 0;
    let outside = 0;
    let wildOutside = 0;
    for (const [x, y] of cells) {
      const wild = scatterCell(x, y, 1, ground, map);
      const kept = new Set(furnishCell(x, y, 1, ground, map, around(townChunk)).trees.map(key));
      for (const tree of wild) {
        if (out(tree) < RUINS.look.layout.core) {
          wildCore += 1;
          if (kept.has(key(tree))) inCore += 1;
        } else if (out(tree) > 1.05) {
          wildOutside += 1;
          if (kept.has(key(tree))) outside += 1;
        }
      }
    }
    expect(wildCore).toBeGreaterThan(20);
    expect(inCore / wildCore).toBeLessThan(0.25);
    // Beyond the outline only a piece of the ruins' edge clears a tree, and only near it.
    expect(outside / wildOutside).toBeGreaterThan(0.9);
  });

  it('draws a thinner cell as a subset of a fuller one, trees and ruins both', () => {
    for (const [x, y] of cells.filter((_, at) => at % 3 === 0)) {
      const full = furnishCell(x, y, 1, ground, map, around(townChunk));
      const thin = furnishCell(x, y, 0.5, ground, map, around(townChunk));
      const trees = new Set(full.trees.map(key));
      const ruins = new Set(full.ruins.map(key));
      expect(thin.trees.filter((tree) => !trees.has(key(tree)))).toEqual([]);
      expect(thin.ruins.filter((piece) => !ruins.has(key(piece)))).toEqual([]);
    }
  });
});
