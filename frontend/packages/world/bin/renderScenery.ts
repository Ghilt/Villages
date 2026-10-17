import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

import { PNG } from 'pngjs';

import { DEFAULT_MASTER, masterNameOf, standsDirOf, worldDirOf } from '../src/masters.ts';
import { GROUND_LATTICE } from '../src/lattice.ts';
import { onLattice, paintPixel, preparePainterly } from '../src/painterly.ts';
import type { ClassSampler, PainterlyStyle, PreparedPainterly } from '../src/painterly.ts';
import type { Palette } from '../src/palette.ts';
import { encodeRgbPng } from '../src/png.ts';
import type { RgbImage } from '../src/png.ts';
import type { ClassRaster } from '../src/raster.ts';
import type { NamesFile } from '../src/namesFile.ts';
import { furnishCell } from '../src/furnish.ts';
import type { RuinsAround } from '../src/furnish.ts';
import type { RuinPiece } from '../src/ruinLayout.ts';
import type { RuinsMapFile } from '../src/ruins.ts';
import { CELL, cellOf } from '../src/scatter.ts';
import type { ScatteredPoint } from '../src/scatter.ts';
import { biomeAt, spriteMapOf } from '../src/spriteMap.ts';
import type { SpriteMap, SpriteMapFile } from '../src/spriteMap.ts';
import type { StandChunk } from '../src/stands.ts';

import { flag, named } from './lib/flags.ts';
import { classSamplerOf, readMaster } from './lib/master.ts';
import { OUTPUT_DIR, PAINTERLY, PAINTERLY_DIR, PALETTE, RENDER, STANDS_DIR, masterAt } from './lib/paths.ts';
import { flatColoursOf, mercatorY, stamp, stampRuin, standsReader } from './lib/stills.ts';

/**
 * Stills of what the sprite map put on the ground, painted onto the ground it put it on.
 *
 * **This is a plan of the scenery, not a picture of the game.** Every point comes from the same
 * `scatterCell` the browser runs - the same grid, the same hashes, the same stands, so a mark here
 * stands where a pine stands - but a mark is a mark, not a silhouette: the sixteen shapes are drawn in
 * Pixi and there is no rasteriser here to draw them with. What this answers is every question the
 * generator raises and the browser answers slowly: is it clumpy, is it too thick, is the mix right,
 * does a wood stop where Adam painted it stopping. What a pine *looks* like is the map's own business.
 *
 * It takes the **places** from `world/painterly.json`, because those are already chosen and choosing
 * where to look is a matter of taste. It takes the **distance** itself, because that is not: scenery is
 * only in the world at all from about zoom 9, and five of the six painterly views are further out than
 * that - so painting them at their own zoom would produce five empty pictures and one good one.
 *
 * Everything the sprite map asks for is drawn. The browser lets it in over about two zooms as the
 * camera comes down, which is `showing.ts`'s business and is reviewed in the browser; a still that
 * thinned itself the same way would be arguing about the renderer when the subject is the generator.
 *
 *   node bin/renderScenery.ts [master] [--view name] [--style painted] [--zoom 9.6]
 *                             [--at lng,lat] [--city Q90|Paris] [--width 1200] [--dial 1] [--spacing 1] [--out dir]
 *
 * `--spacing` is the multiplier on every kind's `apart`, as the debug panel's is: nought is the scatter as
 * it was before experiment 0012, which is how to see what the spacing took out.
 *
 * The ruins of the towns of 1790 are stamped over the scenery wherever `world:ruins` laid them, each piece its
 * footprint in its culture's stone, and the trees thinned among them, from the same `furnishCell` the browser runs. `--city` looks at one town, by its
 * Wikidata id or its name of 1790, `--city Q90` or `--city Paris`. See docs/plans/ruined-cities.md.
 */

const masterPath = masterAt(named[0]);
const master = masterNameOf(basename(masterPath)) ?? DEFAULT_MASTER;
const layer = flag('layer') ?? 'biome';
const outputDir = flag('out') ?? PAINTERLY_DIR;
const styleName = flag('style') ?? 'painted';
const zoom = Number(flag('zoom') ?? 9.6);
const width = Math.round(Number(flag('width') ?? 1200));
const height = Math.round(width * 0.75);
const dial = Number(flag('dial') ?? 1);
const spacing = Number(flag('spacing') ?? 1);

