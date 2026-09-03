/**
 * Paints the experimental master image: the world as 32 terrain classes, from real Earth data.
 *
 * This is a sketch, not the pipeline. It lives beside its output rather than in packages/world because
 * nothing here is decided yet: the class list, the thresholds and the sources are all up for argument.
 * If the result is worth keeping, the parts of this that survive move into buildMaster.ts.
 *
 *   node build.mjs --source <directory of downloaded sources> [--out <directory>] [--step 2]
 *                  [--window w,s,e,n] [--width 16384]
 *
 * `--window` paints only one longitude and latitude box, at full resolution, which turns a two minute
 * run into a ten second one. That is the loop for tuning thresholds; the whole world is for looking at.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { resolve, join } from 'node:path';

import { createRaster, strokeLine, toPixel } from '../../../../frontend/packages/world/src/raster.ts';
import { encodeIndexedPng } from '../../../../frontend/packages/world/src/png.ts';

import { CLASSES, COLOUR_TABLE, closestPair, idOf } from './palette.mjs';
import { Dbf, readShapes, ringsOfGeoJson } from './shapefile.mjs';
import { TiledBigTiff } from './bigtiff.mjs';

// ---------------------------------------------------------------------------------------------------
// What the numbers are

/**
 * Where a land cover mixture becomes a terrain class.
 *
 * Every one of these is a share of the vegetated part of a master pixel, measured from about 120
 * hundred-metre samples inside it. They are the whole argument of this experiment: the Copernicus data
 * says what grows in a pixel, and these say what to call it.
 */
const T = {
  /** Below this share of usable samples, trust the ecoregion instead: too much cloud or coast. */
  minimumSamples: 0.25,

  snowIsIce: 0.5,
  waterIsLake: 0.55,

  /**
   * Herbaceous wetland is patchy in the source, so a pixel earns a wetland class on a modest share of
   * it. At 0.3 the mires of Sweden and Finland and the Siberian bogs all disappeared.
   */
  wetIsWetland: 0.15,
  wetlandHasTrees: 0.3,
  /** Enough of a pixel is under water for its fields to be paddies. */
  paddyWetness: 0.06,
  /** Below this, a flooded-grassland ecoregion still reads as floodplain rather than as its cover. */
  floodplainWetness: 0.06,

  /** The Europe number: a fifth of a pixel under the plough makes it farmed land, not forest. */
  farmedIsFarmland: 0.2,
  /** Farmed land keeps its woodlots down to this much tree cover, which is what a hedged landscape is. */
  farmlandKeepsWoods: 0.1,
  farmlandIsOpen: 0.55,

  treeIsForest: 0.55,
  treeIsWoodland: 0.25,

  shrubIsScrub: 0.35,
  herbIsGrass: 0.35,
  mossIsTundra: 0.25,
  bareIsDesert: 0.45,
  /** Utterly barren reads as sand; merely sparse reads as stone. Sand seas carry no shrubs at all. */
  bareIsSand: 0.99,
  bareIsPolarDesert: 0.4,

  /** North of this, a mire is a peat bog rather than a reed marsh. */
  bogLatitude: 48,
  /** Where heather beats maquis: shrubland this far north is moor, not Mediterranean scrub. */
  heathLatitude: 50,
  polarLatitude: 66,

  /**
   * The largest lake still drawn as a disc from its pour point, as a radius in pixels.
   *
   * Only 986 of HydroLAKES' 1.43 million lakes are bigger than this, and Natural Earth carries all of
   * them with a real outline. Above the cap the disc is dropped rather than drawn: a circle the size of
   * Vanern painted straight over Vanern's own coastline.
   */
  maximumLakeDiscRadius: 4,

  /**
   * The smallest river worth a pixel, as a Strahler order.
   *
   * A master pixel is two and a half kilometres wide, so a first-order ditch drawn one pixel wide is a
   * river two and a half kilometres across. There are 4.4 million of those. Order three laced every
   * continent with water until it read as nothing but drainage, so this is five: a river a person would
   * name and expect to need a bridge for. The named rivers of Natural Earth are drawn regardless.
   */
  minimumRiverOrder: 5,

  /**
   * Terrain that keeps its own class where a river claims to cross it.
   *
   * HydroRIVERS is derived from a terrain model rather than from water, so it carries the drainage a
   * landscape would have if it rained: the Sahara comes threaded with wadis that hold water a few days a
   * decade. The same problem as its rivers across the Greenland ice sheet, and the same answer. The named
   * rivers that really do cross deserts, the Nile above all, come from Natural Earth afterwards and are
   * not affected.
   */
  tooDryForRivers: ['desert-sand', 'desert-stone', 'salt-flat', 'polar-desert'],
};

