import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { GROUND_LATTICE, alongU, alongV, frameOf } from '../src/lattice.ts';
import { DEFAULT_MASTER, masterNameOf, standsDirOf, worldDirOf } from '../src/masters.ts';
import type { NamesFile } from '../src/namesFile.ts';
import type { Palette } from '../src/palette.ts';
import {
  ROAD_KINDS,
  bridgeKindByte,
  encodeRoads,
  piecesOf,
  readRoadKind,
  roadKindByte,
} from '../src/roadRecords.ts';
import type { RoadPiece } from '../src/roadRecords.ts';
import { BRIDGEABLE, RIVER, WATER, courseBetween, unitKey } from '../src/roads/course.ts';
import type { Course, CourseGround } from '../src/roads/course.ts';
import { ruinEnds, ruinUnits, settlementEnds, settlementUnits } from '../src/roads/ends.ts';
import { placesJoined } from '../src/roads/graph.ts';
import type { RoadPlace } from '../src/roads/graph.ts';
import { chainsOf, shapeChain } from '../src/roads/network.ts';
import type { Chain, RoadEnd } from '../src/roads/network.ts';
import { UNNAMED_GROUND, networkRules, parseRoads } from '../src/roads/roadsFile.ts';
import { clearOver } from '../src/roads/shape.ts';
import { ruinsIn } from '../src/ruinLayout.ts';
import type { RuinPiece } from '../src/ruinLayout.ts';
import { RUIN_PIECES } from '../src/ruins.ts';
import type { RuinsMapFile } from '../src/ruins.ts';
import { BRIDGE_AXES, BRIDGE_KINDS } from '../src/settlementLooks.ts';
import { SETTLEMENT_SIDES } from '../src/settlementLayout.ts';
import { settlementSquare, unitsOfKm } from '../src/settlements.ts';
import type { SettlementsFiled } from '../src/settlementsFile.ts';
import { toWorld } from '../src/sphere.ts';

import { TILE, WorldTiles } from './lib/classTiles.ts';
import { args, flag, named } from './lib/flags.ts';
import { freshFolder, writtenAt } from './lib/outputs.ts';
import { GROUND_DIR, OUTPUT_DIR, PALETTE, RENDER, REPO, STANDS_DIR, masterAt } from './lib/paths.ts';
import { drawRoadPictures } from './lib/roadPictures.ts';
import { reportRoads } from './lib/roadsReport.ts';
import { standsReader } from './lib/stills.ts';

/**
 * The roads of 1790: between the settlements, and from them to the ruined towns.
 *
 *   node bin/roadsWorld.ts [master] [--picture] [--around Q90,Q85] [--scale 1.5]
 *
 * Reads the master's settlement sites from `world/ground/<master>/settlements.json`, its ruined towns from its
 * names and its ruins' records, and its ground as its zoom-7 tiles have it - the class under every world unit, its
 * height and its rivers - and joins the places by `world/roads.json`: every settlement to its neighbours and the ruins
 * near it, by the cheapest way over the ground, a river crossed only by a bridge along one of the lattice's four axes,
 * into a settlement by its streets and into a ruin by its gates. The network is cut into pieces of the stands' eight
 * bytes and written into `world/stands/<master>/roads/`, which only the game server reads and sends through the fog,
 * and how to read them into the master's `sprites/roads/map.json`, which says nothing of where any road is (decision
 * record 0115). With `--picture` it also draws the roads over the ground around a few towns into
 * `world/painterly/roads/`, to look at. A few minutes. See docs/plans/settlements-and-roads.md.
 */

const LAYER = 'roads';
const TILE_UNITS = 256;
/** How many rows of tiles the roads are routed a band at a time in, so the tiles held are the few rows about one. */
const BAND = 4 * TILE;
const OPEN_WATER = new Set(['ocean', 'shallow-sea', 'lake']);
const FRAME = frameOf(GROUND_LATTICE);
const GATE = RUIN_PIECES.indexOf('gate');

const master = masterNameOf(basename(masterAt(named[0]))) ?? DEFAULT_MASTER;
const worldDir = resolve(OUTPUT_DIR, worldDirOf(master));
const started = Date.now();
const say = (line: string) => console.log(`[${((Date.now() - started) / 1000).toFixed(1)}s] ${line}`);