/** World units to one output pixel. A world unit is one pixel at zoom 7, and every zoom halves it. */
const perPixel = 2 ** (7 - zoom);

interface Place {
  name: string;
  lng: number;
  lat: number;
}

const palette = JSON.parse(await readFile(PALETTE, 'utf8')) as Palette;
const render = JSON.parse(await readFile(RENDER, 'utf8')) as { colours: Record<string, string> };
const painterly = JSON.parse(await readFile(PAINTERLY, 'utf8')) as {
  styles: Record<string, PainterlyStyle>;
  views: { name: string; lng: [number, number]; lat: [number, number] }[];
};

const style: PreparedPainterly | undefined =
  styleName === 'flat'
    ? undefined
    : preparePainterly(
        painterly.styles[styleName] ??
          (() => {
            throw new Error(
              `no style called ${styleName}; there is ${Object.keys(painterly.styles).join(', ')}, and flat`,
            );
          })(),
        palette,
        render.colours,
      );

/** The flat look, for `--style flat`: the colour of the class, and nothing else. */
const flatColours = flatColoursOf(palette, render.colours);

/**
 * Where to look.
 *
 * The centre of each painterly view, minus `world`, whose centre is the middle of the Atlantic and
 * whose whole point is that it is too far out for any of this. `--at` overrides with a point.
 */
function places(): Place[] {
  const city = flag('city');
  if (city !== undefined) {
    const names = JSON.parse(
      readFileSync(resolve(OUTPUT_DIR, worldDirOf(master), 'names.json'), 'utf8'),
    ) as NamesFile;
    const town = names.names.find(
      (one) => one.kind === 'town' && (one.id === city || one.name.toLowerCase() === city.toLowerCase()),
    );
    if (town === undefined) {
      throw new Error(`no town of 1790 is ${city} on ${master}`);
    }
    return [{ name: town.name.toLowerCase().replace(/[^a-z]+/g, '-'), lng: town.at[0]!, lat: town.at[1]! }];
  }
  const at = flag('at');
  if (at !== undefined) {
    const [lng, lat] = at.split(',').map(Number);
    if (lng === undefined || lat === undefined || !Number.isFinite(lng) || !Number.isFinite(lat)) {
      throw new Error(`--at wants lng,lat, not ${at}`);
    }
    return [{ name: flag('view') ?? 'somewhere', lng, lat }];
  }
  const wanted = flag('view');
  const all = painterly.views
    .filter((view) => view.name !== 'world')
    .map((view) => ({
      name: view.name,
      lng: (view.lng[0] + view.lng[1]) / 2,
      lat: (view.lat[0] + view.lat[1]) / 2,
    }));
  const chosen = wanted === undefined ? all : all.filter((place) => place.name === wanted);
  if (chosen.length === 0) {
    throw new Error(`no view called ${wanted}; there is ${all.map((p) => p.name).join(', ')}`);
  }
  return chosen;
}

const spriteDir = resolve(OUTPUT_DIR, worldDirOf(master), 'sprites', layer);
/** The stands are not beside the rest of the sprite map: only the game server and this read them. See 0067. */
const standsDir = resolve(STANDS_DIR, standsDirOf(master, layer));

/**
 * The whole sprite map, off the disk.
 *
 * The browser fetches this a piece at a time because it cannot hold a world; here there is no reason
 * not to read all of it, and the biome raster is four megapixels of indexed PNG either way.
 */
async function readSpriteMap(): Promise<SpriteMap> {
  let file: SpriteMapFile;
  try {
    file = JSON.parse(await readFile(resolve(spriteDir, 'map.json'), 'utf8')) as SpriteMapFile;
  } catch {
    throw new Error(
      `${master} has no sprite map, so it grows nothing. ` +
        `Run npm run world:sprites --prefix frontend -- ${master}`,
    );
  }
  // A sprite map from before its stands moved out of the public folder has none where they are read now, and a
  // still with no stands in it looks like a world that grows less rather than one that needs furnishing again.
  if (!existsSync(resolve(standsDir, 'stands.json'))) {
    throw new Error(
      `${master}'s stands are not in ${standsDir}. Run npm run world:sprites --prefix frontend -- ${master}`,
    );
  }

  const decoded = PNG.sync.read(readFileSync(resolve(spriteDir, 'biomes.png')));
  return spriteMapOf(file, decoded.data, palette);
}