/** Copernicus class values, grouped into the things the decision actually asks about. */
const GROUP = {
  sea: 0,
  water: 1,
  wet: 2,
  crop: 3,
  urban: 4,
  shrub: 5,
  herb: 6,
  moss: 7,
  bare: 8,
  snow: 9,
  needleClosed: 10,
  broadClosed: 11,
  mixedClosed: 12,
  needleOpen: 13,
  broadOpen: 14,
  mixedOpen: 15,
};
const GROUP_COUNT = 16;

/** value in the Copernicus discrete map -> group, or 255 for "tells us nothing". */
const GROUP_OF_VALUE = (() => {
  const lut = new Uint8Array(256).fill(255);
  lut[200] = GROUP.sea;
  lut[80] = GROUP.water;
  lut[90] = GROUP.wet;
  lut[40] = GROUP.crop;
  lut[50] = GROUP.urban;
  lut[20] = GROUP.shrub;
  lut[30] = GROUP.herb;
  lut[100] = GROUP.moss;
  lut[60] = GROUP.bare;
  lut[70] = GROUP.snow;
  lut[111] = GROUP.needleClosed; // closed, evergreen needleleaf
  lut[113] = GROUP.needleClosed; // closed, deciduous needleleaf
  lut[112] = GROUP.broadClosed; // closed, evergreen broadleaf
  lut[114] = GROUP.broadClosed; // closed, deciduous broadleaf
  lut[115] = GROUP.mixedClosed;
  lut[116] = GROUP.mixedClosed; // closed, type not known
  lut[121] = GROUP.needleOpen;
  lut[123] = GROUP.needleOpen;
  lut[122] = GROUP.broadOpen;
  lut[124] = GROUP.broadOpen;
  lut[125] = GROUP.mixedOpen;
  lut[126] = GROUP.mixedOpen;
  return lut;
})();

/**
 * The class an ecoregion's biome falls back to, where the land cover map does not reach or has nothing to
 * say. This is the world the previous master painted, and it is still what holds the poles together.
 */
const BIOME_CLASS = {
  1: 'rainforest',
  2: 'dry-forest',
  3: 'conifer-forest',
  4: 'mixed-forest',
  5: 'conifer-forest',
  6: 'taiga',
  7: 'savanna',
  8: 'steppe',
  9: 'floodplain',
  10: 'alpine-meadow',
  11: 'tundra',
  12: 'scrub',
  13: 'desert-stone',
  14: 'mangrove',
};

/**
 * Ecoregion names that deserve better than their biome's default.
 *
 * The RESOLVE data holds 847 ecoregions and the old master collapsed them to fourteen biomes, which is
 * why the whole of Europe came out one colour. Matched in order, first hit wins.
 */
const ECOREGION_HINTS = [
  [/coastal conifer|taiga|boreal/i, 'taiga'],
  [/high arctic|arctic desert/i, 'polar-desert'],
  [/tundra/i, 'tundra'],
  [/mire|bog|peat/i, 'bog'],
  [/heath|moorland|caledon/i, 'heath'],
  [/broadleaf forests?$/i, 'broadleaf-forest'],
  [/mixed forests?$/i, 'mixed-forest'],
  [/steppe/i, 'steppe'],
  [/mangroves?/i, 'mangrove'],
  [/salt (marsh|pan|desert)|halophytic/i, 'salt-flat'],
  [/sand (desert|sea)|erg |dunes?/i, 'desert-sand'],
  [/swamp|flooded forest|varzea|igapo/i, 'swamp-forest'],
  [/páramo|paramo|puna|alpine/i, 'alpine-meadow'],
  [/rock and ice|glacier/i, 'ice'],
];

// ---------------------------------------------------------------------------------------------------
// Arguments

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
}
const HERE = import.meta.dirname;
const SOURCE = resolve(args.get('source') ?? resolve(HERE, '../../../source'));
const OUT = resolve(args.get('out') ?? resolve(HERE, '..'));
const STEP = Number(args.get('step') ?? 2);
const WIDTH = Number(args.get('width') ?? 16384);
const HEIGHT = WIDTH / 2;
const WINDOW = args.has('window')
  ? (([w, s, e, n]) => ({ w, s, e, n }))(args.get('window').split(',').map(Number))
  : null;

const started = Date.now();
const say = (message) => {
  const seconds = ((Date.now() - started) / 1000).toFixed(0).padStart(4);
  console.log(`${seconds}s  ${message}`);
};

const problems = closestPair();
say(`${CLASSES.length} classes, closest pair ${problems.distance.toFixed(1)} apart (${problems.a} / ${problems.b})`);
say(`painting ${WIDTH} by ${HEIGHT}${WINDOW ? `, window ${JSON.stringify(WINDOW)}` : ''}, sampling every ${STEP}`);

