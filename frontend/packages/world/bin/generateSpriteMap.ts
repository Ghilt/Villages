import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { basename, resolve } from 'node:path';

import {
  biomeProblems,
  chooseBiome,
  growingTable,
  regionAt,
  swayAt,
  warmthOfLatitude,
  wetnessOfDistance,
} from '../src/biome.ts';
import type { BiomeFile } from '../src/biome.ts';
import { toRgb } from '../src/palette.ts';
import type { Palette, Rgb } from '../src/palette.ts';
import { createRaster } from '../src/raster.ts';
import { MAX_MERCATOR_LATITUDE, toWorld } from '../src/sphere.ts';
import type { ClassRaster } from '../src/raster.ts';
import { encodeIndexedPng } from '../src/png.ts';
import { TILE_SIZE, masterRowsAt } from '../src/tiles.ts';
import {
  NO_FAVOURITE,
  PARENT_STEP,
  encodeStands,
  favouriteRoll,
  favouritesOf,
  standAt,
  standWeight,
} from '../src/stands.ts';
import type { Stand } from '../src/stands.ts';
import { DEFAULT_MASTER, masterNameOf, standsDirOf, worldDirOf } from '../src/masters.ts';
import { biomeCellOf } from '../src/spriteMap.ts';

import { args, flag, named } from './lib/flags.ts';
import { classSamplerOf, readMaster } from './lib/master.ts';
import { BIOMES, OUTPUT_DIR, PAINTERLY, PALETTE, STANDS_DIR, masterAt } from './lib/paths.ts';

/**
 * Works out what kind of place every part of the world is, and where the scenery clumps.
 *
 *   node bin/generateSpriteMap.ts [master.png] [--layer biome] [--readable] [--out directory]
 *                                 [--stands directory]
 *
 * Writes a sprite map beside the cut tiles: a biome raster in world space and a manifest, which the page
 * reads, and a list of stands chunked by zoom 7 tile into `world/stands/`, which only the game server and
 * the scenery stills read, because the gateway hands a page only the stands its fog lets through (0067).
 * The individual pieces of scenery are not in it and never will be - there
 * are seventy million of them at experiment 0006's ceiling - they come from `hash2` in the browser,
 * which is decision record 0052 and has not changed. What this decides is what they are standing in.
 *
 * A master with no sprite map draws no scenery at all, which is the rule rather than a failure mode.
 * See docs/plans/biome-sprite-map.md.
 */

const masterPath = masterAt(named[0]);
const master = masterNameOf(basename(masterPath)) ?? DEFAULT_MASTER;
const layer = flag('layer') ?? 'biome';
const outputDir = flag('out') ?? resolve(OUTPUT_DIR, worldDirOf(master), 'sprites', layer);
const standsDir = flag('stands') ?? resolve(STANDS_DIR, standsDirOf(master, layer));
const readable = args.includes('--readable');

/** The biome raster's side, in cells. One cell is sixteen world units, about twenty kilometres. */
const BIOME_SIDE = 2048;
/** How much the water distance is measured at: every fourth master pixel, which is fine enough at forty. */
const WATER_EVERY = 4;
const TILE_UNITS = TILE_SIZE;

const started = Date.now();
const since = (): string => `${((Date.now() - started) / 1000).toFixed(1)}s`;

const palette = JSON.parse(await readFile(PALETTE, 'utf8')) as Palette;
const file = JSON.parse(await readFile(BIOMES, 'utf8')) as BiomeFile;

/**
 * Checked before a single pixel is read, because the alternative is finding out about a typo eight
 * seconds and two gigabytes into a run that was going to take a minute.
 */
const problems = biomeProblems(file, palette);
if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`  ${problem.kind}: ${problem.detail}`);
  }
  throw new Error(`world/biomes.json has ${problems.length} problem(s)`);
}

const catchAll = file.biomes.length - 1;
const kindIndex = new Map(file.kinds.map((kind, index) => [kind.name, index]));
const favourites = file.biomes.map((biome) => favouritesOf(biome.grows, kindIndex));
const growing = growingTable(
  file.kinds,
  file.biomes.map((biome) => biome.grows),
  palette,
);
const highGroup = new Set(
  palette.classes.filter((terrain) => terrain.group === 'high').map((terrain) => terrain.id),
);
const water = new Set(
  palette.classes.filter((terrain) => terrain.water === true).map((terrain) => terrain.id),
);

