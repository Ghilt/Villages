import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  biomeProblems,
  chooseBiome,
  growingTable,
  pickKind,
  regionAt,
  wanderAt,
  warmthOfLatitude,
  wetnessOfDistance,
} from './biome.ts';
import type { Biome, BiomeAxes, BiomeFile } from './biome.ts';
import type { Palette } from './palette.ts';

const real = JSON.parse(
  readFileSync(new URL('../../../../world/biomes.json', import.meta.url), 'utf8'),
) as BiomeFile;

const realPalette = JSON.parse(
  readFileSync(new URL('../../../../world/palette.json', import.meta.url), 'utf8'),
) as Palette;

const axes = (over: Partial<BiomeAxes> = {}): BiomeAxes => ({
  warmth: 50,
  wet: 50,
  high: 0,
  region: 50,
  ...over,
});

const biome = (name: string, where: Biome['where']): Biome => ({
  name,
  colour: '#123456',
  where,
  stands: { per1000: 1, reach: [4, 8], inside: 0.2, outside: 0.02 },
  grows: {},
});

describe('the axes', () => {
  it('reads warmth off the latitude, warmest on the equator', () => {
    expect(warmthOfLatitude(0)).toBeCloseTo(100, 6);
    expect(warmthOfLatitude(90)).toBeLessThan(1);
    expect(warmthOfLatitude(-90)).toBeLessThan(1);
    // Symmetric, because a row of the master is a latitude and nothing else.
    expect(warmthOfLatitude(57)).toBeCloseTo(warmthOfLatitude(-57), 9);
  });

  it('falls without ever rising as you go north', () => {
    for (let lat = 0; lat < 90; lat += 1) {
      expect(warmthOfLatitude(lat + 1)).toBeLessThan(warmthOfLatitude(lat));
    }
  });

  it('puts the treeline near the arctic circle rather than near the Alps', () => {
    // Not a fact about Earth, a statement about the curve: 66 degrees has to land in the band
    // world/biomes.json gives to arctic and boreal, or every northern biome is in the wrong place.
    expect(warmthOfLatitude(66.5)).toBeGreaterThan(20);
    expect(warmthOfLatitude(66.5)).toBeLessThan(40);
    expect(warmthOfLatitude(45)).toBeGreaterThan(53);
    expect(warmthOfLatitude(45)).toBeLessThan(70);
  });

  it('is wettest on the shore and dry well inland', () => {
    expect(wetnessOfDistance(0)).toBe(100);
    expect(wetnessOfDistance(40)).toBe(0);
    expect(wetnessOfDistance(1000)).toBe(0);
    expect(wetnessOfDistance(20)).toBeGreaterThan(30);
    expect(wetnessOfDistance(20)).toBeLessThan(70);
  });

  it('keeps the region field inside its range and wraps at the antimeridian', () => {
    for (let lng = -180; lng <= 180; lng += 7) {
      for (let lat = -80; lat <= 80; lat += 11) {
        const at = regionAt(lng, lat, real.region);
        expect(at).toBeGreaterThanOrEqual(0);
        expect(at).toBeLessThanOrEqual(100);
      }
    }
    expect(regionAt(-180, 20, real.region)).toBeCloseTo(regionAt(180, 20, real.region), 9);
  });
});

describe('the wander that keeps a biome edge off the grid', () => {
  it('stays in range, and gives the same answer twice', () => {
    for (let x = 0; x < 2000; x += 37) {
      for (let y = 0; y < 2000; y += 53) {
        const at = wanderAt(x, y, 26, 991, 32768);
        expect(at).toBeGreaterThanOrEqual(-1);
        expect(at).toBeLessThanOrEqual(1);
        expect(wanderAt(x, y, 26, 991, 32768)).toBe(at);
      }
    }
  });

  it('wraps at the antimeridian, so the seam is not a line of its own', () => {
    for (let y = 0; y < 400; y += 61) {
      expect(wanderAt(32768, y, 26, 991, 32768)).toBeCloseTo(wanderAt(0, y, 26, 991, 32768), 9);
    }
  });

  it('varies smoothly rather than jumping between neighbours', () => {
    let worst = 0;
    for (let x = 100; x < 400; x += 1) {
      worst = Math.max(
        worst,
        Math.abs(wanderAt(x + 1, 250, 26, 991, 32768) - wanderAt(x, 250, 26, 991, 32768)),
      );
    }
    // One world unit is a twenty-sixth of a cell, so a step of it cannot cross the whole range.
    expect(worst).toBeLessThan(0.4);
  });
});

