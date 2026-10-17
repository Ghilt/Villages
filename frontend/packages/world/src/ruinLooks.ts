import type { RuinPieceName } from './ruins.ts';
import { INK, PICTURE_BOX, pictureParts, styled } from './structureLooks.ts';
import type { Part, Picture } from './structureLooks.ts';
import type { Culture } from './structures.ts';

/*
 * The placeholder pictures of the pieces a ruined city is laid out in, until Adam paints them: a front elevation of
 * each in the structures' own colours, drawn into each culture's as a structure's placeholder is - whitewash and green
 * tile, dark tile and lacquer, mud and thatch. Only the hall keeps the culture's crown, a dome, a flared roof or a
 * cone of thatch, because it is the one piece a culture is known by at a glance; the rest are broken to the stone.
 * Each stands on the bottom of its box, as every sprite does. See docs/plans/ruined-cities.md.
 */

const STONE = 0xc9c0ae;
const WALL = 0xece2c8;
const TIMBER = 0x8c6a48;
const EARTH = 0x7d6a55;

/** A heap of earth along the foot, so a piece stands in its own rubble. */
const heap = (from: number, to: number): Part => [
  'poly',
  [
    from,
    100,
    from + 6,
    94,
    (from + to) / 2 - 8,
    96,
    (from + to) / 2,
    91,
    (from + to) / 2 + 9,
    95,
    to - 6,
    93,
    to,
    100,
  ],
  EARTH,
];
const hole = (x: number, y: number, w = 6, h = 10): Part => ['rect', x, y, w, h, INK];

const PIECES: Record<RuinPieceName, Picture> = {
  shell: {
    parts: [
      ['poly', [26, 100, 26, 62, 34, 56, 40, 66, 50, 48, 58, 60, 66, 54, 74, 64, 74, 100], WALL],
      hole(36, 72),
      hole(58, 74),
      ['rect', 46, 84, 9, 16, INK],
      ['poly', [30, 60, 46, 50, 48, 53, 32, 63], TIMBER],
      heap(22, 80),
    ],
    flag: [50, 48],
  },
  row: {
    parts: [
      ['poly', [4, 100, 4, 60, 12, 52, 20, 62, 28, 50, 34, 58, 34, 100], WALL],
      ['poly', [34, 100, 34, 56, 44, 46, 52, 60, 60, 54, 66, 64, 66, 100], STONE],
      ['poly', [66, 100, 66, 66, 74, 58, 82, 70, 90, 60, 96, 68, 96, 100], WALL],
      hole(12, 70),
      hole(42, 66),
      hole(54, 74),
      hole(76, 76),
      ['rect', 16, 86, 8, 14, INK],
      ['rect', 78, 88, 8, 12, INK],
      heap(2, 98),
    ],
    flag: [44, 46],
  },
  tower: {
    parts: [
      ['poly', [36, 100, 36, 30, 42, 22, 46, 32, 52, 18, 58, 30, 64, 26, 64, 100], STONE],
      hole(47, 40, 5, 12),
      hole(47, 64, 5, 12),
      ['rect', 45, 86, 10, 14, INK],
      heap(30, 72),
    ],
    flag: [52, 18],
  },
  hall: {
    parts: [
      ['poly', [8, 100, 8, 54, 16, 48, 22, 58, 30, 50, 30, 100], STONE],
      ['poly', [70, 100, 70, 52, 78, 46, 84, 56, 92, 50, 92, 100], STONE],
      ['poly', [30, 100, 30, 40, 50, 14, 70, 40, 70, 100], WALL],
      ['rect', 44, 30, 12, 20, INK],
      hole(14, 64, 8, 16),
      hole(78, 62, 8, 16),
      ['rect', 42, 70, 16, 30, INK],
      heap(4, 96),
    ],
    flag: [50, 14],
  },
  arch: {
    parts: [
      [
        'poly',
        [
          20, 100, 20, 40, 30, 30, 50, 24, 70, 30, 80, 40, 80, 100, 64, 100, 64, 52, 58, 44, 50, 40, 42, 44,
          36, 52, 36, 100,
        ],
        STONE,
      ],
      ['poly', [20, 40, 26, 34, 30, 38, 24, 44], WALL],
      heap(14, 86),
    ],
    flag: [50, 24],
  },
  wall: {
    parts: [
      [
        'poly',
        [
          2, 100, 2, 62, 8, 62, 8, 56, 16, 56, 16, 62, 24, 62, 24, 56, 32, 56, 36, 66, 44, 60, 52, 72, 60, 64,
          66, 70, 72, 62, 72, 56, 80, 56, 80, 62, 88, 62, 88, 58, 98, 58, 98, 100,
        ],
        STONE,
      ],
      heap(40, 70),
    ],
    flag: [20, 56],
  },
  gate: {
    parts: [
      ['poly', [6, 100, 6, 34, 12, 28, 18, 36, 24, 26, 32, 34, 32, 100], STONE],
      ['poly', [68, 100, 68, 30, 76, 24, 82, 34, 88, 28, 94, 36, 94, 100], STONE],
      [
        'poly',
        [32, 100, 32, 50, 40, 44, 50, 42, 60, 44, 68, 50, 68, 100, 60, 100, 60, 64, 50, 58, 40, 64, 40, 100],
        STONE,
      ],
      hole(16, 50, 6, 12),
      hole(78, 48, 6, 12),
      heap(2, 98),
    ],
    flag: [24, 26],
  },
  rubble: {
    parts: [
      ['poly', [4, 100, 14, 84, 30, 80, 44, 70, 58, 74, 74, 68, 88, 80, 96, 100], EARTH],
      ['poly', [20, 88, 28, 80, 36, 86, 30, 94], STONE],
      ['poly', [46, 78, 56, 72, 62, 80, 52, 86], STONE],
      ['poly', [66, 84, 78, 78, 82, 90, 70, 92], WALL],
      ['poly', [34, 74, 60, 66, 61, 70, 35, 78], TIMBER],
    ],
    flag: [56, 70],
  },
};

/** A piece's placeholder picture in a culture's look: its colours the culture's, and a crown on the hall alone. */
export function ruinPicture(piece: RuinPieceName, culture: Culture): Picture {
  const picture = PIECES[piece];
  const looked = styled(picture, culture);
  return piece === 'hall'
    ? looked
    : { parts: looked.parts.slice(0, picture.parts.length), flag: picture.flag };
}

/** A piece's placeholder as an SVG document `size` pixels square, in ink round every shape. */
export function ruinPlaceholderSvg(piece: RuinPieceName, culture: Culture, size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${PICTURE_BOX}" width="${size}" height="${size}">${pictureParts(ruinPicture(piece, culture))}</svg>`;
}

/** The file a piece's picture is in, `world/sprites/ruins/<piece>-<culture>.png` but for its extension. */
export const ruinPictureName = (piece: RuinPieceName, culture: Culture): string => `${piece}-${culture}`;

/** The frame a piece's picture is in the scenery's atlas, which no kind of scenery is called. */
export const ruinFrameKey = (piece: RuinPieceName, culture: Culture): string => `ruin:${piece}-${culture}`;