const world = readMaster(masterPath, palette);
const WORLD_SIDE = world.width;
console.log(`read ${master}, ${world.width} by ${world.height} (${since()})`);

/**
 * How far every part of the world is from open water, in master pixels, measured on every fourth one.
 *
 * Two chamfer passes, forwards and back, which is the cheap approximation of a Euclidean distance and
 * is far more accuracy than `wetnessOfDistance` asks for: it saturates at forty and only decides whether
 * somewhere is a shore or an interior.
 */
function distanceToWater(): Uint16Array {
  const wide = Math.ceil(world.width / WATER_EVERY);
  const tall = Math.ceil(world.height / WATER_EVERY);
  const far = 0xffff;
  const grid = new Uint16Array(wide * tall).fill(far);

  for (let y = 0; y < tall; y += 1) {
    for (let x = 0; x < wide; x += 1) {
      const id = world.cells[y * WATER_EVERY * world.width + x * WATER_EVERY]!;
      if (water.has(id)) {
        grid[y * wide + x] = 0;
      }
    }
  }

  const wrap = (x: number): number => ((x % wide) + wide) % wide;
  const look = (x: number, y: number, add: number, best: number): number => {
    if (y < 0 || y >= tall) {
      return best;
    }
    const value = grid[y * wide + wrap(x)]!;
    return value + add < best ? value + add : best;
  };
  // 5 and 7 are the usual chamfer weights for a step and a diagonal at this scale, over a 3-4 kernel.
  const STEP = 5;
  const DIAGONAL = 7;

  for (let y = 0; y < tall; y += 1) {
    for (let x = 0; x < wide; x += 1) {
      let best = grid[y * wide + x]!;
      if (best === 0) {
        continue;
      }
      best = look(x - 1, y, STEP, best);
      best = look(x, y - 1, STEP, best);
      best = look(x - 1, y - 1, DIAGONAL, best);
      best = look(x + 1, y - 1, DIAGONAL, best);
      grid[y * wide + x] = Math.min(far, best);
    }
  }
  for (let y = tall - 1; y >= 0; y -= 1) {
    for (let x = wide - 1; x >= 0; x -= 1) {
      let best = grid[y * wide + x]!;
      if (best === 0) {
        continue;
      }
      best = look(x + 1, y, STEP, best);
      best = look(x, y + 1, STEP, best);
      best = look(x + 1, y + 1, DIAGONAL, best);
      best = look(x - 1, y + 1, DIAGONAL, best);
      grid[y * wide + x] = Math.min(far, best);
    }
  }
  return grid;
}

const toWater = distanceToWater();
const waterWide = Math.ceil(world.width / WATER_EVERY);
/** A chamfer counts a straight step as five, so five of them is one sampled cell, which is four pixels. */
const CHAMFER_TO_PIXELS = WATER_EVERY / 5;
console.log(`measured the distance to water (${since()})`);

/** Which master row each row of world space reads, for the latitude of a biome's cell. */
const masterRowOf = masterRowsAt(WORLD_SIDE, world.height);
const classAt = classSamplerOf(world);

/**
 * The biome of every sixteen world units, in world space rather than in the master's, so that the
 * browser can address it without converting anything.
 */
const biomes: ClassRaster = createRaster(BIOME_SIDE, BIOME_SIDE);
const cellUnits = WORLD_SIDE / BIOME_SIDE;
const landOf = new Float64Array(file.biomes.length);

