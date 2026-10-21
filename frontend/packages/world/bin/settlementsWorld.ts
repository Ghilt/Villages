import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

import { cultureAt, nearestCulture, parseCultureAnchors } from '../src/culture.ts';
import type { CultureFile } from '../src/culture.ts';
import { DEFAULT_MASTER, masterNameOf, worldDirOf } from '../src/masters.ts';
import type { NamesFile } from '../src/namesFile.ts';
import type { Palette } from '../src/palette.ts';
import { toRgb } from '../src/palette.ts';
import { encodeRgbPng } from '../src/png.ts';
import { parseRuins, peopleOf, reachOf, tierOf } from '../src/ruins.ts';
import {
  RuinsNear,
  besideReach,
  candidateAt,
  ruinsInOrder,
  sitesBeside,
  sitesInOpenCountry,
  sitesSoFar,
} from '../src/settlementSites.ts';
import type { Candidate, RuinPlace, Site } from '../src/settlementSites.ts';
import { parseSettlements } from '../src/settlements.ts';
import { fromWorld, toWorld } from '../src/sphere.ts';
import { CULTURES, parseStructureCatalogue } from '../src/structures.ts';
import type { Culture } from '../src/structures.ts';

import { TILE, WorldTiles } from './lib/classTiles.ts';
import { args, flag, named } from './lib/flags.ts';
import { ownFile, writtenAt } from './lib/outputs.ts';
import {
  CULTURES_FILE,
  GROUND_DIR,
  OUTPUT_DIR,
  PAINTERLY_DIR,
  PALETTE,
  RENDER,
  REPO,
  masterAt,
} from './lib/paths.ts';

/**
 * Every settlement site of 1790: where the villages and fishing villages nobody holds stand.
 *
 *   node bin/settlementsWorld.ts [master] [--picture] [--around Q90,Q85] [--scale 3]
 *
 * Reads the master's ground as its zoom-7 tiles have it - the class under every world unit, its height and its
 * rivers - its towns of 1790 from `names.json` and how big each was from `world/ruins.json`, and chooses the sites by
 * `world/settlements.json`: some beside every ruin, the rest in open country, each on a corner of the ground's lattice
 * with an id that outlives a repaint. Writes them into `world/ground/<master>/settlements.json`, which only the game
 * server reads: it raises a settlement on every site the world lacks, at the opening (decision record 0114). A
 * settlement's square is the structures' catalogue's footprint for a hamlet. With `--picture` it also draws the sites
 * over the ground around a few towns into `world/painterly/settlements/`, to look at. A minute or two, most of it
 * reading the tiles. See docs/plans/settlements-and-roads.md.
 */