/**
 * How much wider the master is than the size the thresholds in `T` were chosen against. Anything in
 * `T` measured in pixels is multiplied by this, so that doubling the resolution makes features finer
 * rather than changing which of them exist: without it, a higher resolution would push every small
 * lake past the disc cap and lose it.
 */
const SCALE = WIDTH / 16384;

const raster = createRaster(WIDTH, HEIGHT, idOf.ocean);
/** The biome of each pixel, kept beside the classes because the land cover decision asks about climate. */
const biomes = new Uint8Array(WIDTH * HEIGHT);

const inWindow = (lng, lat) =>
  WINDOW === null || (lng >= WINDOW.w && lng <= WINDOW.e && lat >= WINDOW.s && lat <= WINDOW.n);

/**
 * Whether a feature is worth drawing at all under `--window`.
 *
 * Overlap, not centre: Eurasia's bounding box has its middle in Kazakhstan, so a centre test drops the
 * continent when you ask to look at Sweden.
 */
const overlapsWindow = (box) =>
  WINDOW === null ||
  (box.east >= WINDOW.w && box.west <= WINDOW.e && box.north >= WINDOW.s && box.south <= WINDOW.n);

// ---------------------------------------------------------------------------------------------------
// Painting helpers

/** Pixel bounds of a set of rings, so a feature can be tested and clipped before it is drawn. */
function pixelBounds(rings) {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }
  return { west, east, south, north };
}

const ascending = (a, b) => a - b;

/**
 * Fills a polygon into one or more rasters at once, by the even-odd rule.
 *
 * Same rule and same rounding as fillPolygon in packages/world, but with an active edge list instead of
 * a sweep over every edge on every scanline. The ecoregion layer holds one feature — "Rock and Ice" —
 * whose rings circle the whole globe, and the straightforward version spent a minute and a half on it.
 *
 * Filling several rasters together matters for the same reason: the class and the biome of a pixel come
 * from the same polygon, and crossing its edges twice would cost twice.
 */
function fillRings(rings, writes) {
  const edges = [];
  let top = Infinity;
  let bottom = -Infinity;

  for (const ring of rings) {
    for (let i = 0; i < ring.length; i += 1) {
      const from = ring[i];
      const to = ring[(i + 1) % ring.length];
      const ay = ((90 - from[1]) / 180) * HEIGHT;
      const by = ((90 - to[1]) / 180) * HEIGHT;
      if (ay === by) {
        continue; // A horizontal edge crosses no scanline centre.
      }
      const ax = ((from[0] + 180) / 360) * WIDTH;
      const bx = ((to[0] + 180) / 360) * WIDTH;
      const downward = ay < by;
      edges.push({
        yTop: downward ? ay : by,
        yBottom: downward ? by : ay,
        xAtTop: downward ? ax : bx,
        slope: (bx - ax) / (by - ay),
      });
      if (Math.min(ay, by) < top) top = Math.min(ay, by);
      if (Math.max(ay, by) > bottom) bottom = Math.max(ay, by);
    }
  }
  if (edges.length === 0) {
    return;
  }

  const firstRow = Math.max(0, Math.ceil(top - 0.5));
  const lastRow = Math.min(HEIGHT - 1, Math.floor(bottom - 0.5));
  if (lastRow < firstRow) {
    return;
  }

  /** Edges keyed by the first scanline they touch, so a row only ever looks at what has arrived. */
  const arriving = new Map();
  for (const edge of edges) {
    const row = Math.max(firstRow, Math.ceil(edge.yTop - 0.5));
    if (row > lastRow) {
      continue;
    }
    const bucket = arriving.get(row);
    if (bucket === undefined) {
      arriving.set(row, [edge]);
    } else {
      bucket.push(edge);
    }
  }

  let active = [];
  const crossings = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    const incoming = arriving.get(row);
    if (incoming !== undefined) {
      for (const edge of incoming) {
        active.push(edge);
      }
    }
    if (active.length === 0) {
      continue;
    }
    const scanline = row + 0.5;
    crossings.length = 0;
    let keep = 0;
    for (let i = 0; i < active.length; i += 1) {
      const edge = active[i];
      if (scanline >= edge.yBottom) {
        continue; // Done with it, and dropping it here is what keeps the list short.
      }
      active[keep] = edge;
      keep += 1;
      if (scanline >= edge.yTop) {
        crossings.push(edge.xAtTop + (scanline - edge.yTop) * edge.slope);
      }
    }
    active.length = keep;
    if (crossings.length < 2) {
      continue;
    }
    crossings.sort(ascending);
    for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
      const from = Math.max(0, Math.ceil(crossings[pair] - 0.5));
      const to = Math.min(WIDTH - 1, Math.floor(crossings[pair + 1] - 0.5));
      if (to < from) {
        continue;
      }
      for (const write of writes) {
        write.cells.fill(write.value, row * WIDTH + from, row * WIDTH + to + 1);
      }
    }
  }
}