for (let cellY = 0; cellY < BIOME_SIDE; cellY += 1) {
  const worldY = cellY * cellUnits + cellUnits / 2;
  const masterRow = masterRowOf[Math.min(WORLD_SIDE - 1, Math.round(worldY))]!;
  const latitude = 90 - ((masterRow + 0.5) / world.height) * 180;
  // Off the latitude, then swayed per cell: the row alone would draw every band edge as a straight
  // line the whole width of the world.
  const fromLatitude = warmthOfLatitude(latitude);

  for (let cellX = 0; cellX < BIOME_SIDE; cellX += 1) {
    const worldX = cellX * cellUnits + cellUnits / 2;
    const longitude = (worldX / WORLD_SIDE) * 360 - 180;

    // The cell's footprint sampled rather than swept: sixteen probes say what a twenty-kilometre square
    // is made of quite well enough to choose a region from, and sweeping it is 537 million reads.
    let land = 0;
    let high = 0;
    let growsHere = 0;
    for (let probe = 0; probe < 16; probe += 1) {
      const id = classAt(
        worldX + ((probe % 4) - 1.5) * (cellUnits / 4),
        worldY + (Math.floor(probe / 4) - 1.5) * (cellUnits / 4),
      );
      if (!water.has(id)) {
        land += 1;
        if (highGroup.has(id)) {
          high += 1;
        }
      }
    }

    let chosen = catchAll;
    if (land > 0) {
      const chamfer =
        toWater[Math.floor(masterRow / WATER_EVERY) * waterWide + Math.floor(worldX / WATER_EVERY)] ?? 0;
      chosen = chooseBiome(
        {
          warmth: Math.min(100, Math.max(0, fromLatitude + swayAt(longitude, latitude, file.sway))),
          wet: wetnessOfDistance(chamfer * CHAMFER_TO_PIXELS),
          high: (high / land) * 100,
          region: regionAt(longitude, latitude, file.region),
        },
        file.biomes,
      );
      growsHere = land;
    }
    biomes.cells[cellY * BIOME_SIDE + cellX] = chosen;
    landOf[chosen]! += (growsHere / 16) * cellUnits * cellUnits;
  }
}
console.log(`chose a biome for every ${cellUnits} world units (${since()})`);

const biomeAt = (worldX: number, worldY: number): number =>
  biomes.cells[biomeCellOf(BIOME_SIDE, cellUnits, worldX, worldY)]!;

/**
 * The stands. Middles from a jittered grid, taken or left by the biome's own rate, and dropped where the
 * ground under the middle grows nothing - so a stand never sits in the sea or on an ice cap.
 */
const across = Math.floor(WORLD_SIDE / TILE_UNITS);
const byTile: (Stand[] | undefined)[] = new Array<Stand[] | undefined>(across * across);
let placed = 0;

const parents = Math.floor(WORLD_SIDE / PARENT_STEP);
for (let gridY = 0; gridY < parents; gridY += 1) {
  for (let gridX = 0; gridX < parents; gridX += 1) {
    const middleY = (gridY + 0.5) * PARENT_STEP;
    const middleX = (gridX + 0.5) * PARENT_STEP;
    const biome = biomeAt(middleX, middleY);
    const rule = file.biomes[biome]!.stands;
    if (rule.per1000 <= 0) {
      continue;
    }
    const stand = standAt(gridX, gridY, rule, NO_FAVOURITE);
    if (stand === null) {
      continue;
    }
    const under = classAt(stand.x, stand.y);
    if (growing[biome * 256 + under]!.total <= 0) {
      continue;
    }

    const favourite = favourites[biome]!;
    if (favourite.total > 0) {
      const want = favouriteRoll(gridX, gridY) * favourite.total;
      let at = 0;
      while (at < favourite.upTo.length - 1 && want >= favourite.upTo[at]!) {
        at += 1;
      }
      stand.dominant = favourite.kinds[at]!;
    }

    placed += 1;
    const fromX = Math.floor((stand.x - stand.reach) / TILE_UNITS);
    const toX = Math.floor((stand.x + stand.reach) / TILE_UNITS);
    const fromY = Math.max(0, Math.floor((stand.y - stand.reach) / TILE_UNITS));
    const toY = Math.min(across - 1, Math.floor((stand.y + stand.reach) / TILE_UNITS));
    for (let tileY = fromY; tileY <= toY; tileY += 1) {
      for (let tileX = fromX; tileX <= toX; tileX += 1) {
        // A stand straddling a tile edge is written into both, so that a cell never needs a neighbour's
        // chunk. Longitude wraps, and the tile it wraps into is a real tile.
        const wrapped = ((tileX % across) + across) % across;
        const at = tileY * across + wrapped;
        (byTile[at] ??= []).push(stand);
      }
    }
  }
}
console.log(`placed ${placed.toLocaleString()} stands (${since()})`);