interface Reading {
  points: number;
  ruins: number;
  perUnit: number;
  byKind: [string, number][];
  byBiome: [string, number][];
}

/** One place, painted and then furnished, with what went into it counted on the way. */
function renderPlace(
  place: Place,
  world: ClassRaster,
  classAt: ClassSampler,
  map: SpriteMap,
  ruins: Ruins | null,
): { image: RgbImage; reading: Reading } {
  const side = world.width;
  const centreX = ((place.lng + 180) / 360) * side;
  const centreY = (0.5 - mercatorY(place.lat) / (2 * Math.PI)) * side;
  const left = centreX - (width / 2) * perPixel;
  const top = centreY - (height / 2) * perPixel;

  // Painted on the game's own lattice, as the map is; flat stands for `raw`, which draws the tiles square.
  const onTheGround = onLattice(classAt, GROUND_LATTICE);
  const pixels = new Uint8Array(width * height * 3);
  let at = 0;
  for (let row = 0; row < height; row += 1) {
    const worldY = top + (row + 0.5) * perPixel;
    for (let column = 0; column < width; column += 1) {
      const worldX = left + (column + 0.5) * perPixel;
      const colour =
        style === undefined
          ? (flatColours[classAt(worldX, worldY)] ?? flatColours[0]!)
          : paintPixel(style, onTheGround, worldX, worldY, perPixel, GROUND_LATTICE);
      pixels[at] = colour[0];
      pixels[at + 1] = colour[1];
      pixels[at + 2] = colour[2];
      at += 3;
    }
  }

  const tallest = Math.max(...map.kinds.map((kind) => kind.groundHeight));
  const kindCount = new Map<string, number>();
  const biomeCount = new Map<string, number>();
  let points = 0;

  // A ring of cells beyond the view, because a mark whose point is just outside it still hangs into it.
  const spare = 1;
  const fromCell = cellOf(left) - spare;
  const toCell = cellOf(left + width * perPixel) + spare;
  const topCell = cellOf(top) - spare;
  const bottomCell = cellOf(top + height * perPixel) + spare;

  const drawn: [number, number, ScatteredPoint][] = [];
  const pieces: RuinPiece[] = [];
  const around: RuinsAround | null =
    ruins === null
      ? null
      : {
          ground: {
            look: { ...ruins.file.look, ring: ruins.file.ring },
            side: ruins.file.world.side,
            classAt,
            water: isWater,
          },
          standsOf: ruins.standsOf,
        };
  for (let cellY = topCell; cellY <= bottomCell; cellY += 1) {
    for (let cellX = fromCell; cellX <= toCell; cellX += 1) {
      // The ground the whole world over, so a cell can space its points against its neighbours' on any
      // tile its margin reaches. See experiment 0012.
      const ground = { classAt, standsOf: biomeStands };
      const furnished = furnishCell(cellX, cellY, dial, ground, map, around, spacing);
      pieces.push(...furnished.ruins);
      for (const point of furnished.trees) {
        points += 1;
        const name = map.kinds[point.kind]?.name ?? '?';
        kindCount.set(name, (kindCount.get(name) ?? 0) + 1);
        const biome = map.names[biomeAt(map, point.x, point.y)] ?? '?';
        biomeCount.set(biome, (biomeCount.get(biome) ?? 0) + 1);
        drawn.push([(point.x - left) / perPixel, (point.y - top) / perPixel, point]);
      }
    }
  }

  // Shortest first, so the canopy is stamped over the floor rather than under it.
  drawn.sort((one, other) => one[2].height - other[2].height);
  const canvas = { pixels, width, height };
  for (const [x, y, point] of drawn) {
    stamp(canvas, x, y, point, tallest, perPixel);
  }

  // The ruins over the scenery, the furthest first.
  if (ruins !== null) {
    const { file } = ruins;
    const tallestRuin = Math.max(...file.look.pieces.map((piece) => piece.height));
    pieces.sort((one, other) => one.y - other.y);
    for (const piece of pieces) {
      const spec = file.look.pieces[piece.piece]!;
      stampRuin(
        canvas,
        (piece.x - left) / perPixel,
        (piece.y - top) / perPixel,
        piece,
        spec,
        tallestRuin,
        perPixel,
      );
    }
  }

  const share = (counts: Map<string, number>): [string, number][] =>
    [...counts.entries()].sort((one, other) => other[1] - one[1]).map(([n, c]) => [n, c / points]);

  return {
    image: { width, height, pixels },
    reading: {
      points,
      ruins: pieces.length,
      // Over the cells scattered, not the view, because that is the ground the points came off.
      perUnit: points / ((toCell - fromCell + 1) * (bottomCell - topCell + 1) * CELL * CELL),
      byKind: share(kindCount),
      byBiome: share(biomeCount),
    },
  };
}