/** A single pixel, clamped to the image. The smallest thing this build can say. */
function stamp(lng, lat, value) {
  const { x, y } = toPixel({ lng, lat }, raster);
  const column = Math.min(WIDTH - 1, Math.max(0, Math.floor(x)));
  const row = Math.min(HEIGHT - 1, Math.max(0, Math.floor(y)));
  raster.cells[row * WIDTH + column] = value;
}

/**
 * Fills a polygon, and if it is too small to survive a scanline fill, draws its bounding box instead.
 *
 * This is the whole reason the new master has lakes in it. An even-odd fill needs two crossings on a
 * pixel-centre row, so 95.8% of the world's lakes — every one under about three square kilometres —
 * painted nothing at all and said nothing about it.
 */
function fillAtLeastOnePixel(rings, writes) {
  const box = pixelBounds(rings);
  if (!Number.isFinite(box.west)) {
    return;
  }
  const a = toPixel({ lng: box.west, lat: box.north }, raster);
  const b = toPixel({ lng: box.east, lat: box.south }, raster);
  if (b.x - a.x < 1 || b.y - a.y < 1) {
    const x0 = Math.max(0, Math.floor(a.x));
    const x1 = Math.min(WIDTH - 1, Math.floor(b.x));
    const y0 = Math.max(0, Math.floor(a.y));
    const y1 = Math.min(HEIGHT - 1, Math.floor(b.y));
    for (let row = y0; row <= y1; row += 1) {
      for (const write of writes) {
        write.cells.fill(write.value, row * WIDTH + x0, row * WIDTH + x1 + 1);
      }
    }
    return;
  }
  fillRings(rings, writes);
}

/** A round blob of a given radius in pixels, for a lake known only by its position and its area. */
function stampDisc(lng, lat, radius, value) {
  if (radius <= 0.75) {
    stamp(lng, lat, value);
    return;
  }
  const centre = toPixel({ lng, lat }, raster);
  const reach = Math.ceil(radius);
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      if (Math.hypot(dx, dy) > radius) {
        continue;
      }
      const column = Math.floor(centre.x) + dx;
      const row = Math.floor(centre.y) + dy;
      if (column < 0 || row < 0 || column >= WIDTH || row >= HEIGHT) {
        continue;
      }
      raster.cells[row * WIDTH + column] = value;
    }
  }
}

/** Draws a line, cut wherever it jumps the antimeridian, which would otherwise streak across the world. */
function strokeAcross(path, value, width) {
  let run = [];
  for (let i = 0; i < path.length; i += 1) {
    if (i > 0 && Math.abs(path[i][0] - path[i - 1][0]) > 180) {
      if (run.length > 1) strokeLine(raster, run, value, width);
      run = [];
    }
    run.push(path[i]);
  }
  if (run.length > 1) {
    strokeLine(raster, run, value, width);
  } else if (run.length === 1) {
    stamp(run[0][0], run[0][1], value);
  }
}

const geojson = (name) => JSON.parse(readFileSync(join(SOURCE, `${name}.geojson`), 'utf8'));

/** One GeoJSON layer, painted in a single class. */
function paintGeoJson(name, className, { lineWidth, minimumOnePixel = false } = {}) {
  const value = idOf[className];
  const collection = geojson(name);
  let painted = 0;
  for (const feature of collection.features) {
    const rings = ringsOfGeoJson(feature.geometry);
    if (rings.length === 0) {
      continue;
    }
    if (!overlapsWindow(pixelBounds(rings))) {
      continue;
    }
    if (lineWidth !== undefined) {
      for (const line of rings) {
        strokeAcross(line, value, lineWidth);
      }
    } else if (minimumOnePixel) {
      fillAtLeastOnePixel(rings, [{ cells: raster.cells, value }]);
    } else {
      fillRings(rings, [{ cells: raster.cells, value }]);
    }
    painted += 1;
  }
  say(`${name.padEnd(38)} ${String(painted).padStart(7)} features as ${className}`);
}

// ---------------------------------------------------------------------------------------------------
// The sea floor, the land, and what grows on it

// Natural Earth's bathymetry polygons are the water DEEPER than each isobath, so K_200 is the deep
// ocean, not the shelf. The shelf is what is left when the deep is painted back over a shallow world.
raster.cells.fill(idOf['shallow-sea']);
paintGeoJson('ne_10m_bathymetry_K_200', 'ocean');
paintGeoJson('ne_10m_land', 'meadow');
paintGeoJson('ne_10m_minor_islands', 'meadow', { minimumOnePixel: true });