// Both halves go, the public one with any stands an older generator left in it, so neither can outlive the
// other and nothing the page could fetch is left behind.
await rm(outputDir, { recursive: true, force: true });
await rm(standsDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await mkdir(standsDir, { recursive: true });

let chunks = 0;
let standBytes = 0;
let widest = 0;
for (let tileY = 0; tileY < across; tileY += 1) {
  for (let tileX = 0; tileX < across; tileX += 1) {
    const here = byTile[tileY * across + tileX];
    if (here === undefined || here.length === 0) {
      continue;
    }
    if (chunks === 0 || here.length > widest) {
      widest = Math.max(widest, here.length);
    }
    const bytes = encodeStands(here, tileX, tileY, TILE_UNITS);
    const columnDir = resolve(standsDir, String(tileX));
    await mkdir(columnDir, { recursive: true });
    await writeFile(resolve(columnDir, `${tileY}.bin`), bytes);
    chunks += 1;
    standBytes += bytes.length;
  }
}

const deflate = (data: Uint8Array) => new Uint8Array(deflateSync(data, { level: 9 }));
const colours: Rgb[] = file.biomes.map((biome) => toRgb(biome.colour));
const rasterPng = encodeIndexedPng(biomes, colours, deflate);
await writeFile(resolve(outputDir, 'biomes.png'), rasterPng);

/**
 * What the world costs to furnish, checked before it is admired.
 *
 * Experiment 0006's ceiling is 0.44 points to the square world unit, found by Adam's hand rather than by
 * the machine, and a biome is a few numbers in a JSON file that nothing else would notice tripling. The
 * stands are a Poisson process, so the chance of a point falling in none of them is exp of minus the
 * expected stand area over the area - which is what turns a count of stands into a density.
 */
const areaOf = new Float64Array(file.biomes.length);
const weightOf = new Float64Array(file.biomes.length);
/** A stand is written into every tile it touches, so it is only counted in the one it stands in. */
const ownTile = (stand: Stand, tileX: number, tileY: number): boolean =>
  Math.floor(stand.x / TILE_UNITS) === tileX && Math.floor(stand.y / TILE_UNITS) === tileY;

for (let tileY = 0; tileY < across; tileY += 1) {
  for (let tileX = 0; tileX < across; tileX += 1) {
    for (const stand of byTile[tileY * across + tileX] ?? []) {
      if (!ownTile(stand, tileX, tileY)) {
        continue;
      }
      const biome = biomeAt(stand.x, stand.y);
      areaOf[biome]! += Math.PI * stand.reach * stand.reach;
      weightOf[biome]! += stand.thickness * standWeight(stand.reach);
    }
  }
}

console.log('');
let worst = { name: '-', density: 0 };
for (let index = 0; index < file.biomes.length; index += 1) {
  const biome = file.biomes[index]!;
  const ground = landOf[index]!;
  if (ground < 1000) {
    continue;
  }
  const density = biome.stands.outside + weightOf[index]! / ground;
  if (density > worst.density) {
    worst = { name: biome.name, density };
  }
  console.log(
    `  ${biome.name.padEnd(16)} ${(ground / 1e6).toFixed(1).padStart(7)} M units of land  ` +
      `${((1 - Math.exp(-areaOf[index]! / ground)) * 100).toFixed(0).padStart(3)}% under a stand  ` +
      `${density.toFixed(3)} points a unit², peak ${biome.stands.inside.toFixed(2)}`,
  );
}
console.log(
  `
worst biome ${worst.name} at ${worst.density.toFixed(3)} a unit², ` +
    `against a ceiling of ${file.ceiling} and a cap of ${file.most} on any one point`,
);
if (worst.density > file.ceiling) {
  console.log('  OVER THE CEILING - experiment 0006 says the map will lag. Thin world/biomes.json.');
}

const views = (
  JSON.parse(await readFile(PAINTERLY, 'utf8')) as {
    views: { name: string; lng: [number, number]; lat: [number, number] }[];
  }
).views;
const worldYOf = (lat: number): number =>
  toWorld({ lng: 0, lat: Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, lat)) }, WORLD_SIDE)
    .y;

