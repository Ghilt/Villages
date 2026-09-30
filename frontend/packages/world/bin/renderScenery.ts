import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

import { PNG } from 'pngjs';

import { growingTable } from '../src/biome.ts';
import { DEFAULT_MASTER, masterNameOf, standsDirOf, worldDirOf } from '../src/masters.ts';
import { paintPixel, preparePainterly } from '../src/painterly.ts';
import type { ClassSampler, PainterlyStyle, PreparedPainterly } from '../src/painterly.ts';
import { preparePalette, snapPrepared, toRgb } from '../src/palette.ts';
import type { Palette, Rgb } from '../src/palette.ts';
import { encodeRgbPng } from '../src/png.ts';
import type { RgbImage } from '../src/png.ts';
import { createRaster } from '../src/raster.ts';
import type { ClassRaster } from '../src/raster.ts';
import { CELL, cellOf, scatterCell } from '../src/scatter.ts';
import type { ScatteredPoint } from '../src/scatter.ts';
import { biomeAt, biomesByColour } from '../src/spriteMap.ts';
import type { SpriteMap, SpriteMapFile } from '../src/spriteMap.ts';
import { NO_STANDS, decodeStands } from '../src/stands.ts';
import type { StandChunk } from '../src/stands.ts';
import { masterRowsAt } from '../src/tiles.ts';

import { OUTPUT_DIR, PAINTERLY, PAINTERLY_DIR, PALETTE, RENDER, STANDS_DIR, masterAt } from './paths.ts';

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
 *                             [--at lng,lat] [--width 1200] [--dial 1] [--spacing 1] [--out dir]
 *
 * `--spacing` is the multiplier on every kind's `apart`, as the debug panel's is: nought is the scatter as
 * it was before experiment 0012, which is how to see what the spacing took out.
 */

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at < 0 ? undefined : args[at + 1];
};
const named = args.filter(
  (value, index) => !value.startsWith('--') && args[index - 1]?.startsWith('--') !== true,
);

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

const RADIANS = Math.PI / 180;
const mercatorY = (latitude: number): number => Math.log(Math.tan(Math.PI / 4 + (latitude * RADIANS) / 2));

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
const flatColours: Rgb[] = [];
for (let id = 0; id <= Math.max(...palette.classes.map((terrain) => terrain.id)); id += 1) {
  const terrain = palette.classes.find((candidate) => candidate.id === id);
  flatColours.push(toRgb(terrain === undefined ? '#000000' : render.colours[terrain.name]!));
}

/**
 * Where to look.
 *
 * The centre of each painterly view, minus `world`, whose centre is the middle of the Atlantic and
 * whose whole point is that it is too far out for any of this. `--at` overrides with a point.
 */
