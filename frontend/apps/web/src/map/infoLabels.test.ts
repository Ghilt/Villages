import { describe, expect, it } from 'vitest';

import { placeLabels } from './infoLabels';
import type { LabelCandidate } from './infoLabels';

const screen = { width: 400, height: 300 };
const label = (x: number, y: number, priority: number, anchor: LabelCandidate['anchor'] = 'centre') => ({
  x,
  y,
  width: 80,
  height: 14,
  priority,
  anchor,
});

describe('placing the names on the Info map', () => {
  it('writes the more important of two names that would cover each other, and not the other', () => {
    const placed = placeLabels([label(100, 100, 5), label(120, 104, 1)], screen);
    expect(placed.map((one) => one.priority)).toEqual([1]);
  });

  it('writes both of two names that do not meet', () => {
    expect(placeLabels([label(100, 100, 2), label(100, 160, 3)], screen)).toHaveLength(2);
  });

  it('does not write the same words twice close together, and does far apart', () => {
    const named = (x: number, y: number) => ({ ...label(x, y, 1), key: 'Vistula Lagoon' });
    expect(placeLabels([named(100, 100), named(120, 150)], screen, 150)).toHaveLength(1);
    expect(placeLabels([named(60, 40), named(320, 260)], screen, 150)).toHaveLength(2);
  });

  it('leaves out a name that would run off the screen', () => {
    expect(placeLabels([label(10, 100, 1), label(395, 100, 1, 'beside')], screen)).toHaveLength(0);
  });

  it('puts a name beside its point to the right, and a centred one about it', () => {
    const [beside] = placeLabels([label(100, 100, 1, 'beside')], screen);
    expect(beside!.box[0]).toBeGreaterThan(100);
    const [centred] = placeLabels([label(200, 100, 1)], screen);
    expect(centred!.box[0]).toBeLessThan(200);
    expect(centred!.box[2]).toBeGreaterThan(200);
  });
});
