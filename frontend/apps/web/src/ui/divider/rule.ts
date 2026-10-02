import type { UiBorder, UiPicture } from '@villages/world';

import { borderImageOf } from '../border/borderStyle';
import type { BorderImage } from '../border/borderStyle';

/**
 * A divider's rule as CSS lays it: the picture cut at its two ends like a border at its four, the ends
 * drawn once and the line between them stretched to whatever width the rule is given.
 *
 * Beside a knot or a title the inner end is left off, so the line runs up to what stands in its middle
 * rather than stopping at an ornament of its own just short of it: the moodboard's lines run into their
 * knots. See docs/UI-COMPONENTS.md.
 */

/** Which of a rule's two ends are drawn: both, or only the one away from what stands beside it. */
export type Caps = 'both' | 'left' | 'right';

export interface RuleStyle extends BorderImage {
  readonly height: number;
}

export function ruleStyleOf(picture: UiPicture, border: UiBorder, caps: Caps = 'both'): RuleStyle {
  const image = borderImageOf(picture, border, { middle: true });
  const [top, right, bottom, left] = border.slice;
  const widths =
    `${top}px ${caps === 'left' ? 0 : right}px ` + `${bottom}px ${caps === 'right' ? 0 : left}px`;
  return { ...image, borderWidth: widths, borderImageWidth: widths, height: picture.height };
}