{
  const shp = join(SOURCE, 'eco', 'Ecoregions2017.shp');
  const dbf = new Dbf(join(SOURCE, 'eco', 'Ecoregions2017.dbf'), ['BIOME_NUM', 'ECO_NAME']);
  let painted = 0;
  const hinted = new Map();
  for (const shape of readShapes(shp)) {
    const { BIOME_NUM: biome, ECO_NAME: name } = dbf.at(shape.index);
    if (!overlapsWindow(pixelBounds(shape.rings))) {
      continue;
    }
    let className = BIOME_CLASS[biome];
    for (const [pattern, hint] of ECOREGION_HINTS) {
      if (pattern.test(name)) {
        className = hint;
        hinted.set(hint, (hinted.get(hint) ?? 0) + 1);
        break;
      }
    }
    if (className === undefined) {
      continue;
    }
    // The biome travels in its own raster: the land cover decision needs to know whether a forest of
    // needleleaf trees is taiga or a temperate plantation, and only the ecoregion knows that.
    fillAtLeastOnePixel(shape.rings, [
      { cells: raster.cells, value: idOf[className] },
      { cells: biomes, value: biome },
    ]);
    painted += 1;
  }
  dbf.close();
  say(`ecoregions                             ${String(painted).padStart(7)} features, ${hinted.size} names beat their biome`);
}

// ---------------------------------------------------------------------------------------------------
// The land cover map: a hundred metres, aggregated into what a two and a half kilometre pixel is like

/** Decides one pixel from its mixture. Every threshold it consults is in T, at the top of this file. */
function classify(f, biome, lat, fallback) {
  // Boreal by biome, never by latitude. A latitude test made taiga of southern Sweden, the Baltic
  // states and the whole Russian mixed-forest belt, which are temperate conifer and mixed forest.
  const boreal = biome === 6 || biome === 11;
  const tropicalMoist = biome === 1;
  const tropicalDry = biome === 2 || biome === 3 || biome === 7;

  if (f.snow > T.snowIsIce) return idOf.ice;
  if (f.water > T.waterIsLake) return idOf.lake;

  if (biome === 9 && f.wet > T.floodplainWetness) return idOf.floodplain;

  if (f.wet > T.wetIsWetland) {
    if (f.tree > T.wetlandHasTrees) return idOf['swamp-forest'];
    if (boreal || lat > T.bogLatitude) return idOf.bog;
    return idOf.marsh;
  }

  if (biome === 14) return idOf.mangrove;

  const farmed = f.crop + f.urban;
  if (farmed > T.farmedIsFarmland) {
    if (f.wet > T.paddyWetness && Math.abs(lat) < 40) return idOf.paddy;
    if (f.tree > T.farmlandKeepsWoods && farmed < T.farmlandIsOpen) return idOf['farmland-with-woods'];
    return idOf.farmland;
  }

  if (f.tree > T.treeIsForest) {
    const open = f.treeOpen > f.treeClosed;
    if (f.needle >= f.broad && f.needle >= f.mixedLeaf) {
      if (boreal) return open ? idOf['taiga-open'] : idOf.taiga;
      return idOf['conifer-forest'];
    }
    if (f.broad >= f.mixedLeaf) {
      if (tropicalMoist) return idOf.rainforest;
      if (tropicalDry) return idOf['dry-forest'];
      return idOf['broadleaf-forest'];
    }
    if (boreal) return open ? idOf['taiga-open'] : idOf.taiga;
    return idOf['mixed-forest'];
  }

  if (f.tree > T.treeIsWoodland) {
    if (boreal) return idOf['taiga-open'];
    if (tropicalDry || tropicalMoist) return f.herb > f.tree ? idOf.savanna : idOf['dry-forest'];
    if (f.herb > f.shrub) return idOf.meadow;
    return lat > T.heathLatitude ? idOf.heath : idOf.scrub;
  }

  if (f.shrub > T.shrubIsScrub) {
    if (lat > T.heathLatitude) return idOf.heath;
    if (biome === 13) return idOf['desert-stone'];
    return idOf.scrub;
  }

  if (f.herb > T.herbIsGrass) {
    if (biome === 10) return idOf['alpine-meadow'];
    if (biome === 7 || biome === 9) return idOf.savanna;
    if (biome === 8) return idOf.steppe;
    if (biome === 11 || Math.abs(lat) > T.polarLatitude) return idOf.tundra;
    return idOf.meadow;
  }

  if (f.moss > T.mossIsTundra) {
    return f.bare > T.bareIsPolarDesert ? idOf['polar-desert'] : idOf.tundra;
  }

  if (f.bare > T.bareIsDesert) {
    if (Math.abs(lat) > T.polarLatitude) return idOf['polar-desert'];
    if (biome === 10 || biome === 11) return idOf['bare-rock'];
    if (f.bare > T.bareIsSand) return idOf['desert-sand'];
    if (biome === 13) return idOf['desert-stone'];
    return idOf['bare-rock'];
  }

  return fallback;
}

