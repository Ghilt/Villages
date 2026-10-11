/*
 * The placeholder picture of every type of structure, drawn in code until the sprites cut from the moodboard come, one
 * a type and a culture (step 13 of docs/plans/structures.md). Each is a front elevation in a box a hundred units wide
 * and a hundred tall, the ground at the bottom, drawn in its own colours rather than in white for a tint: a structure
 * is untinted, and who holds it is said by the pennant over it. A type the page has no picture for is drawn as a
 * plain house, so a type added to the catalogue is on the map before anyone has drawn it. Data, so that the map draws
 * them in Pixi (`structurePictures.ts`) and a pane draws them in SVG (`holdings/StructureFigure.tsx`) from one table.
 */

export const INK = 0x4a4034;
const STONE = 0xc9c0ae;
const WALL = 0xece2c8;
const ROOF = 0xa65d3f;
const SLATE = 0x6c7886;
const TIMBER = 0x8c6a48;
const GILT = 0xc9a23a;
const EARTH = 0x7d6a55;
const SMOKE = 0xd8d3c8;

/** One shape of a picture, in the box's units, filled with its colour and drawn round in ink. */
export type Part =
  | readonly ['rect', number, number, number, number, number]
  | readonly ['poly', readonly number[], number]
  | readonly ['circle', number, number, number, number];

export interface Picture {
  parts: readonly Part[];
  /** Where the pennant's staff stands on it, in the box's units: the top of what is tallest. */
  flag: readonly [number, number];
}

const door = (x: number, y: number, w = 10): Part => ['rect', x, y, w, 100 - y, INK];
const windows = (y: number, h: number, ...xs: number[]): Part[] =>
  xs.map((x) => ['rect', x, y, 8, h, INK] as const);