/** A screenful at the closest the camera comes, on Adam's own stage. The unit the budget is felt in. */
const SCREENFUL = 67 * 52;
console.log('');
for (const view of views) {
  const left = ((view.lng[0] + 180) / 360) * WORLD_SIDE;
  const right = ((view.lng[1] + 180) / 360) * WORLD_SIDE;
  const top = worldYOf(view.lat[1]);
  const bottom = worldYOf(view.lat[0]);
  let seen = 0;
  let weight = 0;
  // The far edges are exclusive: a view ending exactly on a tile boundary would otherwise count that
  // whole column and row twice, which is a wrong number in a report about whether a number is too big.
  const lastX = Math.floor((right - 1) / TILE_UNITS);
  const lastY = Math.min(across - 1, Math.floor((bottom - 1) / TILE_UNITS));
  for (let tileY = Math.floor(top / TILE_UNITS); tileY <= lastY; tileY += 1) {
    for (let tileX = Math.floor(left / TILE_UNITS); tileX <= lastX; tileX += 1) {
      const wrapped = ((tileX % across) + across) % across;
      for (const stand of byTile[tileY * across + wrapped] ?? []) {
        if (!ownTile(stand, wrapped, tileY)) {
          continue;
        }
        if (stand.x >= left && stand.x < right && stand.y >= top && stand.y < bottom) {
          seen += 1;
          weight += stand.thickness * standWeight(stand.reach);
        }
      }
    }
  }
  const box = Math.max(1, (right - left) * (bottom - top));
  console.log(
    `  ${view.name.padEnd(14)} ${seen.toLocaleString().padStart(8)} stands, ` +
      `${(weight / box).toFixed(3)} points a unit² from them, ` +
      `about ${Math.round((weight / box) * SCREENFUL).toLocaleString()} a screenful at zoom 9.8`,
  );
}

if (readable) {
  const busiest = byTile.findIndex((here) => here !== undefined && here.length === widest);
  const tileX = busiest % across;
  const tileY = Math.floor(busiest / across);
  await writeFile(
    resolve(standsDir, 'busiest-chunk.json'),
    `${JSON.stringify(
      {
        $comment: `The fullest chunk, ${tileX}/${tileY}, as JSON. What the game server reads is the .bin.`,
        tile: { x: tileX, y: tileY, units: TILE_UNITS },
        stands: byTile[busiest]!.map((stand) => ({
          ...stand,
          dominant: stand.dominant === NO_FAVOURITE ? null : file.kinds[stand.dominant]!.name,
        })),
      },
      null,
      2,
    )}\n`,
  );
}

const at = new Date().toISOString();

/** Written last of the stands, so that the game server never takes a half-written folder for a finished one. */
await writeFile(
  resolve(standsDir, 'stands.json'),
  `${JSON.stringify({ master, layer, at, stands: placed, chunks, bytes: standBytes }, null, 2)}\n`,
);

/** Written last of all, so that a manifest never claims a world that is not finished. See tiles/cut.json. */
await writeFile(
  resolve(outputDir, 'map.json'),
  `${JSON.stringify(
    {
      master,
      layer,
      at,
      world: { side: WORLD_SIDE, tileUnits: TILE_UNITS, biomeSide: BIOME_SIDE },
      boundary: file.boundary,
      biomes: file.biomes.map((biome) => ({
        name: biome.name,
        colour: biome.colour,
        outside: biome.stands.outside,
      })),
      kinds: file.kinds,
      grows: file.biomes.map((biome) => biome.grows),
      stands: placed,
      chunks,
      bytes: standBytes,
      density: {
        worst: worst.name,
        perUnit: Number(worst.density.toFixed(4)),
        ceiling: file.ceiling,
        most: file.most,
      },
    },
    null,
    2,
  )}\n`,
);

console.log(
  `\n${placed.toLocaleString()} stands in ${chunks.toLocaleString()} chunks, ` +
    `${(standBytes / 1048576).toFixed(1)} MB, fullest ${widest.toLocaleString()} in one tile`,
);
console.log(`biomes.png ${(rasterPng.length / 1024).toFixed(0)} kB, ${BIOME_SIDE} square`);
console.log(`into ${outputDir}, and the stands into ${standsDir} (${since()})`);
