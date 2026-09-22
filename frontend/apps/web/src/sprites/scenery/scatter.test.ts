import { describe, expect, it } from 'vitest';

import { NO_FAVOURITE, growingTable } from '@villages/world';
import type { Palette, StandChunk } from '@villages/world';

import { CELL, cellOf, scatterCell } from './scatter';
import type { ScatteredPoint } from './scatter';
import { BIOMES as biomesFile } from './fixture';
import type { SpriteMap, SpriteMapFile } from './spriteMap';

/** Two classes are all this needs: one that grows things and one that grows nothing. */
const palette: Palette = {
  master: { width: 32768, height: 16384, projection: 'equirectangular' },
  classes: [
    { id: 0, name: 'ocean', colour: '#104058', water: true, group: 'water' },
    { id: 7, name: 'taiga', colour: '#105028', group: 'forest' },
  ],
};

const kindOf = (name: string): number => biomesFile.kinds.findIndex((kind) => kind.name === name);

const TAIGA = 7;
const OCEAN = 0;
const WHICH = 0;

/** A sprite map with the fixture's wood everywhere, so only the rule is under test. */
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
    density: {
      worst: 'test',
      perUnit: 0,
      ceiling: biomesFile.ceiling,
      most: biomesFile.most,
    },
  };
  return {
    file,
    biomeOf: new Uint8Array(2048 * 2048).fill(WHICH),
    cellUnits: 16,
    growing: growingTable(biomesFile, palette),
    kinds: biomesFile.kinds,
    colours: file.biomes.map((biome) => biome.colour),
    names: file.biomes.map((biome) => biome.name),
  };
}

const NO_STANDS: StandChunk = {
  count: 0,
  x: new Float32Array(0),
  y: new Float32Array(0),
  reach: new Float32Array(0),
  dominant: new Uint8Array(0),
  thickness: new Float32Array(0),
  seed: new Uint8Array(0),
};

function oneStand(x: number, y: number, reach: number, dominant: number, thickness: number): StandChunk {
  return {
    count: 1,
    x: Float32Array.of(x),
    y: Float32Array.of(y),
    reach: Float32Array.of(reach),
    dominant: Uint8Array.of(dominant),
    thickness: Float32Array.of(thickness),
    seed: Uint8Array.of(7),
  };
}

const map = makeMap();
const allTaiga = () => TAIGA;
const at = (point: ScatteredPoint): string => `${point.x.toFixed(6)},${point.y.toFixed(6)}`;

describe('where scenery stands', () => {
  it('grows nothing at all on ground the biome has no mix for', () => {
    expect(scatterCell(4, 4, 1, () => OCEAN, map, NO_STANDS)).toEqual([]);
  });

  it('puts the same pine on the same ground however the cache is cut', () => {
    // A point's identity is its place on the world grid, so a cell is a cache and nothing else. If this
    // ever stopped being true, panning would redraw the world slightly differently as cells were reused.
    const together = scatterCell(10, 10, 1, allTaiga, map, NO_STANDS);
    const again = scatterCell(10, 10, 1, allTaiga, map, NO_STANDS);
    expect(again.map(at)).toEqual(together.map(at));

    // And a neighbouring cell never repeats one of its points.
    const beside = scatterCell(11, 10, 1, allTaiga, map, NO_STANDS);
    const shared = new Set(together.map(at));
    expect(beside.filter((point) => shared.has(at(point)))).toEqual([]);
  });

  it('stays inside the cell it was asked for', () => {
    for (const point of scatterCell(10, 10, 1, allTaiga, map, NO_STANDS)) {
      expect(cellOf(point.x)).toBe(10);
      expect(cellOf(point.y)).toBe(10);
    }
  });
});