// Refused before anything is read: a file that cannot be read is said, and nothing is written.
const file = parseRoads(await readFile(resolve(REPO, 'world', 'roads.json'), 'utf8'));
const rules = networkRules(file);
const palette = JSON.parse(await readFile(PALETTE, 'utf8')) as Palette & { master: { width: number } };
const render = JSON.parse(await readFile(RENDER, 'utf8')) as { colours: Record<string, string>; sea: string };
const width = palette.master.width;
const names = JSON.parse(await readFile(resolve(worldDir, 'names.json'), 'utf8')) as NamesFile;
const filed = JSON.parse(
  await readFile(resolve(GROUND_DIR, master, 'settlements.json'), 'utf8'),
) as SettlementsFiled;
const ruinsMap = JSON.parse(
  await readFile(resolve(worldDir, 'sprites', 'ruins', 'map.json'), 'utf8'),
) as RuinsMapFile;
const ruinStands = standsReader(
  resolve(STANDS_DIR, standsDirOf(master, 'ruins')),
  ruinsMap.world.side,
  ruinsMap.world.tileUnits,
);
const tiles = new WorldTiles(worldDir, palette, render, 1600);
const kmPerUnit = (y: number) => 1 / unitsOfKm(1, y, width);

// What a step onto each class costs, by its id: open water never, a river only by a bridge.
const riverId = palette.classes.find((one) => one.name === 'river')!.id;
const costById = palette.classes.map((one) =>
  OPEN_WATER.has(one.name) ? WATER : (file.ground[one.name] ?? UNNAMED_GROUND),
);
const waterIds = new Set(palette.classes.filter((one) => one.water === true).map((one) => one.id));
const barred = new Set<number>();
const ground: Omit<CourseGround, 'road'> = {
  cost: (x, y) => {
    const id = tiles.classIdAt(x, y);
    if (id === riverId) return tiles.riverAt(x, y) >= file.bridges.biggestRiver ? RIVER : BRIDGEABLE;
    return costById[id] ?? UNNAMED_GROUND;
  },
  height: tiles.heightAt,
  barred: (x, y) => barred.has(unitKey(x, y)),
};
const clear = clearOver(ground.cost, ground.barred);

/** A place a road may end at, with where it ends. */
interface Place extends RoadPlace {
  readonly ends: readonly RoadEnd[];
  readonly name: string;
}
const places: Place[] = [];

for (const site of filed.sites) {
  const { x, y } = toWorld({ lng: site.at[0], lat: site.at[1] }, width);
  const square = settlementSquare(
    Math.round(alongU(FRAME, x, y)),
    Math.round(alongV(FRAME, x, y)),
    SETTLEMENT_SIDES[site.level - 1]!,
  );
  for (const unit of settlementUnits(square)) barred.add(unit);
  places.push({ id: site.id, kind: 'settlement', x, y, ends: settlementEnds(square), name: site.name });
}
say(`read ${master}'s ${filed.sites.length.toLocaleString()} settlement sites`);

// Every ruined town laid out as the page lays it, a tile of its records at a time, for its gates and its pieces.
const once = new Map(names.names.filter((one) => one.kind === 'town').map((one) => [one.id, one]));
const towns = [...once.values()]
  .map((town) => ({
    id: town.id,
    name: town.name,
    ...toWorld({ lng: town.at[0]!, lat: town.at[1]! }, width),
  }))
  .sort((a, b) => a.y - b.y || a.x - b.x);
const ruinGround = {
  look: { ...ruinsMap.look, ring: ruinsMap.ring },
  side: ruinsMap.world.side,
  classAt: tiles.classIdAt,
  water: (terrain: number) => waterIds.has(terrain),
};
const ruinPieces = new Map<string, RuinPiece[]>();
let walled = 0;
for (const town of towns) {
  const tileUnits = ruinsMap.world.tileUnits;
  const home = ruinStands(Math.floor(town.x / tileUnits), Math.floor(town.y / tileUnits));
  let record = -1;
  for (let at = 0; at < home.count; at += 1) {
    if (Math.abs(home.x[at]! - town.x) < 0.25 && Math.abs(home.y[at]! - town.y) < 0.25) record = at;
  }
  if (record < 0) continue;
  const reach = home.reach[record]!;
  const built = reach / (1 + ruinsMap.ring);
  await tiles.prepare(town.x - reach - 2, town.y - reach - 2, town.x + reach + 2, town.y + reach + 2);
  const pieces: RuinPiece[] = [];
  for (
    let ty = Math.floor((town.y - reach) / tileUnits);
    ty <= Math.floor((town.y + reach) / tileUnits);
    ty += 1
  ) {
    for (
      let tx = Math.floor((town.x - reach) / tileUnits);
      tx <= Math.floor((town.x + reach) / tileUnits);
      tx += 1
    ) {
      const fromX = Math.max(town.x - reach, tx * tileUnits);
      const fromY = Math.max(town.y - reach, ty * tileUnits);
      const toX = Math.min(town.x + reach, (tx + 1) * tileUnits);
      const toY = Math.min(town.y + reach, (ty + 1) * tileUnits);
      pieces.push(...ruinsIn(fromX, fromY, toX, toY, ruinStands(tx, ty), ruinGround));
    }
  }
  ruinPieces.set(town.id, pieces);
  for (const unit of ruinUnits(pieces)) barred.add(unit);
  const ends = ruinEnds({ x: town.x, y: town.y, built }, pieces);
  if (pieces.some((piece) => piece.piece === GATE)) walled += 1;
  places.push({ id: town.id, kind: 'ruin', x: town.x, y: town.y, ends, name: town.name });
}
// A ruin's ends are open whatever piece stands near them, of its own town or another's, so a road can reach them.
for (const place of places) {
  if (place.kind !== 'ruin') continue;
  for (const end of place.ends) barred.delete(unitKey(Math.floor(end.x), Math.floor(end.y)));
}
say(
  `laid out ${ruinPieces.size.toLocaleString()} ruined towns for their gates, ${walled.toLocaleString()} walled`,
);

