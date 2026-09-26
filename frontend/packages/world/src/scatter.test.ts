import { describe, expect, it } from 'vitest';

import { growingTable } from './biome.ts';
import { EXAMPLE_BIOMES as biomesFile } from './fixture.ts';
import type { Palette } from './palette.ts';
import { CELL, cellOf, scatterCell } from './scatter.ts';
import type { ClassAt, Ground, ScatteredPoint } from './scatter.ts';
import type { SpriteMap, SpriteMapFile } from './spriteMap.ts';
import { NO_FAVOURITE } from './stands.ts';
import type { StandChunk } from './stands.ts';
import { TILE_SIZE } from './tiles.ts';

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

/** The same ground on every tile, which is what a test about the rule rather than the tiles wants. */
const on = (classAt: ClassAt, stands: StandChunk): Ground => ({ classAt, standsOf: () => stands });
const allTaiga = () => TAIGA;
const at = (point: ScatteredPoint): string => `${point.x.toFixed(6)},${point.y.toFixed(6)}`;

describe('where scenery stands', () => {
  it('grows nothing at all on ground the biome has no mix for', () => {
    expect(
      scatterCell(
        4,
        4,
        1,
        on(() => OCEAN, NO_STANDS),
        map,
      ),
    ).toEqual([]);
  });

  it('puts the same pine on the same ground however the cache is cut', () => {
    // A point's identity is its place on the world grid, so a cell is a cache and nothing else. If this
    // ever stopped being true, panning would redraw the world slightly differently as cells were reused.
    const together = scatterCell(10, 10, 1, on(allTaiga, NO_STANDS), map);
    const again = scatterCell(10, 10, 1, on(allTaiga, NO_STANDS), map);
    expect(again.map(at)).toEqual(together.map(at));

    // And a neighbouring cell never repeats one of its points.
    const beside = scatterCell(11, 10, 1, on(allTaiga, NO_STANDS), map);
    const shared = new Set(together.map(at));
    expect(beside.filter((point) => shared.has(at(point)))).toEqual([]);
  });

  it('stays inside the cell it was asked for', () => {
    for (const point of scatterCell(10, 10, 1, on(allTaiga, NO_STANDS), map)) {
      expect(cellOf(point.x)).toBe(10);
      expect(cellOf(point.y)).toBe(10);
    }
  });

  it("cuts cells that a zoom 7 tile divides exactly, so a cell's own points want one chunk", () => {
    // A cell's own points all stand on one tile, and only the margin it spaces them against reaches the
    // next one. A CELL that did not divide TILE_SIZE would put some cells' own points across two tiles,
    // and every rule that reads the ground by tile would have to be told about the split.
    expect(TILE_SIZE % CELL).toBe(0);
    const perTile = TILE_SIZE / CELL;
    for (const cell of [0, 1, perTile - 1, perTile, perTile * 3 + 2]) {
      const tile = Math.floor(cell / perTile);
      expect(cellOf(cell * CELL)).toBe(cell);
      expect(cellOf(cell * CELL + CELL - 0.001)).toBe(cell);
      expect(Math.floor((cell * CELL + CELL - 0.001) / TILE_SIZE)).toBe(tile);
    }
  });
});

describe('what a stand does', () => {
  const spruce = kindOf('spruce');
  const middleX = 10 * CELL + CELL / 2;
  const middleY = 10 * CELL + CELL / 2;

  it('thickens the ground under it', () => {
    const bare = scatterCell(10, 10, 1, on(allTaiga, NO_STANDS), map);
    const wooded = scatterCell(
      10,
      10,
      1,
      on(allTaiga, oneStand(middleX, middleY, CELL, spruce, biomesFile.most)),
      map,
    );
    expect(wooded.length).toBeGreaterThan(bare.length * 2);
  });

  it('thins away from its middle rather than stopping at an edge', () => {
    // The whole point of a kernel over a flat disc: a wood has to have a ragged inside, or it is the
    // even carpet this replaced with extra steps.
    const stand = oneStand(middleX, middleY, CELL, spruce, biomesFile.most);
    const points = scatterCell(10, 10, 1, on(allTaiga, stand), map);
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
    const inside = scatterCell(10, 10, 1, on(allTaiga, stand), map);
    const outside = scatterCell(10, 10, 1, on(allTaiga, NO_STANDS), map);

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
          all.push(...scatterCell(cellX, cellY, 1, on(allTaiga, stands), map));
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
    const full = scatterCell(10, 10, 1, on(allTaiga, NO_STANDS), map);
    const half = scatterCell(10, 10, 0.5, on(allTaiga, NO_STANDS), map);

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
      on(allTaiga, oneStand(10 * CELL + CELL / 2, 10 * CELL + CELL / 2, CELL, NO_FAVOURITE, biomesFile.most)),
      map,
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
    const points = scatterCell(10, 10, 1, on(allTaiga, NO_STANDS), map);
    for (let index = 1; index < points.length; index += 1) {
      expect(points[index]!.rank).toBeGreaterThanOrEqual(points[index - 1]!.rank);
    }
  });
});

