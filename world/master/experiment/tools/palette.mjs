/**
 * The experimental 32-class palette, and the one place its colours are written down.
 *
 * Everything else in this folder is generated from this file: palette.txt, palette.png, and the class
 * ids in terrain.png. If you change a colour here, regenerate all three together.
 *
 * The colours are data, not a look. They exist so a human can tell classes apart while painting and so
 * any pixel can be snapped back to exactly one class on the way in. Every pair is at least 40 apart in
 * straight-line RGB distance, which is the same rule world/palette.json enforces at 48 — see README.md
 * for why this experiment loosened it.
 */

/** @typedef {{ id: number, name: string, colour: string, water?: boolean, group: string, meaning: string }} TerrainClass */

/** @type {TerrainClass[]} */
export const CLASSES = [
  // ---- water -------------------------------------------------------------------------------------
  {
    id: 0,
    name: 'ocean',
    colour: '#104058',
    water: true,
    group: 'water',
    meaning: 'Open sea. The base colour of the image: anywhere no land layer painted.',
  },
  {
    id: 1,
    name: 'shallow-sea',
    colour: '#207098',
    water: true,
    group: 'water',
    meaning: 'Continental shelf, inside the 200 m isobath. Sea a ship can anchor in.',
  },
  {
    id: 2,
    name: 'lake',
    colour: '#2890d0',
    water: true,
    group: 'water',
    meaning: 'Standing fresh water. Every lake down to 10 ha gets at least one pixel.',
  },
  {
    id: 3,
    name: 'river',
    colour: '#80d0f0',
    water: true,
    group: 'water',
    meaning:
      'Running water. Every reach of Strahler order three and up, drawn one to three pixels wide by size.',
  },

  // ---- cold --------------------------------------------------------------------------------------
  {
    id: 4,
    name: 'ice',
    colour: '#f0f8f8',
    group: 'cold',
    meaning: 'Permanent ice: ice caps, ice sheets, glaciers, shelf ice.',
  },
  {
    id: 5,
    name: 'polar-desert',
    colour: '#c8c8d8',
    group: 'cold',
    meaning: 'Bare frozen ground with almost nothing growing on it. High arctic gravel and rock.',
  },
  {
    id: 6,
    name: 'tundra',
    colour: '#b0a8c8',
    group: 'cold',
    meaning: 'Moss, lichen and dwarf shrub over permafrost. Treeless but alive.',
  },

  // ---- forest ------------------------------------------------------------------------------------
  {
    id: 7,
    name: 'taiga',
    colour: '#105028',
    group: 'forest',
    meaning: 'Closed boreal conifer forest. Dark, dense, unbroken.',
  },
  {
    id: 8,
    name: 'taiga-open',
    colour: '#407848',
    group: 'forest',
    meaning: 'Thin boreal forest: lichen woodland, bog margins, trees with sky between them.',
  },
  {
    id: 9,
    name: 'conifer-forest',
    colour: '#187850',
    group: 'forest',
    meaning: 'Temperate needleleaf forest. Pine and spruce south of the taiga.',
  },
  {
    id: 10,
    name: 'broadleaf-forest',
    colour: '#68c048',
    group: 'forest',
    meaning: 'Temperate deciduous forest. Oak, beech, birch.',
  },
  {
    id: 11,
    name: 'mixed-forest',
    colour: '#48a038',
    group: 'forest',
    meaning: 'Temperate forest of both kinds together, which is most of northern Europe.',
  },
  {
    id: 12,
    name: 'rainforest',
    colour: '#008070',
    group: 'forest',
    meaning: 'Closed tropical moist broadleaf forest.',
  },
  {
    id: 13,
    name: 'dry-forest',
    colour: '#90b038',
    group: 'forest',
    meaning: 'Tropical and subtropical dry forest, and open woodland with a grass floor.',
  },
  {
    id: 14,
    name: 'mangrove',
    colour: '#306068',
    group: 'forest',
    meaning: 'Salt-tolerant coastal forest standing in tidal water.',
  },
  {
    id: 15,
    name: 'swamp-forest',
    colour: '#405830',
    group: 'forest',
    meaning: 'Forest standing in fresh water: flooded forest, carr, varzea.',
  },

  // ---- open land ---------------------------------------------------------------------------------
  {
    id: 16,
    name: 'steppe',
    colour: '#d0d848',
    group: 'open',
    meaning: 'Dry temperate grassland. Prairie, pampas, the Eurasian steppe.',
  },
  {
    id: 17,
    name: 'meadow',
    colour: '#a8d878',
    group: 'open',
    meaning: 'Moist grassland and pasture. Grass that is grazed rather than ploughed.',
  },
  {
    id: 18,
    name: 'savanna',
    colour: '#e08830',
    group: 'open',
    meaning: 'Tropical grassland with scattered trees.',
  },
  {
    id: 19,
    name: 'scrub',
    colour: '#a89850',
    group: 'open',
    meaning: 'Shrubland: maquis, garrigue, chaparral, xeric scrub. Waist-high and woody.',
  },
  {
    id: 20,
    name: 'heath',
    colour: '#887088',
    group: 'open',
    meaning: 'Cool oceanic moor and heath. Heather, gorse, wind, no trees.',
  },

  // ---- farmed ------------------------------------------------------------------------------------
  {
    id: 21,
    name: 'farmland',
    colour: '#f0e060',
    group: 'farmed',
    meaning: 'Ploughed and managed land, open field to the horizon.',
  },
  {
    id: 22,
    name: 'farmland-with-woods',
    colour: '#b0c058',
    group: 'farmed',
    meaning:
      'The mosaic: fields with woodlots, hedges and copses between them. Most of settled Europe is this.',
  },
  {
    id: 23,
    name: 'paddy',
    colour: '#80d0a0',
    group: 'farmed',
    meaning: 'Flooded cropland. Rice terraces and delta paddies.',
  },

  // ---- wetland -----------------------------------------------------------------------------------
  {
    id: 24,
    name: 'marsh',
    colour: '#607028',
    group: 'wetland',
    meaning: 'Treeless freshwater wetland: reed bed, fen, sedge marsh.',
  },
  {
    id: 25,
    name: 'bog',
    colour: '#685040',
    group: 'wetland',
    meaning: 'Peatland and mire. Acid, spongy, cold. The Swedish and Finnish mosse.',
  },
  {
    id: 26,
    name: 'floodplain',
    colour: '#a8c8a0',
    group: 'wetland',
    meaning: 'Seasonally flooded grassland. Dry half the year, under water the other half.',
  },

  // ---- dry ---------------------------------------------------------------------------------------
  {
    id: 27,
    name: 'salt-flat',
    colour: '#e8e8c0',
    group: 'dry',
    meaning: 'Playa, salar, sabkha. Flat, white, and lethal to cross.',
  },
  {
    id: 28,
    name: 'desert-sand',
    colour: '#f0d898',
    group: 'dry',
    meaning: 'Sand desert. Dunes and erg, nothing growing at all.',
  },
  {
    id: 29,
    name: 'desert-stone',
    colour: '#c8a878',
    group: 'dry',
    meaning: 'Stony desert and sparse xeric ground: reg, hamada, gravel plain.',
  },

  // ---- high --------------------------------------------------------------------------------------
  {
    id: 30,
    name: 'alpine-meadow',
    colour: '#c0e0b8',
    group: 'high',
    meaning: 'Montane grassland above the treeline but below the rock.',
  },
  {
    id: 31,
    name: 'bare-rock',
    colour: '#886850',
    group: 'high',
    meaning: 'Scree, cliff and bare mountain stone.',
  },
];

