import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { basename, resolve } from 'node:path';

import { ACROSS_GAP, FROM_SEA, INLAND, STRANDED, riverFlow } from '../src/flow.ts';
import { toRgb } from '../src/palette.ts';
import type { Palette, Rgb } from '../src/palette.ts';
import { encodeRgbPng } from '../src/png.ts';
import { toLngLat, toPixel } from '../src/raster.ts';
import { TILE_SIZE, cutTile, mercatorRowOf, sourceColumnFor, sourceRowFor } from '../src/tiles.ts';
import { DEFAULT_MASTER, masterNameOf, worldDirOf } from '../src/masters.ts';

import { args, flag, named } from './lib/flags.ts';
import { readMaster } from './lib/master.ts';
import { freshFolder, writtenAt } from './lib/outputs.ts';
import { OUTPUT_DIR, PAINTERLY_DIR, PALETTE, RENDER, masterAt } from './lib/paths.ts';

/**
 * Which way the rivers run, cut into tiles beside the terrain for the water shader to read.
 *
 *   node bin/flowWorld.ts [master] [--bridge 6] [--along 6] [--no-stills] [--at lng,lat]
 *
 * Reads the master, works out the flow with `src/flow.ts`, and writes a tile at zoom 7 for every tile a river
 * runs through into `public/world/masters/<master>/flow/`, with `flow.json` listing them. A tile is RGB: red
 * and green are the way the water runs, on the map rather than on the master, from nought to 255 about 128;
 * blue is how big a river it is, by how much drains through it, and nought where nothing flows. A stranded
 * river, with no way to any sea or lake, is all three nought, which no flowing one can be, so the flow view in
 * the Debug map can show where the master's rivers are broken.
 *
 * Beside each goes `<y>-along.png`: how far down the river each pixel is, `along` from `src/flow.ts`, as the
 * cosine and sine of a turn every `ALONG_PERIOD` world units in red and green, so it can be filtered and still
 * wraps cleanly; blue is 255 where a river flows. The water shader lays its river ripples along it.
 *
 * Then it says how much of the river reaches the sea, how many gaps it jumped and what it left stranded, and
 * paints a few places with arrows on their rivers into `world/painterly/<place>-flow.png`.
 */

const masterPath = masterAt(named[0]);
const master = masterNameOf(basename(masterPath)) ?? DEFAULT_MASTER;
const outputDir = writtenAt(resolve(OUTPUT_DIR, worldDirOf(master), 'flow'));
const bridge = Number(flag('bridge') ?? 6);
const along = Number(flag('along') ?? 6);
const ZOOM = 7;
/** How many world units down a river the along coordinate takes to come round again. */
const ALONG_PERIOD = 64;

const started = Date.now();
const since = (): string => `${((Date.now() - started) / 1000).toFixed(1)}s`;

const palette = JSON.parse(await readFile(PALETTE, 'utf8')) as Palette;
const idsOf = (...names: string[]) =>
  new Set(palette.classes.filter((one) => names.includes(one.name)).map((one) => one.id));
const classes = { sea: idsOf('ocean', 'shallow-sea'), lake: idsOf('lake'), river: idsOf('river') };

const world = readMaster(masterPath, palette);
console.log(`read ${master}, ${world.width} by ${world.height} (${since()})`);

const flow = riverFlow(world, classes, { bridge, along });
console.log(
  `worked out the flow of ${flow.pixels.length.toLocaleString()} river and lake pixels (${since()})\n`,
);

// What it found.
const tally = [0, 0, 0, 0];
let rivers = 0;
for (let node = 0; node < flow.pixels.length; node += 1) {
  if (flow.isRiver[node] === 1) {
    rivers += 1;
    tally[flow.reached[node]!]! += 1;
  }
}
const share = (count: number) =>
  `${count.toLocaleString().padStart(10)}  ${((count / rivers) * 100).toFixed(1).padStart(5)}%`;