describe('choosing a biome', () => {
  const list = [biome('cold', { warmth: [0, 30] }), biome('high', { high: [50, 100] }), biome('rest', {})];

  it('takes the first that accepts all four axes, so order is the rule', () => {
    expect(chooseBiome(axes({ warmth: 10 }), list)).toBe(0);
    expect(chooseBiome(axes({ warmth: 10, high: 90 }), list)).toBe(0);
    expect(chooseBiome(axes({ warmth: 80, high: 90 }), list)).toBe(1);
    expect(chooseBiome(axes({ warmth: 80 }), list)).toBe(2);
  });

  it('treats a missing axis as accepting anything, and both ends as inclusive', () => {
    expect(chooseBiome(axes({ warmth: 0 }), list)).toBe(0);
    expect(chooseBiome(axes({ warmth: 30 }), list)).toBe(0);
    expect(chooseBiome(axes({ warmth: 30.01 }), list)).toBe(2);
  });
});

describe('what grows', () => {
  const file: BiomeFile = {
    ceiling: real.ceiling,
    most: real.most,
    region: real.region,
    boundary: real.boundary,
    kinds: [
      { name: 'pine', groundHeight: 1.5, vary: 0.2, order: 8, gather: 0.8, apart: 0.8, underCanopy: false },
      { name: 'grass', groundHeight: 0.7, vary: 0.3, order: 2, gather: 0.2, apart: 0.3, underCanopy: true },
    ],
    biomes: [{ ...biome('wood', {}), grows: { taiga: { pine: 3, grass: 1 } } }],
  };

  it('grows nothing on a class the biome does not list', () => {
    const table = growingTable(file, realPalette);
    const meadow = realPalette.classes.find((terrain) => terrain.name === 'meadow')!;
    expect(pickKind(table[0 * 256 + meadow.id]!, 0.5)).toBe(-1);
  });

  it('honours the weights as commonality rather than probability', () => {
    const table = growingTable(file, realPalette);
    const taiga = realPalette.classes.find((terrain) => terrain.name === 'taiga')!;
    const growing = table[0 * 256 + taiga.id]!;
    expect(growing.total).toBe(4);

    let pines = 0;
    const rolls = 40000;
    for (let at = 0; at < rolls; at += 1) {
      if (pickKind(growing, (at + 0.5) / rolls) === 0) {
        pines += 1;
      }
    }
    expect(pines / rolls).toBeCloseTo(0.75, 3);
  });
});

describe('the file the world is actually furnished from', () => {
  /**
   * The same bargain `painterly.test.ts` makes, for the same reason: world/biomes.json is hand-edited
   * JSON that nothing typechecks, and a typo in it costs a run of the generator or an empty world in the
   * browser. The generator reports this on the way past, but only when somebody runs it.
   */
  it('can be used', () => {
    expect(biomeProblems(real, realPalette)).toEqual([]);
  });

  /**
   * The one claim that crosses a package boundary, and it is worth the crossing.
   *
   * `apps/web` draws a kind whole once it stands READABLE = 10 screen pixels, which is zoom
   * `6 + log2(10 / groundHeight)`, and the camera stops at 10. So a kind shorter than ten sixteenths of
   * a unit can never be seen whole however far in the player comes. Nothing in `apps/web` can check it,
   * because that tsconfig has no node types and cannot read this file; and nothing here knows about
   * cameras. So the arithmetic is written out, with where each number comes from.
   */
  it('has no kind too short for the camera to ever show whole', () => {
    const WORLD_UNIT_ZOOM = 6; // log2(master width / tile size), apps/web/src/sprites/cameraMath.ts
    const READABLE = 20; // apps/web/src/sprites/scenery/showing.ts
    const MAX_ZOOM = 10; // WORLD_MAX_ZOOM, apps/web/src/map/worldStyle.ts
    const shortest = READABLE / 2 ** (MAX_ZOOM - WORLD_UNIT_ZOOM);

    for (const kind of real.kinds) {
      expect(kind.groundHeight, `${kind.name} is ${kind.groundHeight} units`).toBeGreaterThanOrEqual(
        shortest,
      );
    }
  });

  it('names every kind the browser will have to draw', () => {
    expect(real.kinds.length).toBeGreaterThanOrEqual(12);
    expect(new Set(real.kinds.map((kind) => kind.name)).size).toBe(real.kinds.length);
  });

  /**
   * Experiment 0006 found the ceiling by Adam's hand: a point every 1.5 world units, about 0.44 to the
   * square unit, and past that the map lags. A biome is a few numbers in a JSON file and nothing else
   * would notice one of them going up by a factor of three, so the budget is checked here rather than
   * discovered in an evening of wondering why the map has gone sticky.
   */
  it('keeps every biome inside experiment 0006 budget', () => {
    for (const one of real.biomes) {
      const [low, high] = one.stands.reach;
      // A stand's thickness falls off as 1 - t squared, whose integral over the disc is half its area,
      // and stands add rather than one winning - so the mean is simply how much they contribute over how
      // much ground there is. E[r^2] over a uniform reach is (a^2 + ab + b^2) / 3.
      const weight = (Math.PI * ((low * low + low * high + high * high) / 3)) / 2;
      const density = one.stands.outside + (one.stands.per1000 / 1000) * weight * one.stands.inside;
      expect(density, `${one.name} asks for ${density.toFixed(3)} points a square unit`).toBeLessThan(
        real.ceiling,
      );
    }
  });

  it('leaves a stand lumpy rather than flattened by the cap', () => {
    // A lone stand peaks at its own `inside`. If every peak were over `most` the cap would shave them
    // all to one plateau and a wood would be evenly dense again, which is the thing this file exists to
    // stop. Peaks above the *ceiling* are fine and wanted: the ceiling is a screenful's average.
    expect(real.biomes.filter((one) => one.stands.inside > real.most).map((one) => one.name)).toEqual([]);
    const lumpy = real.biomes.filter((one) => one.stands.inside > one.stands.outside * 4);
    expect(lumpy.length).toBeGreaterThan(real.biomes.length / 2);
  });

  it('cuts the grid no finer than the thickest stand needs', () => {
    // `most` is the density the browser's grid is cut at. Every step above what the file reaches is a
    // grid point hashed on every cell and then thrown away, which is the quiet way to make panning slow.
    const peak = Math.max(...real.biomes.map((one) => one.stands.inside));
    expect(real.most).toBeGreaterThanOrEqual(peak);
    expect(real.most).toBeLessThan(peak * 1.5);
  });

  it('keeps a lone tree rare, so a wood is where the trees are', () => {
    // Adam's: the vast majority of trees should be clustered. `gather` is the share of a kind that
    // refuses to grow outside a stand, so a tree with a low one is a tree scattered over open ground.
    const trees = real.kinds.filter((kind) => kind.groundHeight >= 2.4 && kind.name !== 'snag');
    expect(trees.length).toBeGreaterThan(5);
    for (const tree of trees) {
      expect(tree.gather, `${tree.name} gathers at ${tree.gather}`).toBeGreaterThanOrEqual(0.6);
    }
    // And most of them much harder than that: an acacia on a savanna is meant to stand alone.
    expect(trees.filter((tree) => tree.gather >= 0.85).length).toBeGreaterThan(trees.length / 2);
  });
});

