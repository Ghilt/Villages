import { describe, expect, it } from 'vitest';

import { colourOf, contrastOf } from '../contrast';
import type { Rgba } from '../contrast';
import css from '../ui.css?raw';
import questCss from './quest.css?raw';

/**
 * A ticked row's tick can be seen wherever the row stands. It is drawn on a fill of the box's own, so the surface
 * round it does not matter, and it stands out from that fill by three to one, what a mark that is not words needs.
 * A tick in light gilt on nothing of its own vanished on the parchment card: Adam's note of 2026-10-15.
 */

/** Three to one: what a mark needs against what is behind it, where words need four and a half. */
const SEEN = 3;

/** A colour token as `ui.css` declares it. */
function token(name: string): Rgba {
  const declared = new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1];
  const colour = declared === undefined ? null : colourOf(declared);
  if (colour === null) {
    throw new Error(`ui.css declares no colour --${name}`);
  }
  return colour;
}

/** The token a declaration of the ticked box names, as `var(--name)`, or nothing when it names none. */
function tickedBox(property: string): string | undefined {
  const block = /\.ui-checklist-row--met \.ui-checklist-row__box \{([^}]*)\}/.exec(questCss)?.[1] ?? '';
  return new RegExp(`(?:^|;|\\s)${property}:\\s*var\\(--([\\w-]+)\\)`).exec(block)?.[1];
}

describe("a ticked row's tick", () => {
  it('stands on a fill of its own, and stands out from it', () => {
    const fill = tickedBox('background');
    const tick = tickedBox('color');
    expect(fill, 'the ticked box has a fill of its own').toBeDefined();
    expect(tick, 'the ticked box says what colour its tick is').toBeDefined();
    expect(contrastOf(token(tick!), token(fill!))).toBeGreaterThanOrEqual(SEEN);
  });
});