const map = await readSpriteMap();
const biomeStands = standsReader(standsDir, map.file.world.side, map.file.world.tileUnits);
const isWater = (terrain: number): boolean =>
  palette.classes.some((one) => one.id === terrain && one.water === true);

interface Ruins {
  file: RuinsMapFile;
  standsOf: (tileX: number, tileY: number) => StandChunk;
}

/** The ruins `world:ruins` laid, or none for a master it has not laid yet: the scenery is painted without them. */
function readRuins(): Ruins | null {
  const mapFile = resolve(OUTPUT_DIR, worldDirOf(master), 'sprites', 'ruins', 'map.json');
  if (!existsSync(mapFile)) {
    console.log(`${master} has no ruins laid: run npm run world:ruins --prefix frontend -- ${master}`);
    return null;
  }
  const file = JSON.parse(readFileSync(mapFile, 'utf8')) as RuinsMapFile;
  const dir = resolve(STANDS_DIR, standsDirOf(master, 'ruins'));
  return { file, standsOf: standsReader(dir, file.world.side, file.world.tileUnits) };
}
const ruins = readRuins();
const reading = Date.now();
const world = readMaster(masterPath, palette);
console.log(
  `master ${basename(masterPath)}, ${world.width} by ${world.height}, read in ` +
    `${((Date.now() - reading) / 1000).toFixed(1)}s`,
);
const classAt = classSamplerOf(world);

await mkdir(outputDir, { recursive: true });
const deflate = (data: Uint8Array) => new Uint8Array(deflateSync(data, { level: 6 }));
const chosen = places();

console.log(
  `\n${chosen.length} place(s) in ${styleName}, ${width} by ${height} at zoom ${zoom.toFixed(1)}, ` +
    `${perPixel.toFixed(3)} world units a pixel, dial ${dial}, spacing ${spacing}\n` +
    `sprite map of ${map.file.master}, ${map.file.stands.toLocaleString()} stands, ` +
    `worked out ${map.file.at}\n`,
);

for (const place of chosen) {
  const started = Date.now();
  const { image, reading } = renderPlace(place, world, classAt, map, ruins);
  const name = `${place.name}-scenery`;
  const png = encodeRgbPng(image, deflate);
  await writeFile(resolve(outputDir, `${name}.png`), png);

  const top3 = (of: [string, number][]): string =>
    of
      .slice(0, 3)
      .map(([n, s]) => `${n} ${(s * 100).toFixed(0)}%`)
      .join(', ');
  console.log(
    `  ${`${name}.png`.padEnd(24)} ${(png.length / 1048576).toFixed(1)} MB  ` +
      `${((Date.now() - started) / 1000).toFixed(1)}s  ` +
      `${place.lng.toFixed(1)}, ${place.lat.toFixed(1)}`,
  );
  console.log(
    `  ${''.padEnd(24)} ${reading.points.toLocaleString()} marks, ` +
      `${reading.perUnit.toFixed(3)} a square unit against ${map.file.density.ceiling}`,
  );
  console.log(`  ${''.padEnd(24)} ${top3(reading.byBiome)} | ${top3(reading.byKind)}`);
  if (ruins !== null) {
    console.log(`  ${''.padEnd(24)} ${reading.ruins.toLocaleString()} pieces of ruins`);
  }
}

console.log(
  `\nMarks, not silhouettes: where the sprite map put things and how big they are, not what they` +
    ` look like.\nThe look is the running map's answer; this is the generator's.`,
);