const PICTURES: Record<string, Picture> = {
  castle: {
    parts: [
      ['rect', 34, 52, 32, 48, STONE],
      ['rect', 45, 45, 10, 7, STONE],
      ['rect', 10, 22, 7, 8, STONE],
      ['rect', 27, 22, 7, 8, STONE],
      ['rect', 66, 22, 7, 8, STONE],
      ['rect', 83, 22, 7, 8, STONE],
      ['rect', 10, 30, 24, 70, STONE],
      ['rect', 66, 30, 24, 70, STONE],
      door(44, 78, 12),
    ],
    flag: [22, 22],
  },
  manor: {
    parts: [
      ['rect', 66, 18, 6, 14, ROOF],
      ['rect', 12, 50, 76, 50, WALL],
      ['poly', [6, 52, 25, 28, 75, 28, 94, 52], ROOF],
      ...windows(62, 10, 22, 46, 70),
      door(46, 82, 8),
    ],
    flag: [50, 28],
  },
  palace: {
    parts: [
      ['rect', 48, 14, 4, 10, GILT],
      ['circle', 50, 40, 17, GILT],
      ['rect', 4, 55, 92, 45, WALL],
      ['rect', 34, 40, 32, 60, WALL],
      ['poly', [30, 42, 50, 32, 70, 42], WALL],
      ...windows(66, 10, 10, 20, 72, 82),
      door(45, 80),
    ],
    flag: [50, 14],
  },
  fort: {
    parts: [
      ['rect', 38, 40, 6, 6, STONE],
      ['rect', 56, 40, 6, 6, STONE],
      ['rect', 38, 46, 24, 30, STONE],
      ['poly', [2, 100, 10, 70, 30, 78, 50, 64, 70, 78, 90, 70, 98, 100], STONE],
      door(46, 86, 8),
    ],
    flag: [41, 40],
  },
  watchtower: {
    parts: [
      ['rect', 36, 22, 28, 78, STONE],
      ['rect', 30, 14, 40, 10, TIMBER],
      ['poly', [28, 14, 50, 0, 72, 14], ROOF],
      ['rect', 46, 40, 8, 12, INK],
      door(45, 84),
    ],
    flag: [50, 0],
  },
  prison: {
    parts: [
      ['rect', 10, 38, 80, 62, STONE],
      ['rect', 6, 32, 88, 8, SLATE],
      ...windows(50, 14, 18, 34, 62, 76),
      ['rect', 21, 50, 2, 14, STONE],
      ['rect', 37, 50, 2, 14, STONE],
      ['rect', 65, 50, 2, 14, STONE],
      ['rect', 79, 50, 2, 14, STONE],
      door(44, 76, 12),
    ],
    flag: [14, 32],
  },
  cathedral: {
    parts: [
      ['rect', 8, 52, 60, 48, WALL],
      ['poly', [4, 54, 14, 38, 62, 38, 72, 54], SLATE],
      ['rect', 66, 28, 22, 72, WALL],
      ['poly', [64, 30, 77, 0, 90, 30], SLATE],
      ['circle', 38, 70, 7, INK],
      ...windows(64, 14, 16, 52),
      door(72, 82),
    ],
    flag: [77, 0],
  },
  abbey: {
    parts: [
      ['rect', 74, 72, 22, 28, STONE],
      ['rect', 30, 46, 44, 54, WALL],
      ['poly', [26, 48, 52, 26, 78, 48], ROOF],
      ['rect', 12, 36, 18, 64, WALL],
      ['poly', [10, 38, 21, 22, 32, 38], ROOF],
      ['circle', 52, 62, 5, INK],
      door(47, 82),
    ],
    flag: [21, 22],
  },
  mill: {
    parts: [
      ['poly', [32, 100, 38, 40, 62, 40, 68, 100], WALL],
      ['poly', [34, 42, 50, 26, 66, 42], TIMBER],
      ['poly', [50, 34, 80, 4, 86, 10, 54, 38], WALL],
      ['poly', [50, 34, 20, 4, 14, 10, 46, 38], WALL],
      ['poly', [54, 34, 86, 62, 80, 68, 50, 38], WALL],
      ['poly', [46, 34, 14, 62, 20, 68, 50, 38], WALL],
      ['circle', 50, 36, 4, INK],
      door(45, 84),
    ],
    flag: [50, 26],
  },
  mine: {
    parts: [
      ['poly', [2, 100, 26, 70, 50, 100], EARTH],
      ['poly', [56, 100, 72, 30, 76, 30, 62, 100], TIMBER],
      ['poly', [94, 100, 76, 30, 72, 30, 88, 100], TIMBER],
      ['circle', 74, 28, 10, TIMBER],
      ['circle', 74, 28, 4, INK],
      ['rect', 38, 78, 22, 22, WALL],
      ['poly', [36, 80, 49, 68, 62, 80], ROOF],
    ],
    flag: [74, 18],
  },
  market: {
    parts: [
      ['rect', 46, 18, 8, 12, WALL],
      ['poly', [44, 18, 50, 10, 56, 18], ROOF],
      ['rect', 8, 50, 84, 50, WALL],
      ['poly', [4, 52, 20, 30, 80, 30, 96, 52], ROOF],
      door(14, 74, 12),
      door(34, 74, 12),
      door(54, 74, 12),
      door(74, 74, 12),
    ],
    flag: [50, 10],
  },
  harbour: {
    parts: [
      ['rect', 2, 78, 96, 22, STONE],
      ['rect', 20, 30, 6, 48, TIMBER],
      ['poly', [20, 30, 70, 26, 70, 32, 26, 36], TIMBER],
      ['rect', 66, 32, 2, 22, INK],
      ['rect', 60, 54, 14, 12, TIMBER],
      ['rect', 76, 50, 20, 28, WALL],
      ['poly', [74, 52, 86, 40, 98, 52], ROOF],
    ],
    flag: [23, 30],
  },
  shipyard: {
    parts: [
      ['poly', [2, 100, 98, 86, 98, 100], STONE],
      ['rect', 30, 38, 4, 26, TIMBER],
      ['rect', 62, 34, 4, 26, TIMBER],
      ['rect', 26, 36, 44, 4, TIMBER],
      ['poly', [8, 62, 92, 56, 82, 80, 22, 84], TIMBER],
    ],
    flag: [64, 34],
  },
  manufactory: {
    parts: [
      ['circle', 88, 8, 6, SMOKE],
      ['rect', 80, 14, 12, 86, ROOF],
      ['rect', 6, 56, 72, 44, WALL],
      ['poly', [6, 56, 6, 44, 24, 56, 24, 44, 42, 56, 42, 44, 60, 56, 60, 44, 78, 56], ROOF],
      ...windows(70, 10, 14, 32, 50),
      door(64, 80),
    ],
    flag: [6, 44],
  },
  academy: {
    parts: [
      ['rect', 6, 92, 88, 8, STONE],
      ['rect', 10, 86, 80, 6, STONE],
      ['rect', 46, 66, 8, 20, INK],
      ['rect', 14, 46, 8, 40, WALL],
      ['rect', 30, 46, 8, 40, WALL],
      ['rect', 62, 46, 8, 40, WALL],
      ['rect', 78, 46, 8, 40, WALL],
      ['rect', 10, 38, 80, 8, WALL],
      ['poly', [8, 38, 50, 16, 92, 38], WALL],
    ],
    flag: [50, 16],
  },
  printingHouse: {
    parts: [
      ['rect', 22, 36, 56, 64, WALL],
      [
        'poly',
        [22, 36, 22, 28, 30, 28, 30, 20, 38, 20, 38, 12, 62, 12, 62, 20, 70, 20, 70, 28, 78, 28, 78, 36],
        WALL,
      ],
      ...windows(46, 12, 30, 62),
      ...windows(66, 12, 30, 62),
      door(45, 80),
      ['rect', 78, 50, 12, 2, INK],
      ['rect', 82, 52, 12, 10, GILT],
    ],
    flag: [50, 12],
  },
};

/**
 * What any structure fallen to ruin is drawn as, whatever it was, until the ruins of each type are drawn (step 13):
 * the stump of a tower and a broken wall over a heap of rubble, and no pennant, because nobody holds a ruin.
 */
const RUIN: Picture = {
  parts: [
    ['poly', [14, 100, 14, 54, 20, 46, 24, 58, 30, 50, 34, 62, 34, 100], STONE],
    ['poly', [54, 100, 54, 68, 60, 62, 64, 72, 70, 64, 76, 70, 80, 66, 80, 100], STONE],
    ['rect', 20, 70, 6, 10, INK],
    ['poly', [2, 100, 16, 88, 32, 92, 46, 82, 62, 90, 78, 84, 98, 100], EARTH],
  ],
  flag: [24, 46],
};

/** What a type nobody has drawn yet is drawn as: a plain house, so it is on the map all the same. */
const ANY: Picture = {
  parts: [['rect', 20, 50, 60, 50, WALL], ['poly', [14, 52, 50, 22, 86, 52], ROOF], door(45, 80)],
  flag: [50, 22],
};

/** A type's picture, by the catalogue's name for it, or the plain house for a type nobody has drawn. */
export function pictureOf(type: string): Picture {
  return PICTURES[type] ?? ANY;
}

/** The name the map and the panes ask for a ruin's picture by, which no type is called. */
export const RUIN_PICTURE = 'a ruin';

/** A structure's picture as it stands: its type's, or the ruin's. */
export function pictureFor(type: string, ruin: boolean): Picture {
  return ruin ? RUIN : pictureOf(type);
}

/** Every type that has a picture of its own. */
export const DRAWN_TYPES: readonly string[] = Object.keys(PICTURES);
