import { beforeEach, describe, expect, it, vi } from 'vitest';

import { quadkeyOf } from '@villages/protocol';
import { encodeStands } from '@villages/world';
import type { Palette, Stand } from '@villages/world';

import { currentPointsOf, forgetScenery, pointsOf, sceneryTally } from './sceneryCells';
import { followStandsUnder, forgetStands, standsArrived } from './standsFromServer';

/** Taiga everywhere, which the example biome grows a wood on, so only the stands decide anything. */
const { TAIGA } = vi.hoisted(() => ({ TAIGA: 7 }));

vi.mock('../../map/terrainClasses', () => ({
  terrainPalette: () => Promise.resolve({}),
  classesOfTile: () => Promise.resolve(new Uint8Array(256 * 256).fill(TAIGA)),
}));

vi.mock('./spriteMap', async () => {
  const world = await import('@villages/world');
  const biomes = world.EXAMPLE_BIOMES;
  const palette: Palette = {
    master: { width: 32768, height: 16384, projection: 'equirectangular' },
    classes: [
      { id: 0, name: 'ocean', colour: '#104058', water: true, group: 'water' },
      { id: TAIGA, name: 'taiga', colour: '#105028', group: 'forest' },
    ],
  };
  const file = {
    master: 'test',
    layer: 'biome',
    at: new Date(0).toISOString(),
    world: { side: 32768, tileUnits: 256, biomeSide: 2048 },
    boundary: biomes.boundary,
    biomes: biomes.biomes.map((biome) => ({
      name: biome.name,
      colour: biome.colour,
      outside: biome.stands.outside,
    })),
    kinds: biomes.kinds,
    grows: biomes.biomes.map((biome) => biome.grows),
    stands: 0,
    chunks: 0,
    bytes: 0,
    density: { worst: 'test', perUnit: 0, ceiling: biomes.ceiling, most: biomes.most },
  };
  const map = {
    file,
    biomeOf: new Uint8Array(2048 * 2048),
    cellUnits: 16,
    growing: world.growingTable(
      biomes.kinds,
      biomes.biomes.map((one) => one.grows),
      palette,
    ),
    kinds: biomes.kinds,
    colours: file.biomes.map((biome) => biome.colour),
    names: file.biomes.map((biome) => biome.name),
  };
  return { spriteMap: () => Promise.resolve(map) };
});

/** A scatter cell well inside the zoom 7 tile at 70 and 37, so it reads that tile's stands and no other. */
const CELL_X = 70 * 8 + 3;
const CELL_Y = 37 * 8 + 3;
/** A followed cell over that tile and no other. */
const OVER_IT = quadkeyOf({ zoom: 10, x: CELL_X, y: CELL_Y });

/** The tile's records as the gateway sends them. */
function recordsOf(stands: Stand[]): string {
  return btoa(String.fromCharCode(...encodeStands(stands, 70, 37, 256)));
}

/** A thick stand over the whole of the cell. */
const THICK: Stand = {
  x: CELL_X * 32 + 16,
  y: CELL_Y * 32 + 16,
  reach: 40,
  dominant: 255,
  thickness: 0.3,
  seed: 3,
};

const ask = (told: () => void = () => undefined) => pointsOf('/world/x', CELL_X, CELL_Y, 1, 1, told);
const onScreen = (told: () => void = () => undefined) =>
  currentPointsOf('/world/x', CELL_X, CELL_Y, 1, 1, told);

describe('the scenery cut from the stands the gateway sent', () => {
  beforeEach(() => {
    forgetScenery();
    forgetStands();
    followStandsUnder([OVER_IT]);
  });

  it('waits for its stands, and is told when they come', async () => {
    let told = 0;
    expect(ask(() => (told += 1))).toBeNull();
    await vi.waitFor(() => expect(sceneryTally().waitingOnStands).toBe(1));

    standsArrived(70, 37, recordsOf([]));
    expect(told).toBe(1);
    expect(sceneryTally().waitingOnStands).toBe(0);

    expect(ask()).toBeNull();
    await vi.waitFor(() => expect(ask()).not.toBeNull());
  });

  it('is cut again when its tile is sent again differently, and on the screen the old points stay until then', async () => {
    standsArrived(70, 37, recordsOf([]));
    ask();
    await vi.waitFor(() => expect(ask()).not.toBeNull());
    const open = ask()!;

    standsArrived(70, 37, recordsOf([THICK]));
    // Coming into view it waits for the new points; already on the screen it keeps the old ones meanwhile.
    expect(ask()).toBeNull();
    expect(onScreen()).toBe(open);

    await vi.waitFor(() => expect(onScreen()).not.toBe(open));
    const wooded = onScreen()!;
    expect(wooded.length).toBeGreaterThan(open.length);
    expect(ask()).toBe(wooded);
  });

  it('is left alone when its tile is sent again as it was', async () => {
    standsArrived(70, 37, recordsOf([THICK]));
    ask();
    await vi.waitFor(() => expect(ask()).not.toBeNull());
    const wooded = ask()!;

    standsArrived(70, 37, recordsOf([THICK]));
    expect(ask()).toBe(wooded);
    expect(onScreen()).toBe(wooded);
  });

  it('waits again for a tile the gateway has let go of', async () => {
    standsArrived(70, 37, recordsOf([]));
    followStandsUnder([]);

    expect(ask()).toBeNull();
    await vi.waitFor(() => expect(sceneryTally().waitingOnStands).toBe(1));
    expect(sceneryTally().tiles).toBe(0);
  });
});
