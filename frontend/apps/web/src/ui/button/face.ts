import type { UiArtFile, UiPicture } from '@villages/world';

import { imageSetOf, pictureIn } from '../art/pictures';
import { borderImageOf } from '../border/borderStyle';

/**
 * A button's **face**: the picture it is drawn on, as CSS lays it at the size the button is.
 *
 * A face with cuts, as the moodboard's drapes and oval have, is laid like a border and stretched between
 * its end caps to fit the words on it; one without, a round one, is laid whole. Its states are light and
 * shade over the one picture - lighter under the pointer, darker pressed, grey disabled - unless Adam has
 * painted one: `primary-hover`, `primary-pressed`, `primary-disabled` beside `primary` are drawn in those
 * states instead. See docs/UI-COMPONENTS.md.
 */

/** How tall a button is drawn, by the size it is asked for, in pixels. */
export const BUTTON_HEIGHTS = { small: 32, regular: 44, large: 60 } as const;
export type ButtonSize = keyof typeof BUTTON_HEIGHTS;

/** The states a face can have a painted picture of, besides the one at rest. */
export const PAINTED_STATES = ['hover', 'pressed', 'disabled'] as const;
export type PaintedState = (typeof PAINTED_STATES)[number];

export interface Face {
  /** Stretched along its cuts, or laid whole. */
  readonly sliced: boolean;
  /** The style that draws it at rest. */
  readonly style: Record<string, string>;
  /** How wide it is at this height, when it is laid whole; a sliced face is as wide as its words. */
  readonly width: number | undefined;
  /** Room at each end for its caps, so the words sit between them rather than on them. */
  readonly ends: readonly [number, number];
  /** The states Adam has painted, which are drawn instead of light and shade. */
  readonly painted: readonly PaintedState[];
}

/** A face's picture in one of its states, if it has been painted in that one. */
function inState(list: UiArtFile | null, name: string, state: PaintedState): UiPicture | undefined {
  return pictureIn(list, 'controls', `${name}-${state}`);
}

/** The face called `name`, drawn `height` pixels tall, or undefined when there is no such picture. */
export function faceOf(list: UiArtFile | null, name: string, height: number): Face | undefined {
  const picture = pictureIn(list, 'controls', name);
  if (picture === undefined) {
    return undefined;
  }
  const scale = height / picture.height;
  const painted = PAINTED_STATES.filter((state) => inState(list, name, state) !== undefined);
  const states: Record<string, string> = {};
  for (const state of painted) {
    states[`--ui-face-${state}`] = imageSetOf(inState(list, name, state)!);
  }
  if (picture.border !== undefined) {
    const { borderStyle, ...image } = borderImageOf(picture, picture.border, { scale, middle: true });
    return {
      sliced: true,
      style: { borderStyle, ...image, ...states },
      width: undefined,
      ends: [
        Math.round(picture.border.slice[3] * scale * 100) / 100,
        Math.round(picture.border.slice[1] * scale * 100) / 100,
      ],
      painted,
    };
  }
  return {
    sliced: false,
    style: { backgroundImage: imageSetOf(picture), ...states },
    width: Math.round(picture.width * scale),
    ends: [0, 0],
    painted,
  };
}