const byId = new Map(places.map((place) => [place.id, place]));
const joins = placesJoined(places, file.longestKm, kmPerUnit);
// A band of rows at a time, shortest first within it, so the tiles held are the few rows about the band.
const bandOf = (join: { a: string; b: string }) =>
  Math.floor((byId.get(join.a)!.y + byId.get(join.b)!.y) / 2 / BAND);
const ordered = joins
  .map((join, at) => ({ join, at }))
  .sort((one, other) => bandOf(one.join) - bandOf(other.join) || one.at - other.at);
say(`${joins.length.toLocaleString()} joins between ${places.length.toLocaleString()} places`);

const road = new Set<number>();
const withRoads: CourseGround = { ...ground, road: (x, y) => road.has(unitKey(x, y)) };
const courses: Course[] = [];
const reached = new Set<string>();
const joined = new Set(joins.flatMap((join) => [join.a, join.b]));
let unreached = 0;
let unreachedRuins = 0;
for (const [done, { join }] of ordered.entries()) {
  const a = byId.get(join.a)!;
  const b = byId.get(join.b)!;
  const all = [...a.ends, ...b.ends];
  const xs = all.map((one) => one.x);
  const ys = all.map((one) => one.y);
  const pad =
    rules.margin +
    0.25 * Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) +
    rules.longestSpan +
    4;
  await tiles.prepare(
    Math.min(...xs) - pad,
    Math.min(...ys) - pad,
    Math.max(...xs) + pad,
    Math.max(...ys) + pad,
  );
  let course = courseBetween(a.ends, b.ends, withRoads, rules);
  if (course === null) {
    // Round a fjord or a lake the way can stray further than a road's box allows: once more, four times as far.
    const wider = pad + 3 * rules.margin;
    await tiles.prepare(
      Math.min(...xs) - wider,
      Math.min(...ys) - wider,
      Math.max(...xs) + wider,
      Math.max(...ys) + wider,
    );
    course = courseBetween(a.ends, b.ends, withRoads, { ...rules, margin: rules.margin * 4 });
  }
  if (done % 2000 === 1999)
    say(`routed ${(done + 1).toLocaleString()} of ${ordered.length.toLocaleString()}`);
  if (course === null) {
    unreached += 1;
    if (a.kind === 'ruin' || b.kind === 'ruin') unreachedRuins += 1;
    continue;
  }
  courses.push(course);
  reached.add(a.id).add(b.id);
  for (const unit of course.units) road.add(unit);
}
say(
  `${courses.length.toLocaleString()} roads routed, ${unreached.toLocaleString()} joins no way reached, ` +
    `${unreachedRuins.toLocaleString()} of them to a ruin`,
);

const raw = chainsOf(courses, rules)
  .map((one, at) => ({ one, at }))
  .sort((a, b) => Math.floor(a.one.run[0]!.y / BAND) - Math.floor(b.one.run[0]!.y / BAND) || a.at - b.at);
const chains: Chain[] = [];
// Every line of a road checked again while its tiles are held: over a building, a ruin's piece or water, it must be none.
let entering = 0;
for (const { one } of raw) {
  const xs = one.run.map((point) => point.x);
  const ys = one.run.map((point) => point.y);
  const pad = rules.approach + 2;
  await tiles.prepare(
    Math.min(...xs) - pad,
    Math.min(...ys) - pad,
    Math.max(...xs) + pad,
    Math.max(...ys) + pad,
  );
  const chain = shapeChain(one, clear, rules);
  chains.push(chain);
  if (chain.bridge !== null) continue;
  for (let at = 0; at + 1 < chain.points.length; at += 1) {
    if (!clear(chain.points[at]!, chain.points[at + 1]!)) entering += 1;
  }
}
say(`${chains.length.toLocaleString()} stretches of road between junctions, ends and bridges`);

