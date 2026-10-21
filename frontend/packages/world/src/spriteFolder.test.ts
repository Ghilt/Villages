import { readdirSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { BiomeFile } from './biome.ts';
import { critterKindsOf } from './critterArt.ts';
import type { CritterFile } from './critterArt.ts';
import { critterPlaceholderKinds } from './critterPlaceholders.ts';
import { MARK_NAMES, placeholderKinds } from './placeholderArt.ts';
import { ruinFrameKey, ruinPictureName } from './ruinLooks.ts';
import { RUIN_PIECES } from './ruins.ts';
import {
  BRIDGE_AXES,
  BRIDGE_KINDS,
  JETTY_AXES,
  SETTLEMENT_PIECES,
  bridgeFile,
  jettyFile,
  settlementPieceFile,
} from './settlementLooks.ts';
import { CULTURES } from './structures.ts';

/**
 * The rules `world/sprites/` is held to, by reading the folder itself. It is Adam's: he saves pictures
 * over the placeholders by hand, and `npm run world:art` refuses to cut a folder that breaks these, so a
 * broken folder is said here rather than by a map with no trees on it. See decision record 0059.
 */
const SPRITES = new URL('../../../../world/sprites/', import.meta.url);
const BIOMES = new URL('../../../../world/biomes.json', import.meta.url);
const CRITTERS = new URL('../../../../world/critters.json', import.meta.url);

const PICTURES = new Set(['.png', '.webp', '.jpg', '.jpeg']);

const kinds = (JSON.parse(readFileSync(BIOMES, 'utf8')) as BiomeFile).kinds.map((kind) => kind.name);
const critters = critterKindsOf(JSON.parse(readFileSync(CRITTERS, 'utf8')) as CritterFile).map(
  (kind) => kind.name,
);

/** The sprite names in one group's folder, one entry per picture, so a name twice is seen twice. */
function namesIn(group: string): string[] {
  return readdirSync(fileURLToPath(new URL(`${group}/`, SPRITES)))
    .filter((file) => PICTURES.has(extname(file).toLowerCase()))
    .map((file) => file.slice(0, -extname(file).length));
}

describe("the sprites folder, which is Adam's", () => {
  it('holds every picture drawn on the map, a folder a group, and the record of placeholders', () => {
    expect(readdirSync(fileURLToPath(SPRITES)).sort()).toEqual([
      'bridges',
      'critters',
      'marks',
      'placeholders.json',
      'ruins',
      'scenery',
      'settlements',
      'structures',
    ]);
  });

  it("holds exactly one picture of every settlement's piece in every culture, each jetty and every bridge", () => {
    const pieces = [
      ...SETTLEMENT_PIECES.flatMap((piece) => CULTURES.map((culture) => settlementPieceFile(piece, culture))),
      ...JETTY_AXES.map(jettyFile),
    ];
    expect(namesIn('settlements').sort()).toEqual(pieces.map((file) => file.slice(0, -4)).sort());
    const bridges = BRIDGE_KINDS.flatMap((kind) => BRIDGE_AXES.map((axis) => bridgeFile(kind, axis)));
    expect(namesIn('bridges').sort()).toEqual(bridges.map((file) => file.slice(0, -4)).sort());
  });

  it('holds exactly one picture of every piece of the ruins in every culture, and no other', () => {
    const names = namesIn('ruins');
    const wanted = RUIN_PIECES.flatMap((piece) => CULTURES.map((culture) => ruinPictureName(piece, culture)));
    expect([...names].sort()).toEqual([...wanted].sort());
  });

  it("names the ruins' frames so that no kind of scenery shares a frame with one", () => {
    const frames = RUIN_PIECES.flatMap((piece) => CULTURES.map((culture) => ruinFrameKey(piece, culture)));
    expect(frames.filter((frame) => kinds.includes(frame))).toEqual([]);
  });

  it('holds exactly one picture for every kind in world/biomes.json', () => {
    const names = namesIn('scenery');
    for (const kind of kinds) {
      expect(
        names.filter((name) => name === kind),
        kind,
      ).toHaveLength(1);
    }
  });

  it('holds exactly one picture for every mark the map places', () => {
    const names = namesIn('marks');
    for (const mark of MARK_NAMES) {
      expect(
        names.filter((name) => name === mark),
        mark,
      ).toHaveLength(1);
    }
  });

  it('has a placeholder drawing for every kind, so deleting a picture always has one to come back to', () => {
    for (const kind of kinds) {
      expect(placeholderKinds(), kind).toContain(kind);
    }
  });

  it('records placeholders only for files that are in the folder', () => {
    const recorded = JSON.parse(readFileSync(new URL('placeholders.json', SPRITES), 'utf8')) as Record<
      string,
      string
    >;
    const there = new Set(
      ['scenery', 'marks', 'ruins'].flatMap((group) =>
        readdirSync(fileURLToPath(new URL(`${group}/`, SPRITES))).map((file) => `${group}/${file}`),
      ),
    );
    for (const file of Object.keys(recorded)) {
      expect(there.has(file), file).toBe(true);
    }
  });

  it('holds exactly one picture for every critter in world/critters.json, and a placeholder drawing for each', () => {
    const names = namesIn('critters');
    for (const critter of critters) {
      expect(
        names.filter((name) => name === critter),
        critter,
      ).toHaveLength(1);
      expect(critterPlaceholderKinds(), critter).toContain(critter);
    }
  });

  it("records the critters' placeholders only for files that are in their folder", () => {
    const folder = new URL('critters/', SPRITES);
    const recorded = JSON.parse(readFileSync(new URL('placeholders.json', folder), 'utf8')) as Record<
      string,
      string
    >;
    const there = new Set(readdirSync(fileURLToPath(folder)));
    for (const file of Object.keys(recorded)) {
      expect(there.has(file), file).toBe(true);
    }
  });
});
