import { describe, expect, it } from 'vitest';

import { type Asking, overlap, type Rect } from './bayBox';
import { BAR, stageLayout } from './stageLayout';

const HALF: readonly [Asking, Asking] = ['big', 'big'];
const NOTHING = { left: false, bottomLeft: null, bottomMiddle: null };

/** The two bays and the bar, which between them should be the whole stage and never overlap. */
function pieces(layout: ReturnType<typeof stageLayout>): Rect[] {
  return [layout.bays.first, layout.bays.second, layout.bar].filter((one): one is Rect => one !== null);
}

const area = (rects: readonly Rect[]) => rects.reduce((sum, one) => sum + one.w * one.h, 0);

describe('the bottom bar on a phone', () => {
  it('runs along the bottom of an upright phone, a strip thick, under both bays', () => {
    const layout = stageLayout({ w: 390, h: 844 }, HALF, NOTHING, 'bays');

    expect(layout.bar).toEqual({ x: 0, y: 844 - BAR, w: 390, h: BAR });
    expect(layout.along).toBe('rows');
    expect(layout.bays.second!.y + layout.bays.second!.h).toBe(844 - BAR);
  });

  it('runs down the right edge of a turned phone, beside both bays', () => {
    const layout = stageLayout({ w: 844, h: 390 }, HALF, NOTHING, 'bays');

    expect(layout.bar).toEqual({ x: 844 - BAR, y: 0, w: BAR, h: 390 });
    expect(layout.along).toBe('columns');
    expect(layout.bays.second!.x + layout.bays.second!.w).toBe(844 - BAR);
  });

  it('leaves the bays the whole of the rest, and overlaps neither of them', () => {
    for (const stage of [
      { w: 390, h: 844 },
      { w: 844, h: 390 },
    ]) {
      const all = pieces(stageLayout(stage, HALF, NOTHING, 'bays'));
      expect(area(all)).toBe(stage.w * stage.h);
      for (const one of all) {
        for (const other of all) {
          expect(one === other || !overlap(one, other)).toBe(true);
        }
      }
    }
  });

  it('keeps a strip of the bottom bay above it when the bottom is put away', () => {
    const layout = stageLayout({ w: 390, h: 844 }, ['big', { small: 44 }], NOTHING, 'bays');

    expect(layout.bays.second!.h).toBe(44);
    expect(layout.bar!.y).toBe(layout.bays.second!.y + 44);
  });

  it('is not there in the spread', () => {
    expect(stageLayout({ w: 1400, h: 900 }, HALF, NOTHING, 'spread').bar).toBeNull();
  });
});
