import { describe, expect, it } from 'vitest';

import { WORLD_MASTER_WIDTH } from '../map/worldStyle';
import { pixelsPerWorldUnit, toMercatorExact } from '../sprites/cameraMath';
import type { CameraView } from '../sprites/cameraMath';

import type { FogCircle } from './circles';
import { fieldOf } from './fogField';
import { maskOf, uncolouringTransform, wanderAt } from './uncolouring';

const seat: FogCircle = { x: 17_000, y: 9_000, radius: 50, grown: 50, lasting: true };
const ended: FogCircle = { x: 17_300, y: 9_000, radius: 50, grown: 50, lasting: false };

/** How opaque the grey is over the texel a piece of ground falls in. */
function opacityAt(x: number, y: number): number {
  const field = fieldOf([seat, ended])!;
  const mask = maskOf(field);
  const column = Math.floor((x - field.originX) / field.unitsPerTexel);
  const row = Math.floor((y - field.originY) / field.unitsPerTexel);
  return mask[(row * field.width + column) * 4 + 3]!;
}

describe('the grey the map loses its colour under', () => {
  it('is opaque on ground only revealed, and clear in vision and on unknown ground', () => {
    expect(opacityAt(17_300, 9_000)).toBe(255);
    expect(opacityAt(17_000, 9_000)).toBe(0);
    expect(opacityAt(17_150, 9_000)).toBe(0);
  });

  it('is a middling grey everywhere, which has no colour of its own to lend', () => {
    const mask = maskOf(fieldOf([seat, ended])!);
    for (let at = 0; at < mask.length; at += 4 * 97) {
      expect([mask[at], mask[at + 1], mask[at + 2]]).toEqual([128, 128, 128]);
    }
  });
});

describe('the wander of the edge, as the fog shader has it close in', () => {
  it('stays within a unit and a half or so, and is the same wherever it is asked twice', () => {
    for (let x = 16_000; x < 16_050; x += 1.7) {
      const wander = wanderAt(x, 9_000 + x / 7);
      expect(Math.abs(wander)).toBeLessThanOrEqual(1.6);
      expect(wanderAt(x, 9_000 + x / 7)).toBe(wander);
    }
  });

  it('wanders rather than standing still', () => {
    const along = Array.from({ length: 40 }, (_, step) => wanderAt(16_000 + step, 9_000));
    expect(Math.max(...along) - Math.min(...along)).toBeGreaterThan(0.5);
  });
});

/** The fog shader's way back from a pixel to its ground, written out again so the transform is held to it. */
function groundUnder(view: CameraView, x: number, y: number): { x: number; y: number } {
  const turn = ((view.bearing ?? 0) * Math.PI) / 180;
  const lean = Math.cos(((view.pitch ?? 0) * Math.PI) / 180);
  const onX = x - view.width / 2;
  const along = (y - view.height / 2) / lean;
  const centre = toMercatorExact(view.center);
  const scale = pixelsPerWorldUnit(view.zoom);
  return {
    x: centre.x * WORLD_MASTER_WIDTH + (onX * Math.cos(turn) - along * Math.sin(turn)) / scale,
    y: centre.y * WORLD_MASTER_WIDTH + (onX * Math.sin(turn) + along * Math.cos(turn)) / scale,
  };
}

describe('where the grey is laid on the screen', () => {
  const view: CameraView = {
    center: { lng: 14.94, lat: 49.86 },
    zoom: 9.3,
    width: 928,
    height: 720,
    pitch: 45,
    bearing: 20,
  };

  it('puts the ground under the middle of the camera in the middle of the view', () => {
    const [a, b, c, d, e, f] = uncolouringTransform(view);
    const centre = toMercatorExact(view.center);
    const x = centre.x * WORLD_MASTER_WIDTH;
    const y = centre.y * WORLD_MASTER_WIDTH;

    expect(a * x + c * y + e).toBeCloseTo(view.width / 2, 6);
    expect(b * x + d * y + f).toBeCloseTo(view.height / 2, 6);
  });

  it('puts every piece of ground where the fog shader finds it, tipped and turned', () => {
    const [a, b, c, d, e, f] = uncolouringTransform(view);
    for (const [px, py] of [
      [0, 0],
      [100, 650],
      [900, 30],
      [464, 360],
    ] as const) {
      const ground = groundUnder(view, px, py);
      expect(a * ground.x + c * ground.y + e).toBeCloseTo(px, 4);
      expect(b * ground.x + d * ground.y + f).toBeCloseTo(py, 4);
    }
  });
});
