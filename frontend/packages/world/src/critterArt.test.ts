import { describe, expect, it } from 'vitest';

import type { Rgba } from './art.ts';
import { commonBox, critterFrameKey, critterKindsOf, framesOf } from './critterArt.ts';

/** A picture of nothing, with these pixels drawn in it, solid. */
function picture(width: number, height: number, drawn: readonly [number, number][] = []): Rgba {
  const data = new Uint8Array(width * height * 4);
  for (const [x, y] of drawn) data.set([90, 60, 40, 255], (y * width + x) * 4);
  return { width, height, data };
}

describe("the critters' pictures", () => {
  it('cuts a strip into its frames side by side, as wide as each other as whole pixels allow', () => {
    expect(framesOf(picture(12, 4), 3).map((frame) => frame.width)).toEqual([4, 4, 4]);
    expect(framesOf(picture(10, 4), 3).map((frame) => frame.width)).toEqual([3, 4, 3]);
    // The second frame begins where the first ends: what is drawn at x 5 is the second frame's x 1.
    const [, second] = framesOf(picture(8, 2, [[5, 1]]), 2);
    expect(second!.data[(1 * 4 + 1) * 4 + 3]).toBe(255);
  });

  it('refuses a picture too narrow for its frames', () => {
    expect(() => framesOf(picture(2, 4), 3)).toThrow(/cannot hold 3 frames/);
  });

  it('cuts every frame of a kind to the one box that holds them all, so its frames register', () => {
    // A bird whose wings are up in the first frame and down in the second: the box spans both.
    const up = picture(10, 10, [
      [2, 1],
      [5, 5],
    ]);
    const down = picture(10, 10, [
      [5, 5],
      [8, 8],
    ]);
    expect(commonBox([up, down])).toEqual({ x: 2, y: 1, width: 7, height: 8 });
    expect(commonBox([picture(4, 4), picture(4, 4)])).toBeNull();
  });

  it('keys a frame by its kind and where it comes in the strip', () => {
    expect(critterFrameKey('songbird', 2)).toBe('songbird/2');
  });

  it('refuses a list that names a kind twice, or gives one no frames', () => {
    expect(() =>
      critterKindsOf({
        kinds: [
          { name: 'hare', frames: 3 },
          { name: 'hare', frames: 2 },
        ],
      }),
    ).toThrow(/twice/);
    expect(() => critterKindsOf({ kinds: [{ name: 'fish', frames: 0 }] })).toThrow(/one or more/);
    expect(() => critterKindsOf({ kinds: [{ name: 'Fish', frames: 2 }] })).toThrow(/lower-case/);
  });
});