describe('a broken file, so the check is known to work', () => {
  const good: BiomeFile = {
    ceiling: real.ceiling,
    most: real.most,
    region: real.region,
    boundary: real.boundary,
    kinds: [
      { name: 'pine', groundHeight: 1.5, vary: 0.2, order: 8, gather: 0.8, apart: 0.8, underCanopy: false },
    ],
    biomes: [biome('cold', { warmth: [0, 30] }), biome('rest', {})],
  };

  it('accepts the good one', () => {
    expect(biomeProblems(good, realPalette)).toEqual([]);
  });

  it('catches a kind nobody drew', () => {
    const broken = {
      ...good,
      biomes: [{ ...good.biomes[0]!, grows: { taiga: { larch: 4 } } }, good.biomes[1]!],
    };
    expect(biomeProblems(broken, realPalette).map((problem) => problem.kind)).toContain('unknown-kind');
  });

  it('catches a terrain class nobody painted', () => {
    const broken = {
      ...good,
      biomes: [{ ...good.biomes[0]!, grows: { jungle: { pine: 4 } } }, good.biomes[1]!],
    };
    expect(biomeProblems(broken, realPalette).map((problem) => problem.kind)).toContain('unknown-class');
  });

  it('catches a colour an image editor would not show', () => {
    const broken = { ...good, biomes: [{ ...good.biomes[0]!, colour: 'green' }, good.biomes[1]!] };
    expect(biomeProblems(broken, realPalette).map((problem) => problem.kind)).toContain('bad-colour');
  });

  it('catches a band written backwards', () => {
    const broken = { ...good, biomes: [biome('cold', { warmth: [30, 0] }), good.biomes[1]!] };
    expect(biomeProblems(broken, realPalette).map((problem) => problem.kind)).toContain('bad-band');
  });

  it('catches a file with nothing to fall back on', () => {
    const broken = { ...good, biomes: [good.biomes[0]!] };
    expect(biomeProblems(broken, realPalette).map((problem) => problem.kind)).toContain('no-catch-all');
  });

  it('catches a biome an earlier one already swallowed whole', () => {
    const broken = {
      ...good,
      biomes: [biome('wide', { warmth: [0, 100] }), biome('inside', { warmth: [10, 20] }), good.biomes[1]!],
    };
    expect(biomeProblems(broken, realPalette).map((problem) => problem.kind)).toContain('unreachable');
  });
});