describe('spacing, which keeps trees from standing on each other', () => {
  const apartOf = (kind: number): number => biomesFile.kinds[kind]!.apart;
  const perTile = TILE_SIZE / CELL;

  /** Every point over a block of cells, with the stands different on either side of a tile edge. */
  const block = (spacing: number): ScatteredPoint[] => {
    // Thick wood on tile 1 and open ground on tile 0, so the edge between them is the hard case: a cell
    // near it has to work its neighbours' candidates out from the other tile's stands.
    const thick = oneStand(perTile * CELL + CELL * 2, 10 * CELL, CELL * 4, NO_FAVOURITE, biomesFile.most);
    const ground: Ground = {
      classAt: allTaiga,
      standsOf: (tileX) => (tileX === 1 ? thick : NO_STANDS),
    };
    const all: ScatteredPoint[] = [];
    for (let cellY = 8; cellY <= 11; cellY += 1) {
      for (let cellX = perTile - 2; cellX <= perTile + 1; cellX += 1) {
        all.push(...scatterCell(cellX, cellY, 1, ground, map, spacing));
      }
    }
    return all;
  };

  /** The pairs nearer than their two kinds allow, found through buckets rather than every pair. */
  const crowdedPairs = (points: ScatteredPoint[], spacing: number): number => {
    const size = 2;
    const buckets = new Map<string, ScatteredPoint[]>();
    for (const point of points) {
      const key = `${Math.floor(point.x / size)}/${Math.floor(point.y / size)}`;
      buckets.set(key, [...(buckets.get(key) ?? []), point]);
    }
    let crowded = 0;
    for (const point of points) {
      const bx = Math.floor(point.x / size);
      const by = Math.floor(point.y / size);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          for (const other of buckets.get(`${bx + dx}/${by + dy}`) ?? []) {
            if (other === point) {
              continue;
            }
            const apart = ((apartOf(point.kind) + apartOf(other.kind)) / 2) * spacing;
            if (Math.hypot(other.x - point.x, other.y - point.y) < apart) {
              crowded += 1;
            }
          }
        }
      }
    }
    return crowded / 2;
  };

  it('never lets two points stand nearer than their kinds allow, across the edges of cells and tiles', () => {
    const spaced = block(1);
    expect(spaced.length).toBeGreaterThan(200);
    expect(crowdedPairs(spaced, 1)).toBe(0);
  });

  it('is exactly the old scatter at nought, where trees did stand on each other', () => {
    const unspaced = block(0);
    // The fault this exists for, shown to be real rather than assumed.
    expect(crowdedPairs(unspaced, 1)).toBeGreaterThan(20);
    // And spacing only ever takes points out: every spaced point is one of the unspaced ones.
    const was = new Set(unspaced.map(at));
    for (const point of block(1)) {
      expect(was.has(at(point))).toBe(true);
    }
  });

  it('takes out more where the wood is thick than on the open ground', () => {
    // How much it takes is the file's business - density and `apart` - and is measured on the real world
    // in the stills. What the rule itself promises is that crowding is what it answers to.
    const thickSide = (points: ScatteredPoint[]) =>
      points.filter((point) => point.x >= perTile * CELL).length;
    const openSide = (points: ScatteredPoint[]) => points.filter((point) => point.x < perTile * CELL).length;
    const before = block(0);
    const after = block(1);
    const thickLoss = 1 - thickSide(after) / thickSide(before);
    const openLoss = 1 - openSide(after) / Math.max(1, openSide(before));
    expect(thickLoss).toBeGreaterThan(0);
    expect(openLoss).toBeLessThan(thickLoss);
  });

  it('lets a tree clear the floor around its foot, rather than a fern clearing a tree', () => {
    // Earlier wins and the big kinds arrive earlier, so where a tree and a heather crowd each other it is
    // the tree that is left standing. Two spruces must stand further apart than two heathers, so the
    // share of each kind kept overall says nothing about this; the pairs that crowd each other do.
    const before = block(0);
    const after = new Set(block(1).map(at));
    const spruce = kindOf('spruce');
    const heather = kindOf('heather');
    let treeLeft = 0;
    let fernLeft = 0;
    for (const tree of before.filter((point) => point.kind === spruce)) {
      for (const fern of before.filter((point) => point.kind === heather)) {
        if (Math.hypot(tree.x - fern.x, tree.y - fern.y) < (apartOf(spruce) + apartOf(heather)) / 2) {
          treeLeft += after.has(at(tree)) ? 1 : 0;
          fernLeft += after.has(at(fern)) ? 1 : 0;
        }
      }
    }
    expect(treeLeft + fernLeft).toBeGreaterThan(0);
    expect(treeLeft).toBeGreaterThan(fernLeft);
  });
});