const kindOf = (chain: Chain) =>
  chain.bridge === null
    ? roadKindByte(chain.grade)
    : bridgeKindByte(chain.bridge.span >= file.bridges.stoneFrom ? 'stone' : 'timber', chain.bridge.axis);
const widthOf = (kind: number) => {
  const read = readRoadKind(kind);
  return read === null || 'bridge' in read ? file.widths.bridge : file.widths[read.road];
};
const pieces: RoadPiece[] = chains.flatMap((chain) => piecesOf(chain.points, kindOf(chain)));

// A piece is written into every tile its reach touches, so a tile's pieces are all that cross it (as the ruins are).
const across = Math.floor(width / TILE_UNITS);
const byTile = new Map<number, RoadPiece[]>();
for (const piece of pieces) {
  const reach = Math.hypot(piece.bx - piece.ax, piece.by - piece.ay) / 2 + widthOf(piece.kind) / 2;
  const mx = (piece.ax + piece.bx) / 2;
  const my = (piece.ay + piece.by) / 2;
  for (
    let tileY = Math.max(0, Math.floor((my - reach) / TILE_UNITS));
    tileY <= Math.min(across - 1, Math.floor((my + reach) / TILE_UNITS));
    tileY += 1
  ) {
    for (
      let tileX = Math.floor((mx - reach) / TILE_UNITS);
      tileX <= Math.floor((mx + reach) / TILE_UNITS);
      tileX += 1
    ) {
      const wrapped = ((tileX % across) + across) % across;
      const shift = (wrapped - tileX) * TILE_UNITS;
      const shifted = shift === 0 ? piece : { ...piece, ax: piece.ax + shift, bx: piece.bx + shift };
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
freshFolder(mapDir, 'the roads map');
freshFolder(standsDir, 'the roads');
await mkdir(mapDir, { recursive: true });
await mkdir(standsDir, { recursive: true });
let bytes = 0;
for (const [at, held] of [...byTile].sort((a, b) => a[0] - b[0])) {
  const tileX = at % across;
  const tileY = Math.floor(at / across);
  const chunk = encodeRoads(held, tileX, tileY, TILE_UNITS, widthOf);
  await mkdir(resolve(standsDir, String(tileX)), { recursive: true });
  await writeFile(resolve(standsDir, String(tileX), `${tileY}.bin`), chunk);
  bytes += chunk.length;
}
const at = new Date().toISOString();
// Last of the stands, so that the game server never takes a half-written folder for a finished one.
await writeFile(
  resolve(standsDir, 'stands.json'),
  `${JSON.stringify({ master, layer: LAYER, at, stands: pieces.length, chunks: byTile.size, bytes }, null, 2)}\n`,
);
const map = {
  $comment:
    'Written by npm run world:roads: how to read the roads layer of the stands. Worked out again from world/roads.json, the settlements, the ruins and the tiles, never edited.',
  master,
  layer: LAYER,
  at,
  world: { side: width, tileUnits: TILE_UNITS },
  kinds: ROAD_KINDS,
  bridges: { kinds: BRIDGE_KINDS, axes: BRIDGE_AXES },
  widths: file.widths,
  pieces: pieces.length,
  chunks: byTile.size,
  bytes,
};
// Last of all, so that a manifest never claims a world that is not finished.
await writeFile(resolve(mapDir, 'map.json'), `${JSON.stringify(map, null, 2)}\n`);

reportRoads({
  chains,
  settlements: places.filter((place) => place.kind === 'settlement'),
  reached,
  joined,
  longestKm: file.longestKm,
  stoneFrom: file.bridges.stoneFrom,
  kmPerUnit,
  say,
});
say(`${entering} stretches of road over a building, a ruin's piece or water, which must be none`);
say(
  `${pieces.length.toLocaleString()} pieces in ${byTile.size.toLocaleString()} tiles, ${(bytes / 1e6).toFixed(1)} MB, into ${standsDir}`,
);

if (args.includes('--picture')) {
  await drawRoadPictures({
    tiles,
    palette,
    render,
    chains,
    towns,
    ruinPieces,
    sites: places.filter((place) => place.kind === 'settlement'),
    around: (flag('around') ?? 'Q90,Q85,Q1490,Q34404,Q1741,Q1792').split(','),
    unitsPerPixel: Number(flag('scale') ?? 1.5),
    say,
  });
}
