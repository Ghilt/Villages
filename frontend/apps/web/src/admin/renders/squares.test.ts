import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  BETWEEN,
  CRITTER_SQUARES,
  GAP,
  SQUARE,
  biomeFor,
  classAtOf,
  paintedClassAtOf,
  rendersLayout,
  squareAtOf,
  squaresOf,
} from './squares';

const world = (file: string) =>
  JSON.parse(readFileSync(new URL(`../../../../../../world/${file}`, import.meta.url), 'utf8')) as {
    classes: { id: number; name: string; group: string }[];
    groupTitles: Record<string, string>;
    biomes: { name: string; grows: Record<string, Record<string, number>> }[];
  };
const PALETTE = world('palette.json');
const GROUPS = Object.keys(PALETTE.groupTitles);
const BIOMES = world('biomes.json').biomes;

describe('the renders page', () => {
  it('has a square of every kind of land, once each, and one for every critter', () => {
    const layout = rendersLayout(PALETTE.classes, GROUPS, 8);
    expect(layout.lands.map((square) => square.land).sort()).toEqual(
      PALETTE.classes.map((one) => one.name).sort(),
    );
    expect(layout.critters.map((square) => square.critter!.kind)).toEqual(
      CRITTER_SQUARES.map((one) => one.kind),
    );
    // The palette's groups in order: the water first.
    expect(layout.lands[0]!.land).toBe('ocean');
  });

  it('keeps every square apart and inside what the layout covers, the critters under the lands, never too wide', () => {
    for (const columns of [3, 8, 40]) {
      const layout = rendersLayout(PALETTE.classes, GROUPS, columns);
      const all = squaresOf(layout);
      for (const [at, one] of all.entries()) {
        expect(one.x).toBeGreaterThanOrEqual(layout.from.x);
        expect(one.y).toBeGreaterThanOrEqual(layout.from.y);
        expect(one.x + SQUARE).toBeLessThanOrEqual(layout.to.x);
        expect(one.y + SQUARE).toBeLessThanOrEqual(layout.to.y);
        for (const other of all.slice(at + 1)) {
          const apart = one.x + SQUARE <= other.x || other.x + SQUARE <= one.x || one.y + SQUARE <= other.y;
          expect(apart || other.y + SQUARE <= one.y).toBe(true);
        }
      }
      const lowestLand = Math.max(...layout.lands.map((square) => square.y));
      expect(Math.min(...layout.critters.map((square) => square.y))).toBeGreaterThan(lowestLand + SQUARE);
      // No wider than its columns, the critters' rows too, so the page never scrolls sideways.
      expect(layout.to.x - layout.from.x).toBeLessThanOrEqual(columns * (SQUARE + GAP));
    }
  });

  it('is the land of each square inside it, and the open sea between', () => {
    const layout = rendersLayout(PALETTE.classes, GROUPS, 8);
    const classAt = classAtOf(layout);
    // Made once: the paint's is a grid of the whole page, which made once a square was most of this test's time.
    const squareAt = squareAtOf(layout);
    const paintedClassAt = paintedClassAtOf(layout);
    for (const square of squaresOf(layout)) {
      expect(classAt(square.x + SQUARE / 2, square.y + SQUARE / 2)).toBe(square.id);
      expect(classAt(square.x + 0.01, square.y + SQUARE - 0.01)).toBe(square.id);
      expect(classAt(square.x - 0.5, square.y + SQUARE / 2)).toBe(BETWEEN);
      expect(squareAt(square.x + 1, square.y + 1)).toBe(square);
      expect(squareAt(square.x - 0.5, square.y + 1)).toBeNull();
      // The paint sees the square's own land a little past its edge, so it paints no shore there.
      expect(paintedClassAt(square.x - 0.5, square.y + SQUARE / 2)).toBe(square.id);
    }
  });

  it('grows each kind of land in a biome that grows it, the temperate one where it can', () => {
    const grows = BIOMES.map((biome) => biome.grows);
    const temperate = BIOMES.findIndex((biome) => biome.name === 'temperate');
    expect(biomeFor('meadow', BIOMES, grows)).toBe(temperate);
    const tundra = biomeFor('tundra', BIOMES, grows);
    expect(Object.keys(BIOMES[tundra]!.grows)).toContain('tundra');
    // Nothing grows on the water, so no biome is picked for it.
    expect(biomeFor('ocean', BIOMES, grows)).toBe(-1);
  });
});
