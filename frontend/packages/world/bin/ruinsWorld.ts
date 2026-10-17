import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

import { cultureAt, nearestCulture, parseCultureAnchors } from '../src/culture.ts';
import type { CultureFile } from '../src/culture.ts';
import { DEFAULT_MASTER, masterNameOf, standsDirOf, worldDirOf } from '../src/masters.ts';
import type { NamesFile } from '../src/namesFile.ts';
import { encodeRgbPng } from '../src/png.ts';
import { TIERS, builtOf, parseRuins, peopleOf, reachOf, ruinStand, tierOf } from '../src/ruins.ts';
import type { RuinsMapFile, Tier } from '../src/ruins.ts';
import { fromWorld, toWorld } from '../src/sphere.ts';
import { encodeStands } from '../src/stands.ts';
import type { Stand } from '../src/stands.ts';
import { CULTURES } from '../src/structures.ts';

import { args, flag, named } from './lib/flags.ts';
import { freshFolder, writtenAt } from './lib/outputs.ts';
import {
  CULTURES_FILE,
  OUTPUT_DIR,
  PAINTERLY_DIR,
  PALETTE,
  REPO,
  STANDS_DIR,
  masterAt,
} from './lib/paths.ts';

/**
 * Every town of 1790 laid in ruins: a stand of the `ruins` layer each.
 *
 *   node bin/ruinsWorld.ts [master] [--picture]
 *
 * Reads the master's towns of 1790 from its `names.json`, where `world:names` carried them, how big each was from
 * `world/ruins.json`, and its culture map, and writes each town as one stand record - its middle, how far its ruins
 * reach, the culture they are built in, how built-up its core is, a seed - into `world/stands/<master>/ruins/`, which
 * only the game server and the scenery stills read, and how to read them into the master's `sprites/ruins/map.json`,
 * which says nothing of where any town is (decision record 0067). A town standing in a square of sea on the culture
 * map takes the culture of the place on Earth it came from; its ruins are drawn only where there is land. With
 * `--picture`, it also draws every town's ruins as rings over the culture map around a few great cities into
 * `world/painterly/ruins/`, to look at. A second or two. See docs/plans/ruined-cities.md and decision record 0101.
 */

const LAYER = 'ruins';
const TILE_UNITS = 256;

const master = masterNameOf(basename(masterAt(named[0]))) ?? DEFAULT_MASTER;
const worldDir = resolve(OUTPUT_DIR, worldDirOf(master));
const started = Date.now();
const say = (line: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(1)}s] ${line}`);

// Refused before anything is read: a file that cannot be read is said, and nothing is written.
const ruins = parseRuins(await readFile(resolve(REPO, 'world', 'ruins.json'), 'utf8'));
const side = (JSON.parse(await readFile(PALETTE, 'utf8')) as { master: { width: number } }).master.width;
const names = JSON.parse(await readFile(resolve(worldDir, 'names.json'), 'utf8')) as NamesFile;
const cultureFile = JSON.parse(
  await readFile(resolve(worldDir, 'culture', 'culture.json'), 'utf8'),
) as CultureFile;
const cultureBytes = new Uint8Array(await readFile(resolve(worldDir, 'culture', 'culture.bin')));
const anchors = parseCultureAnchors(await readFile(CULTURES_FILE, 'utf8'));
const towns = names.names.filter((one) => one.kind === 'town');
say(`read ${master}'s ${towns.length.toLocaleString()} towns of 1790 and ${ruins.towns.size} sizes`);

interface Placed {
  readonly id: string;
  readonly name: string;
  readonly stand: Stand;
  readonly tier: Tier;
  readonly atSea: boolean;
}

const placed: Placed[] = towns.map((town) => {
  const { x, y } = toWorld({ lng: town.at[0]!, lat: town.at[1]! }, side);
  const here = cultureAt(cultureFile, cultureBytes, town.at[0]!, town.at[1]!);
  const culture = here ?? nearestCulture(anchors, town.earth[1]!, town.earth[0]!);
  return {
    id: town.id,
    name: town.name,
    stand: ruinStand(ruins, { id: town.id, x, y }, CULTURES.indexOf(culture)),
    tier: tierOf(ruins, peopleOf(ruins, town.id)),
    atSea: here === null,
  };
});