const master = masterNameOf(basename(masterAt(named[0]))) ?? DEFAULT_MASTER;
const worldDir = resolve(OUTPUT_DIR, worldDirOf(master));
const started = Date.now();
const say = (line: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(1)}s] ${line}`);

// Refused before anything is read: a file that cannot be read is said, and nothing is written.
const file = parseSettlements(await readFile(resolve(REPO, 'world', 'settlements.json'), 'utf8'));
const catalogue = parseStructureCatalogue(
  await readFile(resolve(REPO, 'world', 'catalogues', 'structures.json'), 'utf8'),
);
const village = catalogue.types.find((one) => one.type === 'village');
if (village === undefined) {
  throw new Error('world/catalogues/structures.json has no village, whose footprint is a settlement square');
}
const side = village.footprint[0]!;
const ruinsFile = parseRuins(await readFile(resolve(REPO, 'world', 'ruins.json'), 'utf8'));
const palette = JSON.parse(await readFile(PALETTE, 'utf8')) as Palette & { master: { width: number } };
const render = JSON.parse(await readFile(RENDER, 'utf8')) as { colours: Record<string, string>; sea: string };
const width = palette.master.width;
const names = JSON.parse(await readFile(resolve(worldDir, 'names.json'), 'utf8')) as NamesFile;
const cultureFile = JSON.parse(
  await readFile(resolve(worldDir, 'culture', 'culture.json'), 'utf8'),
) as CultureFile;
const cultureBytes = new Uint8Array(await readFile(resolve(worldDir, 'culture', 'culture.bin')));
const anchors = parseCultureAnchors(await readFile(CULTURES_FILE, 'utf8'));
// Enough tiles kept to hold the ground about every ruin at once: some three thousand of them, under a gigabyte.
const tiles = new WorldTiles(worldDir, palette, render, 4000);

const ruins: RuinPlace[] = names.names
  .filter((one) => one.kind === 'town')
  .map((town) => {
    const { x, y } = toWorld({ lng: town.at[0]!, lat: town.at[1]! }, width);
    const people = peopleOf(ruinsFile, town.id);
    return { id: town.id, x, y, reach: reachOf(ruinsFile, people), tier: tierOf(ruinsFile, people) };
  });
say(
  `read ${master}'s ${ruins.length.toLocaleString()} towns of 1790; a settlement's square is ${side} diamonds`,
);

const ground = { classAt: tiles.classAt, heightAt: tiles.heightAt, riverAt: tiles.riverAt };
const inRuins = new RuinsNear(ruins, width);
const beside = sitesSoFar(width);
await tiles.prepareAll(
  ruins.map((ruin) => {
    const reach = besideReach(file, ruin, width, side) + side;
    return { fromX: ruin.x - reach, fromY: ruin.y - reach, toX: ruin.x + reach, toY: ruin.y + reach };
  }),
);
for (const ruin of ruinsInOrder(ruins)) {
  sitesBeside(file, ground, ruin, inRuins, beside, width, side);
}
say(`${beside.sites.length.toLocaleString()} sites beside the ruins`);

// The open country a tile at a time, row by row, so the tiles read are the few rows about the one being chosen in.
const candidates: Candidate[] = [];
const perTile = TILE / file.grid;
const across = width / TILE;
let landTiles = 0;
for (let tileY = 0; tileY < across; tileY += 1) {
  // A row and the rows either side of it, read together, before any of the row is chosen in.
  await tiles.prepare(0, (tileY - 1) * TILE, width - 1, (tileY + 2) * TILE - 1);
  for (let tileX = 0; tileX < across; tileX += 1) {
    if (!tiles.hasLand(tileX, tileY)) continue;
    landTiles += 1;
    for (let gy = tileY * perTile; gy < (tileY + 1) * perTile; gy += 1) {
      for (let gx = tileX * perTile; gx < (tileX + 1) * perTile; gx += 1) {
        const candidate = candidateAt(file, ground, gx, gy, side);
        if (candidate !== null) candidates.push(candidate);
      }
    }
  }
}
say(
  `${candidates.length.toLocaleString()} candidates in open country, over ${landTiles.toLocaleString()} tiles with land`,
);

const open = sitesInOpenCountry(file, candidates, ruins, beside.sites, width, side);
const sites = [...beside.sites, ...open].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
say(`${open.length.toLocaleString()} sites in open country`);

const placeOf = (site: Site): [number, number] => {
  const { lng, lat } = fromWorld(site.x, site.y, width);
  return [Number(lng.toFixed(7)), Number(lat.toFixed(7))];
};
const cultureOf = (site: Site): Culture => {
  const [lng, lat] = placeOf(site);
  return cultureAt(cultureFile, cultureBytes, lng, lat) ?? nearestCulture(anchors, lat, lng);
};

const at = new Date().toISOString();
const out = {
  $comment:
    'Written by npm run world:settlements: every settlement site, which the game server raises a settlement on at the opening (decision record 0114). Worked out again from world/settlements.json, the tiles, the names and the ruins, never edited.',
  master,
  at,
  sites: sites.map((site) => ({
    id: site.id,
    type: site.type,
    level: site.level,
    at: placeOf(site),
    by: site.by,
  })),
};
const groundDir = writtenAt(resolve(GROUND_DIR, master));
ownFile(resolve(groundDir, 'settlements.json'), 'the settlements');
await mkdir(groundDir, { recursive: true });
await writeFile(resolve(groundDir, 'settlements.json'), `${JSON.stringify(out)}\n`);

const count = (pick: (one: Site) => string) =>
  sites.reduce<Record<string, number>>(
    (all, one) => ({ ...all, [pick(one)]: (all[pick(one)] ?? 0) + 1 }),
    {},
  );
const types = count((one) => one.type);
const levels = count((one) => String(one.level));
const cultures = count(cultureOf);
say(
  `${sites.length.toLocaleString()} settlements: ${types['village'] ?? 0} villages and ${types['fishingVillage'] ?? 0} ` +
    `fishing villages; ${levels['1'] ?? 0} hamlets, ${levels['2'] ?? 0} villages, ${levels['3'] ?? 0} large villages`,
);
say(`in ${CULTURES.map((one) => `${cultures[one] ?? 0} ${one}`).join(', ')}`);
say(`into ${resolve(groundDir, 'settlements.json')}`);

if (args.includes('--picture')) {
  await drawPictures();
}

/**
 * The sites over the ground around a few towns of 1790: the ground in the colours it is drawn in, every ruin a ring
 * at its reach, every village a light square and every fishing village a blue one, larger a level up. Three world
 * units to a pixel unless `--scale` says otherwise, so a picture is 2,700 units across.
 */
async function drawPictures(): Promise<void> {
  const around = (flag('around') ?? 'Q90,Q85,Q1490,Q34404,Q1741').split(',');
  const unitsPerPixel = Number(flag('scale') ?? 3);
  const wide = 900;
  const high = 600;
  const colourOf = new Map(
    palette.classes.map((one) => [one.name, toRgb(render.colours[one.name] ?? render.sea)]),
  );
  const output = writtenAt(resolve(PAINTERLY_DIR, 'settlements'));
  await mkdir(output, { recursive: true });
  for (const id of around) {
    const middle = ruins.find((one) => one.id === id);
    const named1790 = names.names.find((one) => one.id === id);
    if (middle === undefined || named1790 === undefined) {
      say(`no town ${id} on ${master}`);
      continue;
    }
    const left = middle.x - (wide / 2) * unitsPerPixel;
    const top = middle.y - (high / 2) * unitsPerPixel;
    await tiles.prepare(left, top, left + wide * unitsPerPixel, top + high * unitsPerPixel);
    const pixels = new Uint8Array(wide * high * 3);
    for (let py = 0; py < high; py += 1) {
      for (let px = 0; px < wide; px += 1) {
        const terrain = tiles.classAt(left + (px + 0.5) * unitsPerPixel, top + (py + 0.5) * unitsPerPixel);
        const [red, green, blue] = colourOf.get(terrain) ?? [0, 0, 0];
        pixels.set([red * 0.7, green * 0.7, blue * 0.7], (py * wide + px) * 3);
      }
    }
    const dot = (x: number, y: number, colour: readonly number[]) => {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || py < 0 || px >= wide || py >= high) return;
      pixels.set(colour, (py * wide + px) * 3);
    };
    for (const ruin of ruins) {
      const cx = (ruin.x - left) / unitsPerPixel;
      const cy = (ruin.y - top) / unitsPerPixel;
      const radius = ruin.reach / unitsPerPixel;
      if (cx + radius < 0 || cy + radius < 0 || cx - radius > wide || cy - radius > high) continue;
      const steps = Math.max(16, Math.ceil(radius * 7));
      for (let step = 0; step < steps; step += 1) {
        const turn = (step / steps) * 2 * Math.PI;
        dot(cx + radius * Math.cos(turn), cy + radius * Math.sin(turn), [70, 60, 60]);
      }
    }
    let drawn = 0;
    for (const site of sites) {
      const cx = (site.x - left) / unitsPerPixel;
      const cy = (site.y - top) / unitsPerPixel;
      if (cx < -4 || cy < -4 || cx > wide + 4 || cy > high + 4) continue;
      const colour =
        site.type === 'fishingVillage'
          ? [90, 170, 255]
          : site.by === null
            ? [255, 244, 214]
            : [255, 196, 120];
      const half = site.level;
      for (let dy = -half; dy <= half; dy += 1)
        for (let dx = -half; dx <= half; dx += 1) dot(cx + dx, cy + dy, colour);
      drawn += 1;
    }
    const name = `${named1790.name.toLowerCase().replace(/[^a-z]+/g, '-')}.png`;
    await writeFile(
      resolve(output, name),
      encodeRgbPng({ width: wide, height: high, pixels }, (raw) => deflateSync(raw, { level: 6 })),
    );
    say(`${named1790.name}: ${drawn} sites drawn into ${resolve(output, name)}`);
  }
}