{
  const path = join(SOURCE, 'LC100.tif');
  if (!existsSync(path)) {
    say('LC100.tif is missing: skipping the land cover pass, which is most of the point');
  } else {
    const tif = new TiledBigTiff(path);
    say(`land cover ${tif.width} by ${tif.height} at ${(1 / tif.degreesPerPixel).toFixed(0)} px/deg, ${tif.tileRows} tile rows`);

    // Which master column each source column falls in, worked out once.
    const columnOf = new Uint16Array(tif.width);
    for (let x = 0; x < tif.width; x += 1) {
      const lng = tif.longitudeOfColumn(x);
      columnOf[x] = Math.min(WIDTH - 1, Math.max(0, Math.floor(((lng + 180) / 360) * WIDTH)));
    }
    const windowFrom = WINDOW === null ? 0 : Math.max(0, Math.floor((WINDOW.w - tif.westEdge) / tif.degreesPerPixel));
    const windowTo = WINDOW === null ? tif.width : Math.min(tif.width, Math.ceil((WINDOW.e - tif.westEdge) / tif.degreesPerPixel));

    const counts = new Uint16Array(WIDTH * GROUP_COUNT);
    let currentRow = -1;
    let decided = 0;
    const shares = {};

    const flush = (masterRow) => {
      if (masterRow < 0) {
        return;
      }
      const lat = 90 - (masterRow + 0.5) * (180 / HEIGHT);
      for (let column = 0; column < WIDTH; column += 1) {
        const at = column * GROUP_COUNT;
        const needleClosed = counts[at + GROUP.needleClosed];
        const broadClosed = counts[at + GROUP.broadClosed];
        const mixedClosed = counts[at + GROUP.mixedClosed];
        const needleOpen = counts[at + GROUP.needleOpen];
        const broadOpen = counts[at + GROUP.broadOpen];
        const mixedOpen = counts[at + GROUP.mixedOpen];
        const treeClosed = needleClosed + broadClosed + mixedClosed;
        const treeOpen = needleOpen + broadOpen + mixedOpen;
        const land =
          treeClosed +
          treeOpen +
          counts[at + GROUP.water] +
          counts[at + GROUP.wet] +
          counts[at + GROUP.crop] +
          counts[at + GROUP.urban] +
          counts[at + GROUP.shrub] +
          counts[at + GROUP.herb] +
          counts[at + GROUP.moss] +
          counts[at + GROUP.bare] +
          counts[at + GROUP.snow];
        const samples = land + counts[at + GROUP.sea];
        if (samples === 0 || land / samples < T.minimumSamples) {
          continue;
        }
        const cell = masterRow * WIDTH + column;
        const fallback = raster.cells[cell];
        // Only land already claimed by a coastline gets a land cover class: the two datasets disagree
        // along every shore, and the coastline is the one the game's water mask comes from.
        if (fallback === idOf.ocean || fallback === idOf['shallow-sea']) {
          continue;
        }
        shares.tree = (treeClosed + treeOpen) / land;
        shares.treeClosed = treeClosed / land;
        shares.treeOpen = treeOpen / land;
        shares.needle = (needleClosed + needleOpen) / land;
        shares.broad = (broadClosed + broadOpen) / land;
        shares.mixedLeaf = (mixedClosed + mixedOpen) / land;
        shares.water = counts[at + GROUP.water] / land;
        shares.wet = counts[at + GROUP.wet] / land;
        shares.crop = counts[at + GROUP.crop] / land;
        shares.urban = counts[at + GROUP.urban] / land;
        shares.shrub = counts[at + GROUP.shrub] / land;
        shares.herb = counts[at + GROUP.herb] / land;
        shares.moss = counts[at + GROUP.moss] / land;
        shares.bare = counts[at + GROUP.bare] / land;
        shares.snow = counts[at + GROUP.snow] / land;
        raster.cells[cell] = classify(shares, biomes[cell], lat, fallback);
        decided += 1;
      }
      counts.fill(0);
    };

    const rowsPerMaster = 1 / tif.degreesPerPixelY / (HEIGHT / 180);
    for (let tileRow = 0; tileRow < tif.tileRows; tileRow += 1) {
      const firstSourceRow = tileRow * tif.tileHeight;
      const lastSourceRow = Math.min(tif.height, firstSourceRow + tif.tileHeight);
      if (WINDOW !== null) {
        const north = tif.latitudeOfRow(firstSourceRow);
        const south = tif.latitudeOfRow(lastSourceRow - 1);
        if (north < WINDOW.s || south > WINDOW.n) {
          continue;
        }
      }
      const rows = tif.tileRow(tileRow);
      for (let sourceRow = firstSourceRow; sourceRow < lastSourceRow; sourceRow += STEP) {
        const lat = tif.latitudeOfRow(sourceRow);
        const masterRow = Math.min(HEIGHT - 1, Math.max(0, Math.floor(((90 - lat) / 180) * HEIGHT)));
        if (masterRow !== currentRow) {
          flush(currentRow);
          currentRow = masterRow;
        }
        const base = (sourceRow - firstSourceRow) * tif.rowStride;
        for (let x = windowFrom; x < windowTo; x += STEP) {
          const group = GROUP_OF_VALUE[rows[base + x]];
          if (group !== 255) {
            counts[columnOf[x] * GROUP_COUNT + group] += 1;
          }
        }
      }
      if (tileRow % 40 === 0) {
        say(`  land cover tile row ${tileRow} of ${tif.tileRows}, ${(decided / 1e6).toFixed(1)}M pixels decided`);
      }
    }
    flush(currentRow);
    tif.close();
    say(`land cover decided ${(decided / 1e6).toFixed(2)}M pixels (about ${rowsPerMaster.toFixed(1)} source rows each)`);
  }
}