console.log(`river pixels                ${rivers.toLocaleString().padStart(10)}`);
console.log(`  reach the sea, joined     ${share(tally[FROM_SEA]!)}`);
console.log(`  reach it across gaps      ${share(tally[ACROSS_GAP]!)}`);
console.log(`  run into an inland lake   ${share(tally[INLAND]!)}`);
console.log(`  stranded, and still       ${share(tally[STRANDED]!)}`);
console.log(`gaps jumped, up to ${bridge} pixels  ${(flow.gaps.length / 2).toLocaleString().padStart(10)}`);

/**
 * The pieces of one kind, joined by touching, biggest first, with where each is and how much river runs into
 * it: every pixel of an inland lake is a sink of its own, so what drains into one beyond itself came down a river.
 */
function pieces(of: (node: number) => boolean): { size: number; pixel: number; fed: number }[] {
  const seen = new Uint8Array(flow.pixels.length);
  const found: { size: number; pixel: number; fed: number }[] = [];
  const stack: number[] = [];
  for (let start = 0; start < flow.pixels.length; start += 1) {
    if (seen[start] === 1 || !of(start)) continue;
    seen[start] = 1;
    stack.push(start);
    let size = 0;
    let fed = 0;
    while (stack.length > 0) {
      const node = stack.pop()!;
      size += 1;
      fed += flow.upstream[node]! - 1;
      const pixel = flow.pixels[node]!;
      for (let down = -1; down <= 1; down += 1) {
        for (let across = -1; across <= 1; across += 1) {
          const row = Math.floor(pixel / world.width) + down;
          const column = ((((pixel % world.width) + across) % world.width) + world.width) % world.width;
          if (row < 0 || row >= world.height) continue;
          const near = flow.nodeAt(row * world.width + column);
          if (near >= 0 && seen[near] === 0 && of(near)) {
            seen[near] = 1;
            stack.push(near);
          }
        }
      }
    }
    found.push({ size, pixel: flow.pixels[start]!, fed });
  }
  return found.sort((a, b) => b.size - a.size);
}
const where = (pixel: number) => {
  const { lng, lat } = toLngLat(pixel % world.width, Math.floor(pixel / world.width), world);
  return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
};

const sinks = pieces((node) => flow.isSink[node] === 1)
  .filter((sink) => sink.fed > 0)
  .sort((a, b) => b.fed - a.fed);
console.log(
  `\ninland lakes rivers run into: ${sinks.length.toLocaleString()}; the most fed, by river pixels in:`,
);
for (const sink of sinks.slice(0, 10)) {
  console.log(
    `  ${sink.fed.toLocaleString().padStart(8)} in, ${sink.size.toLocaleString().padStart(7)} lake pixels at ${where(sink.pixel)}`,
  );
}
const stranded = pieces((node) => flow.isRiver[node] === 1 && flow.reached[node] === STRANDED);
console.log(`\nstranded pieces of river: ${stranded.length.toLocaleString()}; the longest:`);
for (const piece of stranded.slice(0, 8)) {
  console.log(`  ${piece.size.toLocaleString().padStart(8)}  at ${where(piece.pixel)}`);
}

// How far down the river, smoothed over the river pixels round each, for the ripples to be laid along. The
// measure itself steps a pixel at a time, so on a river that runs diagonally in a staircase its lines of equal
// distance zigzag with the stairs, and so would every ripple; averaged over a few pixels they lie straight
// across. Pixels much further down or up, across a jumped gap or a confluence, are left out of the average.
const SMOOTHING = 2;
const smoothAlong = new Float64Array(flow.pixels.length);
for (let node = 0; node < flow.pixels.length; node += 1) {
  if (flow.isRiver[node] === 0) continue;
  const pixel = flow.pixels[node]!;
  const here = flow.along[node]!;
  let sum = 0;
  let weight = 0;
  for (let down = -SMOOTHING; down <= SMOOTHING; down += 1) {
    const row = Math.floor(pixel / world.width) + down;
    if (row < 0 || row >= world.height) continue;
    for (let over = -SMOOTHING; over <= SMOOTHING; over += 1) {
      const column = ((((pixel % world.width) + over) % world.width) + world.width) % world.width;
      const near = flow.nodeAt(row * world.width + column);
      if (near < 0 || flow.isRiver[near] === 0) continue;
      const there = flow.along[near]!;
      if (Math.abs(there - here) > 3 * SMOOTHING + 2) continue;
      sum += there;
      weight += 1;
    }
  }
  smoothAlong[node] = sum / weight;
}

