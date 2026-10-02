import type { Repeat, Sides, UiBorder, UiPicture } from '@villages/world';

import { imageSetOf } from '../art/pictures';

/**
 * A border and a fill as CSS lays them: the arithmetic between a cut picture and the style that draws it,
 * worked out here so that it is a test rather than something read off the screen.
 *
 * A border is `border-image`, which is nine-slice: the corners drawn once, the edges laid between them,
 * the middle drawn or left. Its cuts are written as shares of the picture rather than as pixels, because
 * the browser picks one of three files for the screen it is on and a share lands on the same line in all
 * three; the tool took every cut to a whole pixel as shown, so it lands between two pixels in each. See
 * decision record 0068.
 */

const px = (sides: Sides): string => sides.map((side) => `${side}px`).join(' ');

/** Four lengths drawn at a scale, to the hundredth of a pixel. */
const scaled = (sides: Sides, by: number): Sides =>
  by === 1
    ? sides
    : [
        Math.round(sides[0] * by * 100) / 100,
        Math.round(sides[1] * by * 100) / 100,
        Math.round(sides[2] * by * 100) / 100,
        Math.round(sides[3] * by * 100) / 100,
      ];

/** A share of a length, as CSS writes one, to enough places that nothing is lost at any density. */
const share = (part: number, whole: number): string => `${Number(((part / whole) * 100).toFixed(6))}%`;

export interface BorderImage {
  readonly borderStyle: 'solid';
  readonly borderWidth: string;
  readonly borderImageSource: string;
  readonly borderImageSlice: string;
  readonly borderImageWidth: string;
  readonly borderImageRepeat: string;
  readonly borderImageOutset: string;
}

export interface BorderOptions {
  /** Draw the picture's own middle, whatever its file says: false when a fill is laid under it. */
  readonly middle?: boolean;
  /** Lay the edges this way, whatever the file says: for looking at what each way does. */
  readonly repeat?: readonly [Repeat, Repeat];
  /**
   * Draw it this many times the size its picture is shown, a button's face smaller than a pane's frame. The
   * cuts are shares of the picture, so they fall in the same places at any size.
   */
  readonly scale?: number;
}

/** The style that draws a border picture round whatever box it is given. */
export function borderImageOf(
  picture: UiPicture,
  border: UiBorder,
  options: BorderOptions = {},
): BorderImage {
  const [top, right, bottom, left] = border.slice;
  const middle = options.middle ?? border.middle;
  const scale = options.scale ?? 1;
  const widths = px(scaled(border.slice, scale));
  return {
    borderStyle: 'solid',
    borderWidth: widths,
    borderImageSource: imageSetOf(picture),
    borderImageSlice:
      `${share(top, picture.height)} ${share(right, picture.width)} ` +
      `${share(bottom, picture.height)} ${share(left, picture.width)}${middle ? ' fill' : ''}`,
    borderImageWidth: widths,
    borderImageRepeat: (options.repeat ?? border.repeat).join(' '),
    borderImageOutset: px(scaled(border.outset, scale)),
  };
}

export interface FillImage {
  readonly backgroundImage: string;
  readonly backgroundSize: string;
  readonly backgroundRepeat: 'repeat';
}

/** The style that fills a box with a fill picture, laid at the size it is shown and repeated. */
export function fillImageOf(picture: UiPicture): FillImage {
  return {
    backgroundImage: imageSetOf(picture),
    backgroundSize: `${picture.width}px ${picture.height}px`,
    backgroundRepeat: 'repeat',
  };
}

/**
 * Where a fill stands inside a box with this border: in from each edge by the border's cut, less as much
 * as the border says a fill reaches under it, so no gap shows between an uneven inner edge and the fill.
 */
export function fillInsetOf(border: UiBorder | undefined): Sides {
  if (border === undefined) {
    return [0, 0, 0, 0];
  }
  const { slice, fillUnder } = border;
  return [
    Math.max(0, slice[0] - fillUnder[0]),
    Math.max(0, slice[1] - fillUnder[1]),
    Math.max(0, slice[2] - fillUnder[2]),
    Math.max(0, slice[3] - fillUnder[3]),
  ];
}

/**
 * Where the content starts inside a box with this border: past the cut and then the border's inset, or
 * wherever its file says, which for a frame with deep corners is inside the cuts.
 */
export function contentInsetOf(border: UiBorder | undefined): Sides {
  if (border === undefined) {
    return [0, 0, 0, 0];
  }
  // A list cut before borders said where their content starts has none, for the moment until the dev
  // server cuts it again; the cuts are where it started then.
  return (border.content as Sides | undefined) ?? border.slice;
}

/** Four lengths as CSS writes them, for a padding or an inset. */
export const sidesInPixels = px;