// ---------------------------------------------------------------------------------------------------
// Ice, salt, and then the water.
//
// Water goes on last, and in size order within itself: rivers, then the small lakes as discs, then the
// big lakes as real outlines. That order matters — a disc the size of Vanern drawn after Vanern's own
// coastline paints straight over it.

paintGeoJson('ne_10m_playas', 'salt-flat', { minimumOnePixel: true });

{
  const shp = join(SOURCE, 'rivers', 'HydroRIVERS_v10.shp');
  if (!existsSync(shp)) {
    say('HydroRIVERS is missing: only Natural Earth rivers will be drawn');
  } else {
    // Kept so that a river crossing dry ground can be taken back off it again afterwards.
    const beforeRivers = raster.cells.slice();
    const dry = new Set(T.tooDryForRivers.map((name) => idOf[name]));
    const dbf = new Dbf(join(SOURCE, 'rivers', 'HydroRIVERS_v10.dbf'), ['ORD_STRA', 'ORD_CLAS']);
    let drawn = 0;
    let skipped = 0;
    const value = idOf.river;
    for (const shape of readShapes(shp)) {
      const order = dbf.at(shape.index).ORD_STRA;
      if (!(order >= T.minimumRiverOrder)) {
        skipped += 1;
        continue;
      }
      if (!overlapsWindow(pixelBounds(shape.rings))) {
        continue;
      }
      // A river is a line, and one pixel of the master is already a river more than a kilometre
      // across, so almost everything gets exactly one pixel and only the greatest rivers on Earth get
      // two. Deliberately not scaled with the master: a finer master should draw finer rivers, which
      // is the whole reason to have one.
      const width = order >= 9 ? 2 : 1;
      for (const line of shape.rings) {
        strokeAcross(line, value, width);
      }
      drawn += 1;
    }
    dbf.close();

    let undone = 0;
    for (let index = 0; index < raster.cells.length; index += 1) {
      if (raster.cells[index] === value && dry.has(beforeRivers[index])) {
        raster.cells[index] = beforeRivers[index];
        undone += 1;
      }
    }

    say(`HydroRIVERS                            ${String(drawn).padStart(7)} reaches drawn, ${skipped} below order ${T.minimumRiverOrder} left out`);
    say(`  ${undone} pixels taken back off ground too dry to hold a river`);
  }
}

paintGeoJson('ne_10m_rivers_lake_centerlines', 'river', { lineWidth: 2 });
paintGeoJson('ne_10m_rivers_europe', 'river', { lineWidth: 2 });

// Ice after the rivers, because HydroRIVERS carries a drainage network straight across the Greenland ice
// sheet — derived from the terrain model, not from any river that exists — and it combs the ice cap with
// blue lines. Glaciers cover it. Lakes come after the ice, so a glacial lake survives.
paintGeoJson('ne_10m_glaciated_areas', 'ice', { minimumOnePixel: true });
paintGeoJson('ne_10m_antarctic_ice_shelves_polys', 'ice');

{
  const shp = join(SOURCE, 'lakes', 'HydroLAKES_points_v10.shp');
  if (!existsSync(shp)) {
    say('HydroLAKES is missing: the small lakes will not be there, which is most of them');
  } else {
    const dbf = new Dbf(join(SOURCE, 'lakes', 'HydroLAKES_points_v10.dbf'), ['Lake_area']);
    const degreesPerPixel = 360 / WIDTH;
    let drawn = 0;
    let single = 0;
    let big = 0;
    for (const shape of readShapes(shp)) {
      const [lng, lat] = shape.point;
      if (!inWindow(lng, lat)) {
        continue;
      }
      const area = dbf.at(shape.index).Lake_area; // square kilometres
      const pixelArea =
        degreesPerPixel * 110.57 * degreesPerPixel * 111.32 * Math.cos((lat * Math.PI) / 180);
      const radius = Math.sqrt(area / Math.max(0.01, pixelArea) / Math.PI);
      if (radius > T.maximumLakeDiscRadius * SCALE) {
        big += 1;
        continue;
      }
      stampDisc(lng, lat, radius, idOf.lake);
      drawn += 1;
      if (radius <= 0.75) single += 1;
    }
    dbf.close();
    say(`HydroLAKES                             ${String(drawn).padStart(7)} lakes, ${single} of them a single pixel, ${big} left to their outlines`);
  }
}