function places(): Place[] {
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

/**
 * The master, as one class per pixel. Read inside a function so the two gigabytes of RGBA that pngjs
 * hands back can be collected before any painting starts.
 */
function readMaster(): ClassRaster {
  const started = Date.now();
  const decoded = PNG.sync.read(readFileSync(masterPath));
  const world = createRaster(decoded.width, decoded.height);
  const memo = new Int16Array(1 << 24).fill(-1);
  const prepared = preparePalette(palette);

  for (let index = 0; index < world.cells.length; index += 1) {
    const at = index * 4;
    const red = decoded.data[at]!;
    const green = decoded.data[at + 1]!;
    const blue = decoded.data[at + 2]!;
    const colour = (red << 16) | (green << 8) | blue;
    let id = memo[colour]!;
    if (id < 0) {
      id = snapPrepared([red, green, blue], prepared).id;
      memo[colour] = id;
    }
    world.cells[index] = id;
  }
  console.log(
    `master ${basename(masterPath)}, ${world.width} by ${world.height}, read in ` +
      `${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  return world;
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

  const side = file.world.biomeSide;
  const decoded = PNG.sync.read(readFileSync(resolve(spriteDir, 'biomes.png')));
  const { byColour, fallback } = biomesByColour(file);
  const biomeOf = new Uint8Array(side * side);
  for (let at = 0; at < biomeOf.length; at += 1) {
    const packed =
      (decoded.data[at * 4]! << 16) | (decoded.data[at * 4 + 1]! << 8) | decoded.data[at * 4 + 2]!;
    biomeOf[at] = byColour.get(packed) ?? fallback;
  }

  return {
    file,
    biomeOf,
    cellUnits: side === 0 ? 1 : file.world.side / side,
    growing: growingTable(file.kinds, file.grows, palette),
    kinds: file.kinds,
    colours: file.biomes.map((biome) => biome.colour),
    names: file.biomes.map((biome) => biome.name),
  };
}

/** One tile's stands, read once and kept. */
const chunks = new Map<string, StandChunk>();
function standsOfTile(map: SpriteMap, tileX: number, tileY: number): StandChunk {
  const across = map.file.world.side / map.file.world.tileUnits;
  if (tileY < 0 || tileY >= across) {
    return NO_STANDS;
  }
  const wrapped = ((tileX % across) + across) % across;
  const key = `${wrapped}/${tileY}`;
  const held = chunks.get(key);
  if (held !== undefined) {
    return held;
  }
  // Most tiles are sea and have no file at all, which is not a failure: they have no stands.
  let chunk: StandChunk;
  try {
    const bytes = readFileSync(resolve(standsDir, String(wrapped), `${tileY}.bin`));
    chunk = decodeStands(
      new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      wrapped,
      tileY,
      map.file.world.tileUnits,
    );
  } catch {
    chunk = NO_STANDS;
  }
  chunks.set(key, chunk);
  return chunk;
}

/**
 * What one point is drawn as: a blob for its crown and a stroke for its stem, both in world units.
 *
 * Sized off `groundHeight` exactly as the sprite is, so the picture is to scale with the map even
 * though the shape is not the map's shape. Taller things are drawn darker, which is the one thing that
 * lets a mixed wood be read as mixed without a legend nobody wants on a still.
 */
const CROWN = 0.34;
const STEM = 0.4;

function stamp(
  pixels: Uint8Array,
  imageWidth: number,
  imageHeight: number,
  atX: number,
  atY: number,
  point: ScatteredPoint,
  tallest: number,
): void {
  const tall = point.height / perPixel;
  const radius = Math.max(0.6, tall * CROWN);
  // Nought for the floor, one for the canopy: the darker a mark is, the bigger the thing it stands for.
  const weight = tallest === 0 ? 1 : Math.min(1, point.height / tallest);
  const ink: Rgb = [
    Math.round(96 - 56 * weight),
    Math.round(112 - 58 * weight),
    Math.round(80 - 44 * weight),
  ];
  const alpha = 0.55 + 0.3 * weight;

  const blend = (x: number, y: number, cover: number): void => {
    if (cover <= 0 || x < 0 || y < 0 || x >= imageWidth || y >= imageHeight) {
      return;
    }
    const at = (y * imageWidth + x) * 3;
    const mix = Math.min(1, cover) * alpha;
    pixels[at] = Math.round(pixels[at]! * (1 - mix) + ink[0] * mix);
    pixels[at + 1] = Math.round(pixels[at + 1]! * (1 - mix) + ink[1] * mix);
    pixels[at + 2] = Math.round(pixels[at + 2]! * (1 - mix) + ink[2] * mix);
  };

  // The stem first, so the crown sits on top of it.
  const foot = atY + tall * STEM;
  for (let y = Math.floor(atY); y <= Math.ceil(foot); y += 1) {
    blend(Math.round(atX), y, 0.8);
  }

  const from = Math.floor(atX - radius - 1);
  const to = Math.ceil(atX + radius + 1);
  const top = Math.floor(atY - radius - 1);
  const bottom = Math.ceil(atY + radius + 1);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = from; x <= to; x += 1) {
      const dx = x + 0.5 - atX;
      const dy = y + 0.5 - atY;
      blend(x, y, radius + 0.5 - Math.sqrt(dx * dx + dy * dy));
    }
  }
}

interface Reading {
  points: number;
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
): { image: RgbImage; reading: Reading } {
  const side = world.width;
  const centreX = ((place.lng + 180) / 360) * side;
  const centreY = (0.5 - mercatorY(place.lat) / (2 * Math.PI)) * side;
  const left = centreX - (width / 2) * perPixel;
  const top = centreY - (height / 2) * perPixel;

  const pixels = new Uint8Array(width * height * 3);
  let at = 0;
  for (let row = 0; row < height; row += 1) {
    const worldY = top + (row + 0.5) * perPixel;
    for (let column = 0; column < width; column += 1) {
      const worldX = left + (column + 0.5) * perPixel;
      const colour =
        style === undefined
          ? (flatColours[classAt(worldX, worldY)] ?? flatColours[0]!)
          : paintPixel(style, classAt, worldX, worldY, perPixel);
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
  for (let cellY = topCell; cellY <= bottomCell; cellY += 1) {
    for (let cellX = fromCell; cellX <= toCell; cellX += 1) {
      // The ground the whole world over, so a cell can space its points against its neighbours' on any
      // tile its margin reaches. See experiment 0012.
      const ground = { classAt, standsOf: (tileX: number, tileY: number) => standsOfTile(map, tileX, tileY) };
      for (const point of scatterCell(cellX, cellY, dial, ground, map, spacing)) {
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
  for (const [x, y, point] of drawn) {
    stamp(pixels, width, height, x, y, point, tallest);
  }

  const share = (counts: Map<string, number>): [string, number][] =>
    [...counts.entries()].sort((one, other) => other[1] - one[1]).map(([n, c]) => [n, c / points]);

  return {
    image: { width, height, pixels },
    reading: {
      points,
      // Over the cells scattered, not the view, because that is the ground the points came off.
      perUnit: points / ((toCell - fromCell + 1) * (bottomCell - topCell + 1) * CELL * CELL),
      byKind: share(kindCount),
      byBiome: share(biomeCount),
    },
  };
}

const map = await readSpriteMap();
const world = readMaster();
const masterRowOf = masterRowsAt(world.width, world.height);
const classAt: ClassSampler = (x, y) => {
  const column = ((Math.floor(x) % world.width) + world.width) % world.width;
  const down = Math.min(world.width - 1, Math.max(0, Math.floor(y)));
  return world.cells[masterRowOf[down]! * world.width + column]!;
};

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
  const { image, reading } = renderPlace(place, world, classAt, map);
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
}

console.log(
  `\nMarks, not silhouettes: where the sprite map put things and how big they are, not what they` +
    ` look like.\nThe look is the running map's answer; this is the generator's.`,
);
