import { describe, expect, it } from 'vitest';

import { floorZoom } from '../map/sheet';
import type { Viewport } from '../map/sheet';
import { worldSize } from '../geometry/cameraMath';

import { deskCoversView, deskOnScreen } from './deskTop';

/** The shapes the stage can actually be: a wide desktop, a squeezed one, and both phone toggles. */
const STAGES: Viewport[] = [
  { width: 1600, height: 900 },
  { width: 1280, height: 720 },
  { width: 928, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
];

/** The sheet as it lies at the floor with the world under the middle of the window. */
function atFloor(viewport: Viewport) {
  const size = worldSize(floorZoom(viewport));
  return { left: (viewport.width - size) / 2, top: (viewport.height - size) / 2, size };
}

describe('the desk', () => {
  it('covers the window at the floor with the sheet in the middle, on every shape the stage can be', () => {
    for (const viewport of STAGES) {
      const desk = deskOnScreen(atFloor(viewport), viewport);
      expect(deskCoversView(desk, viewport, 1)).toBe(true);
    }
  });

  it('covers the window at every zoom above the floor too, where the sheet is only larger', () => {
    const viewport = { width: 1600, height: 900 };
    for (const zoom of [floorZoom(viewport), 0, 2, 4, 8]) {
      const size = worldSize(zoom);
      const sheet = { left: (viewport.width - size) / 2, top: (viewport.height - size) / 2, size };
      expect(deskCoversView(deskOnScreen(sheet, viewport), viewport, 1)).toBe(true);
    }
  });

  it('is centred on the sheet, so it slides under the camera as the map is panned', () => {
    const viewport = { width: 1600, height: 900 };
    const here = deskOnScreen({ left: 300, top: 200, size: 450 }, viewport);
    const there = deskOnScreen({ left: 500, top: 200, size: 450 }, viewport);
    expect(there.left - here.left).toBeCloseTo(200);
    expect(there.width).toBeCloseTo(here.width);
  });

  it('shows an edge once the sheet is shoved hard against one side of the window', () => {
    // At the floor the sheet may be dragged flush to an edge, and a rigid desk centred on it then reaches
    // only so far the other way. That is the desk being an object rather than a backdrop.
    const viewport = { width: 1600, height: 900 };
    const sheet = atFloor(viewport);
    const flush = { ...sheet, left: viewport.width - sheet.size };
    expect(deskCoversView(deskOnScreen(flush, viewport), viewport, 1)).toBe(false);
  });

  it('stops covering the window as the pull shrinks it', () => {
    const viewport = { width: 1600, height: 900 };
    const desk = deskOnScreen(atFloor(viewport), viewport);
    expect(deskCoversView(desk, viewport, 1)).toBe(true);
    expect(deskCoversView(desk, viewport, 0.5)).toBe(false);
  });

  it('is drawn back about the point the room is looked round from, not only the middle', () => {
    const viewport = { width: 1600, height: 900 };
    const desk = { left: -2000, top: -1000, width: 5000, height: 3000 };
    // Drawn back about the middle it still reaches every edge; about the top left corner the same scale
    // pulls its right edge in past the window's.
    expect(deskCoversView(desk, viewport, 0.4)).toBe(true);
    expect(deskCoversView(desk, viewport, 0.4, { x: 0, y: 0 })).toBe(false);
  });

  it('is squashed down as the room tips, and stops reaching the bottom of the window sooner', () => {
    const viewport = { width: 1600, height: 900 };
    const desk = { left: -2000, top: -1000, width: 5000, height: 3000 };
    expect(deskCoversView(desk, viewport, 0.4, undefined, 1)).toBe(true);
    expect(deskCoversView(desk, viewport, 0.4, undefined, Math.SQRT1_2)).toBe(false);
  });

  it('is wider than it is deep, whatever the shape of the window', () => {
    for (const viewport of STAGES) {
      const desk = deskOnScreen(atFloor(viewport), viewport);
      expect(desk.width).toBeGreaterThan(desk.height);
    }
  });
});