for (const name of ['ne_10m_lakes', 'ne_10m_lakes_north_america', 'ne_10m_lakes_europe', 'ne_10m_lakes_pluvial']) {
  paintGeoJson(name, 'lake', { minimumOnePixel: true });
}

// ---------------------------------------------------------------------------------------------------
// Writing it out

mkdirSync(OUT, { recursive: true });
const squash = (data) => new Uint8Array(deflateSync(data, { level: 9 }));

const png = encodeIndexedPng(raster, COLOUR_TABLE, squash);
writeFileSync(join(OUT, 'terrain.png'), png);
say(`terrain.png ${(png.length / 1048576).toFixed(2)} MB`);

/** A small copy for glancing at. Nearest neighbour: averaging two classes would invent a third. */
const previewScale = Math.max(1, Math.round(WIDTH / 2048));
const preview = createRaster(Math.floor(WIDTH / previewScale), Math.floor(HEIGHT / previewScale));
for (let row = 0; row < preview.height; row += 1) {
  for (let column = 0; column < preview.width; column += 1) {
    preview.cells[row * preview.width + column] =
      raster.cells[row * previewScale * WIDTH + column * previewScale] ?? 0;
  }
}
writeFileSync(join(OUT, 'terrain-preview.png'), encodeIndexedPng(preview, COLOUR_TABLE, squash));

/**
 * Crops at full resolution, because the whole point is what happens at the scale of one province.
 *
 * Magnified, because a master pixel is 2.4 km and a 1:1 crop of Blekinge is 210 pixels wide — accurate
 * and useless to look at. Nearest neighbour: averaging two classes would invent a third.
 */
const CROPS = [
  ['sample-blekinge', 12.5, 55.0, 18.5, 57.8, 4],
  ['sample-scandinavia', 4, 54, 32, 71, 2],
  ['sample-europe', -12, 35, 32, 62, 1],
];
for (const [name, west, south, east, north, zoom] of CROPS) {
  const a = toPixel({ lng: west, lat: north }, raster);
  const b = toPixel({ lng: east, lat: south }, raster);
  const x0 = Math.max(0, Math.floor(a.x));
  const y0 = Math.max(0, Math.floor(a.y));
  const across = Math.min(WIDTH, Math.ceil(b.x)) - x0;
  const down = Math.min(HEIGHT, Math.ceil(b.y)) - y0;
  if (across < 2 || down < 2) {
    continue;
  }
  const crop = createRaster(across * zoom, down * zoom);
  for (let row = 0; row < crop.height; row += 1) {
    const from = (y0 + Math.floor(row / zoom)) * WIDTH + x0;
    for (let column = 0; column < crop.width; column += 1) {
      crop.cells[row * crop.width + column] = raster.cells[from + Math.floor(column / zoom)];
    }
  }
  writeFileSync(join(OUT, `${name}.png`), encodeIndexedPng(crop, COLOUR_TABLE, squash));
  say(`${name}.png ${crop.width} by ${crop.height}, from ${across} by ${down} master pixels`);
}

// The histogram is how you tell a threshold went wrong: a class with no pixels is a class nobody can
// paint by eye either, and a class with forty per cent of the world has eaten its neighbours.
const counts = new Map();
for (const value of raster.cells) {
  counts.set(value, (counts.get(value) ?? 0) + 1);
}
const total = WIDTH * HEIGHT;
const lines = ['id  class                 share    pixels'];
for (const terrain of CLASSES) {
  const pixels = counts.get(terrain.id) ?? 0;
  lines.push(
    `${String(terrain.id).padStart(2)}  ${terrain.name.padEnd(20)} ${((pixels / total) * 100).toFixed(3).padStart(7)}% ${String(pixels).padStart(10)}`,
  );
}
console.log(`\n${lines.join('\n')}`);
writeFileSync(join(OUT, 'histogram.txt'), `${lines.join('\n')}\n`);

const empty = CLASSES.filter((terrain) => (counts.get(terrain.id) ?? 0) === 0);
if (empty.length > 0) {
  say(`nothing was painted for: ${empty.map((terrain) => terrain.name).join(', ')}`);
}
say('done');