// A stand is written into every tile its ruins reach, so that a cell never needs a neighbour's chunk. Across the
// edge of the world it is written as standing beside the tile it wraps into, so its offset stays small.
const across = Math.floor(side / TILE_UNITS);
const byTile = new Map<number, Stand[]>();
for (const { stand } of placed) {
  const fromX = Math.floor((stand.x - stand.reach) / TILE_UNITS);
  const toX = Math.floor((stand.x + stand.reach) / TILE_UNITS);
  const fromY = Math.max(0, Math.floor((stand.y - stand.reach) / TILE_UNITS));
  const toY = Math.min(across - 1, Math.floor((stand.y + stand.reach) / TILE_UNITS));
  for (let tileY = fromY; tileY <= toY; tileY += 1) {
    for (let tileX = fromX; tileX <= toX; tileX += 1) {
      const wrapped = ((tileX % across) + across) % across;
      const shifted = wrapped === tileX ? stand : { ...stand, x: stand.x + (wrapped - tileX) * TILE_UNITS };
      const at = tileY * across + wrapped;
      const here = byTile.get(at);
      if (here === undefined) byTile.set(at, [shifted]);
      else here.push(shifted);
    }
  }
}

const mapDir = writtenAt(resolve(worldDir, 'sprites', LAYER));
const standsDir = writtenAt(resolve(STANDS_DIR, standsDirOf(master, LAYER)));
// Both halves go, so neither outlives the other and nothing the page could fetch is left behind (0067, 0095).
freshFolder(mapDir, 'the ruins map');
freshFolder(standsDir, 'the ruins');
await mkdir(mapDir, { recursive: true });
await mkdir(standsDir, { recursive: true });

let bytes = 0;
for (const [at, stands] of [...byTile].sort((a, b) => a[0] - b[0])) {
  const tileX = at % across;
  const tileY = Math.floor(at / across);
  const chunk = encodeStands(stands, tileX, tileY, TILE_UNITS);
  await mkdir(resolve(standsDir, String(tileX)), { recursive: true });
  await writeFile(resolve(standsDir, String(tileX), `${tileY}.bin`), chunk);
  bytes += chunk.length;
}

const at = new Date().toISOString();
// Last of the stands, so that the game server never takes a half-written folder for a finished one.
await writeFile(
  resolve(standsDir, 'stands.json'),
  `${JSON.stringify({ master, layer: LAYER, at, stands: placed.length, chunks: byTile.size, bytes }, null, 2)}\n`,
);
const map: RuinsMapFile & { $comment: string } = {
  $comment:
    'Written by npm run world:ruins. Output: worked out again from world/ruins.json, the names and the culture map, never edited.',
  master,
  layer: LAYER,
  at,
  world: { side, tileUnits: TILE_UNITS },
  ring: ruins.size.ring,
  cultures: CULTURES,
  stands: placed.length,
  chunks: byTile.size,
  bytes,
};
// Last of all, so that a manifest never claims a world that is not finished.
await writeFile(resolve(mapDir, 'map.json'), `${JSON.stringify(map, null, 2)}\n`);

const count = (pick: (one: Placed) => string) =>
  placed.reduce<Record<string, number>>(
    (all, one) => ({ ...all, [pick(one)]: (all[pick(one)] ?? 0) + 1 }),
    {},
  );
const tiers = count((one) => one.tier);
const cultures = count((one) => CULTURES[one.stand.dominant]!);
say(
  `${placed.length.toLocaleString()} towns in ruins: ${TIERS.map((tier) => `${tiers[tier] ?? 0} ${tier}`).join(', ')}`,
);
say(`built in ${CULTURES.map((one) => `${cultures[one] ?? 0} ${one}`).join(', ')}`);
const atSea = placed.filter((one) => one.atSea);
say(
  `${atSea.length} stand in a square of sea, their culture from where they came from on Earth, their ruins only on land` +
    (atSea.length === 0
      ? ''
      : `: ${atSea
          .slice(0, 12)
          .map((one) => one.name)
          .join(', ')}${atSea.length > 12 ? ', ...' : ''}`),
);
say(`${byTile.size.toLocaleString()} chunks, ${(bytes / 1024).toFixed(0)} kB, into ${standsDir}`);