// The tiles: every zoom 7 tile a river pixel lies in, flowing or stranded, and the tile rows either side,
// because towards the poles one master row is several rows of the map.
const across = 2 ** ZOOM;
const wanted = new Set<number>();
for (let node = 0; node < flow.pixels.length; node += 1) {
  if (flow.isRiver[node] === 0) continue;
  const pixel = flow.pixels[node]!;
  const row = mercatorRowOf(Math.floor(pixel / world.width), world.height, ZOOM);
  if (row === null) continue;
  const tileX = Math.floor(((pixel % world.width) / world.width) * across);
  const tileY = Math.floor(row / TILE_SIZE);
  for (const y of [tileY - 1, tileY, tileY + 1]) {
    if (y >= 0 && y < across) wanted.add(y * across + tileX);
  }
}

freshFolder(outputDir, "the rivers' flow");
const deflate = (data: Uint8Array) => new Uint8Array(deflateSync(data, { level: 6 }));
const written: string[] = [];
let bytes = 0;
const largest = Math.log2(flow.upstream.reduce((most, one) => Math.max(most, one), 1));
for (const key of [...wanted].sort((a, b) => a - b)) {
  const tileX = key % across;
  const tileY = Math.floor(key / across);
  const pixels = new Uint8Array(TILE_SIZE * TILE_SIZE * 3);
  const alongPixels = new Uint8Array(TILE_SIZE * TILE_SIZE * 3);
  const cut = cutTile(world, { zoom: ZOOM, x: tileX, y: tileY });
  let flowing = 0;
  for (let row = 0; row < TILE_SIZE; row += 1) {
    const masterRow = sourceRowFor(tileY, row, ZOOM, world.height);
    const rowFrom = sourceRowFor(tileY, row - 0.5, ZOOM, world.height);
    const rowTo = sourceRowFor(tileY, row + 0.5, ZOOM, world.height);
    // On the map a step south is longer than on the master by the secant of the latitude.
    const stretch = 1 / Math.cos(((90 - ((masterRow + 0.5) / world.height) * 180) * Math.PI) / 180);
    for (let column = 0; column < TILE_SIZE; column += 1) {
      const at = (row * TILE_SIZE + column) * 3;
      pixels[at] = 128;
      pixels[at + 1] = 128;
      alongPixels[at] = 128;
      alongPixels[at + 1] = 128;
      // River wherever the cut tile has river, which is wider than the master's by up to a pixel: the tiler
      // takes the commonest of the master pixels a tile pixel covers, and a tie goes to the river. Its flow is
      // a river pixel's among those, a flowing one before a stranded one.
      if (!classes.river.has(cut.cells[row * TILE_SIZE + column]!)) continue;
      const columnFrom = sourceColumnFor(tileX, column - 0.5, ZOOM, world.width);
      const columnTo = sourceColumnFor(tileX, column + 0.5, ZOOM, world.width);
      let node = -1;
      for (let y = rowFrom; y <= rowTo; y += 1) {
        for (let x = columnFrom; x <= columnTo; x += 1) {
          const near = flow.nodeAt(y * world.width + x);
          if (near < 0 || flow.isRiver[near] === 0) continue;
          if (node < 0 || (flow.reached[node] === STRANDED && flow.reached[near] !== STRANDED)) node = near;
        }
      }
      if (node < 0) continue;
      if (flow.reached[node] === STRANDED) {
        pixels[at] = 0;
        pixels[at + 1] = 0;
        flowing += 1;
        continue;
      }
      const east = flow.east[node]!;
      const south = flow.south[node]! * stretch;
      const length = Math.hypot(east, south);
      if (length === 0) continue;
      pixels[at] = Math.round(128 + (127 * east) / length);
      pixels[at + 1] = Math.round(128 + (127 * south) / length);
      pixels[at + 2] = Math.max(1, Math.round((Math.log2(flow.upstream[node]!) / largest) * 255));
      const turn = (smoothAlong[node]! / ALONG_PERIOD) * 2 * Math.PI;
      alongPixels[at] = Math.round(128 + 127 * Math.cos(turn));
      alongPixels[at + 1] = Math.round(128 + 127 * Math.sin(turn));
      alongPixels[at + 2] = 255;
      flowing += 1;
    }
  }
  if (flowing === 0) continue;
  const dir = resolve(outputDir, String(ZOOM), String(tileX));
  await mkdir(dir, { recursive: true });
  const png = encodeRgbPng({ width: TILE_SIZE, height: TILE_SIZE, pixels }, deflate);
  await writeFile(resolve(dir, `${tileY}.png`), png);
  const alongPng = encodeRgbPng({ width: TILE_SIZE, height: TILE_SIZE, pixels: alongPixels }, deflate);
  await writeFile(resolve(dir, `${tileY}-along.png`), alongPng);
  bytes += alongPng.length;
  written.push(`${tileX}/${tileY}`);
  bytes += png.length;
}
await writeFile(
  resolve(outputDir, 'flow.json'),
  `${JSON.stringify({
    master,
    at: new Date().toISOString(),
    zoom: ZOOM,
    bridge,
    along,
    alongPeriod: ALONG_PERIOD,
    tiles: written,
  })}\n`,
);
console.log(
  `\n${written.length.toLocaleString()} flow tiles, ${(bytes / 1048576).toFixed(1)} MB, into ${outputDir} (${since()})`,
);