/** Straight-line distance in colour space, the same crude measure the real palette check uses. */
export function toRgb(colour) {
  return [
    Number.parseInt(colour.slice(1, 3), 16),
    Number.parseInt(colour.slice(3, 5), 16),
    Number.parseInt(colour.slice(5, 7), 16),
  ];
}

export function colourDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** The closest pair in the palette, which is the number the separation rule cares about. */
export function closestPair(classes = CLASSES) {
  let worst = { distance: Infinity, a: '', b: '' };
  for (let i = 0; i < classes.length; i += 1) {
    for (let j = i + 1; j < classes.length; j += 1) {
      const distance = colourDistance(toRgb(classes[i].colour), toRgb(classes[j].colour));
      if (distance < worst.distance) {
        worst = { distance, a: classes[i].name, b: classes[j].name };
      }
    }
  }
  return worst;
}

/** Class id by name, because every layer in the build refers to classes by name. */
export const idOf = Object.fromEntries(CLASSES.map((terrain) => [terrain.name, terrain.id]));

/** The colour table an indexed PNG needs: one entry per id, in id order. */
export const COLOUR_TABLE = CLASSES.slice()
  .sort((a, b) => a.id - b.id)
  .map((terrain) => toRgb(terrain.colour));

export const GROUPS = ['water', 'cold', 'forest', 'open', 'farmed', 'wetland', 'dry', 'high'];
