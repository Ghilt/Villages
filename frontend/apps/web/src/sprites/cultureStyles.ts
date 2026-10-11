import { CULTURES } from '@villages/world';
import type { Culture } from '@villages/world';

import type { Part, Picture } from './structureShapes';

/*
 * How a placeholder picture is drawn in each building tradition, until the pictures painted for each type and culture
 * come (step 13 of docs/plans/structures.md): the same front elevation, its colours taken into the culture's own -
 * whitewash and green tile, dark tile and lacquer, mud and thatch - and a crown on what is tallest that says which at
 * a glance: a dome, a flared roof, a cone of thatch. European is the picture as drawn. Data, so the map and the panes
 * draw them alike.
 */

/** What each colour of the drawn pictures becomes in a culture: stone, wall, roof, slate, timber, earth. */
const PALETTES: Readonly<Record<Culture, Readonly<Record<number, number>>>> = {
  european: {},
  islamic: {
    0xc9c0ae: 0xdcc8a0,
    0xece2c8: 0xf4eee0,
    0xa65d3f: 0x3f8f7f,
    0x6c7886: 0x3f8f7f,
    0x8c6a48: 0xb08850,
  },
  eastAsian: {
    0xc9c0ae: 0xb9b2a4,
    0xece2c8: 0xeadcc0,
    0xa65d3f: 0x3b4a5a,
    0x6c7886: 0x3b4a5a,
    0x8c6a48: 0xa8322c,
  },
  african: {
    0xc9c0ae: 0xb98a5c,
    0xece2c8: 0xc99a68,
    0xa65d3f: 0xc8a24e,
    0x6c7886: 0xc8a24e,
    0x8c6a48: 0x7a5232,
    0x7d6a55: 0x9a6a3e,
  },
};

const TILE_GREEN = 0x3f8f7f;
const DARK_TILE = 0x3b4a5a;
const THATCH = 0xc8a24e;
const GILT = 0xc9a23a;

/** The crown on what is tallest, at the pennant's foot, and how much higher the pennant then stands. */
function crownOf(culture: Culture, [x, y]: readonly [number, number]): { parts: Part[]; rise: number } {
  switch (culture) {
    case 'islamic':
      return {
        parts: [
          ['circle', x, y + 2, 8, TILE_GREEN],
          ['rect', x - 1, y - 12, 2, 6, GILT],
        ],
        rise: 12,
      };
    case 'eastAsian':
      return {
        parts: [['poly', [x - 20, y + 4, x - 10, y - 2, x, y - 8, x + 10, y - 2, x + 20, y + 4], DARK_TILE]],
        rise: 8,
      };
    case 'african':
      return { parts: [['poly', [x - 14, y + 6, x, y - 14, x + 14, y + 6], THATCH]], rise: 14 };
    default:
      return { parts: [], rise: 0 };
  }
}

/** A picture in a culture's look: its colours the culture's, and its crown, the pennant over the crown. */
export function styled(picture: Picture, culture: Culture): Picture {
  if (culture === 'european') return picture;
  const palette = PALETTES[culture];
  const recolour = (colour: number) => palette[colour] ?? colour;
  const parts = picture.parts.map((part): Part => {
    if (part[0] === 'rect') return ['rect', part[1], part[2], part[3], part[4], recolour(part[5])];
    if (part[0] === 'poly') return ['poly', part[1], recolour(part[2])];
    return ['circle', part[1], part[2], part[3], recolour(part[4])];
  });
  const crown = crownOf(culture, picture.flag);
  return { parts: [...parts, ...crown.parts], flag: [picture.flag[0], picture.flag[1] - crown.rise] };
}

/** The name a structure's picture is asked for by: what it is, a ruin or its type, and the culture it is drawn in. */
export function pictureKey(picture: string, culture: Culture | null | undefined): string {
  return `${picture}@${culture ?? 'european'}`;
}

/** Every culture a picture is drawn in. */
export const DRAWN_CULTURES: readonly Culture[] = CULTURES;