// The stills: a few places at four times the master, rivers coloured by how they were reached, an arrow on
// every few pixels of them, and the gaps that were jumped drawn across.
if (!args.includes('--no-stills')) {
  // Read only here, so that what the stills are coloured in is no part of what the flow is made from.
  const render = JSON.parse(await readFile(RENDER, 'utf8')) as {
    sea: string;
    colours: Record<string, string>;
  };
  const PLACES = [
    { name: 'bohemia', lng: 14.4, lat: 50.4, says: 'the Vltava into the Elbe, north to the North Sea' },
    { name: 'rhine', lng: 6.2, lat: 51.4, says: 'the Rhine and the Maas into the North Sea' },
    { name: 'danube-delta', lng: 28.6, lat: 45.2, says: 'the Danube into the Black Sea' },
    { name: 'volga', lng: 47.0, lat: 47.5, says: 'the Volga into the Caspian, a lake with no way out' },
    { name: 'nile-delta', lng: 31.0, lat: 30.2, says: 'the Nile into the Mediterranean' },
  ];
  // `--at lng,lat` looks at one place of its own instead.
  const at = flag('at')?.split(',').map(Number);
  const chosen =
    at === undefined
      ? PLACES
      : [{ name: `at-${at[1]!.toFixed(2)}-${at[0]!.toFixed(2)}`, lng: at[0]!, lat: at[1]!, says: 'there' }];
  const SCALE = 4;
  const SPAN = { across: 240, down: 160 };
  const INK: Rgb = [40, 34, 28];
  const BY_HOW: Record<number, Rgb> = {
    [FROM_SEA]: [30, 90, 200],
    [ACROSS_GAP]: [205, 150, 20],
    [INLAND]: [20, 150, 140],
    [STRANDED]: [210, 40, 40],
  };
  const GAP: Rgb = [235, 110, 20];
  const colourOf = new Map<number, Rgb>();
  for (const one of palette.classes) {
    const base = toRgb(render.colours[one.name] ?? render.sea);
    // Land faded towards paper so the rivers stand out; water left as it is drawn.
    const faded = (c: number) => Math.round(c * 0.45 + 240 * 0.55);
    colourOf.set(one.id, one.water === true ? base : [faded(base[0]), faded(base[1]), faded(base[2])]);
  }

  await mkdir(PAINTERLY_DIR, { recursive: true });
  console.log('\nstills: blue reaches the sea, amber across a gap, teal into an inland lake, red stranded');
  for (const place of chosen) {
    const centre = toPixel(place, world);
    const left = Math.round(centre.x - SPAN.across / 2);
    const top = Math.round(centre.y - SPAN.down / 2);
    const width = SPAN.across * SCALE;
    const height = SPAN.down * SCALE;
    const image = new Uint8Array(width * height * 3);
    const put = (x: number, y: number, [r, g, b]: Rgb) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const at = (Math.floor(y) * width + Math.floor(x)) * 3;
      image[at] = r;
      image[at + 1] = g;
      image[at + 2] = b;
    };
    const line = (x0: number, y0: number, x1: number, y1: number, colour: Rgb) => {
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5) + 1;
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        put(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, colour);
      }
    };
    const counts = [0, 0, 0, 0];
    const arrows: { x: number; y: number; east: number; south: number }[] = [];
    for (let down = 0; down < SPAN.down; down += 1) {
      for (let over = 0; over < SPAN.across; over += 1) {
        const row = top + down;
        const column = (((left + over) % world.width) + world.width) % world.width;
        const pixel = row * world.width + column;
        const id = world.cells[pixel]!;
        let colour = colourOf.get(id) ?? [0, 0, 0];
        if (classes.river.has(id)) {
          const node = flow.nodeAt(pixel);
          const how = flow.reached[node]!;
          colour = BY_HOW[how]!;
          counts[how]! += 1;
          if ((column + row * 3) % 7 === 0 && how !== STRANDED) {
            arrows.push({
              x: (over + 0.5) * SCALE,
              y: (down + 0.5) * SCALE,
              east: flow.east[node]!,
              south: flow.south[node]!,
            });
          }
        }
        for (let y = 0; y < SCALE; y += 1) {
          for (let x = 0; x < SCALE; x += 1) put(over * SCALE + x, down * SCALE + y, colour);
        }
      }
    }
    for (let at = 0; at < flow.gaps.length; at += 2) {
      const [from, to] = [flow.gaps[at]!, flow.gaps[at + 1]!];
      const fx = (from % world.width) - left;
      const fy = Math.floor(from / world.width) - top;
      const tx = (to % world.width) - left;
      const ty = Math.floor(to / world.width) - top;
      if (fx < -4 || fy < -4 || fx > SPAN.across + 4 || fy > SPAN.down + 4) continue;
      line((fx + 0.5) * SCALE, (fy + 0.5) * SCALE, (tx + 0.5) * SCALE, (ty + 0.5) * SCALE, GAP);
    }
    for (const { x, y, east, south } of arrows) {
      const tipX = x + east * 7;
      const tipY = y + south * 7;
      line(x - east * 5, y - south * 5, tipX, tipY, INK);
      // The head: two strokes back from the tip, either side.
      line(tipX, tipY, tipX - (east * 4 - south * 3), tipY - (south * 4 + east * 3), INK);
      line(tipX, tipY, tipX - (east * 4 + south * 3), tipY - (south * 4 - east * 3), INK);
    }
    const name = `${place.name}-flow`;
    await writeFile(
      resolve(PAINTERLY_DIR, `${name}.png`),
      encodeRgbPng({ width, height, pixels: image }, deflate),
    );
    const total = counts.reduce((sum, one) => sum + one, 0);
    console.log(
      `  ${name.padEnd(20)} ${place.says}: ${total} river pixels, ${counts[FROM_SEA]} to the sea, ` +
        `${counts[ACROSS_GAP]} across gaps, ${counts[INLAND]} inland, ${counts[STRANDED]} stranded`,
    );
  }
}

console.log(`\ndone (${since()})`);