if (args.includes('--picture')) {
  await drawPictures();
}

/**
 * Every town's ruins as rings over the culture map, around a few great cities: the built radius solid, the overgrown
 * reach faint, the ring the colour of its tier, the land coloured by its culture and the sea dark. Three world units
 * to a pixel unless `--scale` says otherwise, so a picture is 2,700 units across.
 */
async function drawPictures(): Promise<void> {
  const around = (flag('around') ?? 'Q90,Q956,Q85,Q1489,Q84').split(',');
  const unitsPerPixel = Number(flag('scale') ?? 3);
  const width = 900;
  const height = 600;
  const LAND: Record<string, [number, number, number]> = {
    european: [58, 78, 112],
    islamic: [52, 96, 70],
    eastAsian: [110, 52, 48],
    african: [120, 96, 48],
  };
  const SEA: [number, number, number] = [18, 26, 32];
  const TIER: Record<Tier, [number, number, number]> = {
    great: [255, 236, 170],
    large: [250, 200, 120],
    city: [235, 160, 90],
    town: [210, 210, 210],
    small: [150, 150, 150],
  };
  const out = writtenAt(resolve(PAINTERLY_DIR, 'ruins'));
  await mkdir(out, { recursive: true });
  for (const id of around) {
    const middle = placed.find((one) => one.id === id);
    if (middle === undefined) {
      say(`no town ${id} on ${master}`);
      continue;
    }
    const left = middle.stand.x - (width / 2) * unitsPerPixel;
    const top = middle.stand.y - (height / 2) * unitsPerPixel;
    const pixels = new Uint8Array(width * height * 3);
    for (let py = 0; py < height; py += 1) {
      for (let px = 0; px < width; px += 1) {
        const { lng, lat } = fromWorld(
          left + (px + 0.5) * unitsPerPixel,
          top + (py + 0.5) * unitsPerPixel,
          side,
        );
        const byte = cultureAt(cultureFile, cultureBytes, lng, lat);
        pixels.set(byte === null ? SEA : LAND[byte]!, (py * width + px) * 3);
      }
    }
    const dot = (px: number, py: number, colour: readonly number[], strength: number) => {
      if (px < 0 || py < 0 || px >= width || py >= height) return;
      const at = (py * width + px) * 3;
      for (let c = 0; c < 3; c += 1) {
        pixels[at + c] = Math.round(pixels[at + c]! * (1 - strength) + colour[c]! * strength);
      }
    };
    const ring = (cx: number, cy: number, radius: number, colour: readonly number[], strength: number) => {
      const steps = Math.max(16, Math.ceil(radius * 7));
      for (let step = 0; step < steps; step += 1) {
        const turn = (step / steps) * 2 * Math.PI;
        dot(
          Math.round(cx + radius * Math.cos(turn)),
          Math.round(cy + radius * Math.sin(turn)),
          colour,
          strength,
        );
      }
    };
    let drawn = 0;
    for (const one of placed) {
      const cx = (one.stand.x - left) / unitsPerPixel;
      const cy = (one.stand.y - top) / unitsPerPixel;
      const reach = one.stand.reach / unitsPerPixel;
      if (cx + reach < 0 || cy + reach < 0 || cx - reach > width || cy - reach > height) continue;
      const people = peopleOf(ruins, one.id);
      ring(cx, cy, builtOf(ruins, people) / unitsPerPixel, TIER[one.tier], 0.9);
      ring(cx, cy, reachOf(ruins, people) / unitsPerPixel, TIER[one.tier], 0.35);
      dot(Math.round(cx), Math.round(cy), TIER[one.tier], 1);
      drawn += 1;
    }
    const file = resolve(out, `${middle.name.toLowerCase().replace(/[^a-z]+/g, '-')}.png`);
    await writeFile(
      file,
      encodeRgbPng({ width, height, pixels }, (raw) => deflateSync(raw, { level: 6 })),
    );
    say(`${middle.name}: ${drawn} towns' ruins drawn into ${file}`);
  }
}