describe('what a stand does', () => {
  const spruce = kindOf('spruce');
  const middleX = 10 * CELL + CELL / 2;
  const middleY = 10 * CELL + CELL / 2;

  it('thickens the ground under it', () => {
    const bare = scatterCell(10, 10, 1, allTaiga, map, NO_STANDS);
    const wooded = scatterCell(
      10,
      10,
      1,
      allTaiga,
      map,
      oneStand(middleX, middleY, CELL, spruce, biomesFile.most),
    );
    expect(wooded.length).toBeGreaterThan(bare.length * 2);
  });

  it('thins away from its middle rather than stopping at an edge', () => {
    // The whole point of a kernel over a flat disc: a wood has to have a ragged inside, or it is the
    // even carpet this replaced with extra steps.
    const stand = oneStand(middleX, middleY, CELL, spruce, biomesFile.most);
    const points = scatterCell(10, 10, 1, allTaiga, map, stand);
    const near = points.filter((point) => Math.hypot(point.x - middleX, point.y - middleY) < CELL / 3);
    const far = points.filter((point) => {
      const away = Math.hypot(point.x - middleX, point.y - middleY);
      return away >= (CELL * 2) / 3 && away < CELL;
    });
    // Same ring area either way is not the comparison; density is. Points over the area they cover.
    const nearArea = Math.PI * (CELL / 3) ** 2;
    const farArea = Math.PI * (CELL ** 2 - ((CELL * 2) / 3) ** 2);
    expect(near.length / nearArea).toBeGreaterThan((far.length / farArea) * 1.5);
  });

  it('leans the mix towards its own favourite', () => {
    const stand = oneStand(middleX, middleY, CELL * 2, spruce, biomesFile.most);
    const inside = scatterCell(10, 10, 1, allTaiga, map, stand);
    const outside = scatterCell(10, 10, 1, allTaiga, map, NO_STANDS);

    const share = (points: ScatteredPoint[]) =>
      points.filter((point) => point.kind === spruce).length / Math.max(1, points.length);
    expect(share(inside)).toBeGreaterThan(share(outside));
  });

  it('keeps a gathering kind off the open ground', () => {
    // `gather` is what makes a fern a find in a meadow and a carpet in a wood. The fixture's heather and
    // fernish are the same height and the same commonality and differ only in how hard they gather, so
    // any difference between them out on the open ground is that and nothing else.
    //
    // Over a block of cells rather than one: open ground is thin by design, so a single cell holds about
    // forty points and a share measured on forty points is noise wearing a decimal point.
    const over = (stands: StandChunk): ScatteredPoint[] => {
      const all: ScatteredPoint[] = [];
      for (let cellY = 2; cellY < 20; cellY += 1) {
        for (let cellX = 2; cellX < 20; cellX += 1) {
          all.push(...scatterCell(cellX, cellY, 1, allTaiga, map, stands));
        }
      }
      return all;
    };
    const open = over(NO_STANDS);
    const wooded = over(oneStand(11 * CELL, 11 * CELL, CELL * 26, NO_FAVOURITE, biomesFile.most));
    const share = (points: ScatteredPoint[], kind: number) =>
      points.filter((point) => point.kind === kind).length / Math.max(1, points.length);

    const clinging = kindOf('fernish');
    const loose = kindOf('heather');
    // Open ground is deliberately sparse now - a lone tree is meant to be rare - so the block has to
    // be wide before a share measured on it means anything.
    expect(open.length).toBeGreaterThan(700);
    expect(share(open, clinging)).toBeLessThan(share(open, loose) / 2);
    // And inside a stand the one that gathers is no longer held back at all.
    expect(share(wooded, clinging)).toBeGreaterThan(share(open, clinging) * 2);
  });
});

describe('the density dial', () => {
  it('lets points in and out without ever moving one', () => {
    // This is what makes turning the dial watchable rather than a reshuffle: a thinner world is a strict
    // subset of a fuller one, so nothing jumps.
    const full = scatterCell(10, 10, 1, allTaiga, map, NO_STANDS);
    const half = scatterCell(10, 10, 0.5, allTaiga, map, NO_STANDS);

    expect(half.length).toBeLessThan(full.length);
    const fullAt = new Set(full.map(at));
    for (const point of half) {
      expect(fullAt.has(at(point))).toBe(true);
    }
  });
});

describe('the order things arrive in', () => {
  it('brings the big things before the floor they stand on', () => {
    const points = scatterCell(
      10,
      10,
      1,
      allTaiga,
      map,
      oneStand(10 * CELL + CELL / 2, 10 * CELL + CELL / 2, CELL, NO_FAVOURITE, biomesFile.most),
    );
    const mean = (kind: number) => {
      const of = points.filter((point) => point.kind === kind);
      return of.length === 0 ? null : of.reduce((sum, point) => sum + point.rank, 0) / of.length;
    };
    const spruce = mean(kindOf('spruce'));
    const heather = mean(kindOf('heather'));
    expect(spruce).not.toBeNull();
    expect(heather).not.toBeNull();
    expect(spruce!).toBeLessThan(heather!);
  });

  it('sorts by rank, so drawing a prefix is drawing the earliest', () => {
    const points = scatterCell(10, 10, 1, allTaiga, map, NO_STANDS);
    for (let index = 1; index < points.length; index += 1) {
      expect(points[index]!.rank).toBeGreaterThanOrEqual(points[index - 1]!.rank);
    }
  });
});
