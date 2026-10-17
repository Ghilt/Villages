import { afterEach, describe, expect, it } from 'vitest';

import { quadkeyOf } from '@villages/protocol';
import type { RuinsMapFile } from '@villages/world';
import { encodeStands } from '@villages/world/build';
import type * as maplibregl from 'maplibre-gl';

import { followStandsUnder, forgetStands, standsArrived } from '../net/stands';
import { drawRuins } from './infoRuins';

/** Records the way the gateway sends them. */
const recordsOf = (x: number, y: number, tileX: number, tileY: number): string =>
  btoa(
    String.fromCharCode(
      ...encodeStands([{ x, y, reach: 13, dominant: 1, thickness: 0.5, seed: 3 }], tileX, tileY, 256),
    ),
  );

/** A map that projects longitude and latitude straight to pixels, which is all the rings ask of it. */
const map = {
  project: ([lng, lat]: [number, number]) => ({ x: lng * 100, y: lat * 100 }),
} as unknown as maplibregl.Map;

/** A canvas that counts the rings drawn on it. */
function canvas(): { context: CanvasRenderingContext2D; rings: number[] } {
  const rings: number[] = [];
  const context = {
    beginPath: () => undefined,
    stroke: () => undefined,
    setLineDash: () => undefined,
    arc: (_x: number, _y: number, radius: number) => rings.push(radius),
  } as unknown as CanvasRenderingContext2D;
  return { context, rings };
}

const file = { ring: 0.3 } as RuinsMapFile;

describe('the ruins on the Info map', () => {
  afterEach(() => forgetStands());

  it('draws a town sent in every tile its ruins reach once, as its built ring and its reach', () => {
    // A town on the edge between tiles 70 and 71, its record in both, as world:ruins writes it.
    const x = 71 * 256 + 2;
    const y = 37 * 256 + 100;
    followStandsUnder([
      quadkeyOf({ zoom: 10, x: 70 * 8 + 3, y: 37 * 8 + 3 }),
      quadkeyOf({ zoom: 10, x: 71 * 8 + 3, y: 37 * 8 + 3 }),
    ]);
    standsArrived(70, 37, recordsOf(x, y, 70, 37), 'ruins');
    standsArrived(71, 37, recordsOf(x, y, 71, 37), 'ruins');

    const { context, rings } = canvas();
    expect(drawRuins(context, map, file)).toBe(1);
    expect(rings).toHaveLength(2);
    expect(rings[0]! * 1.3).toBeCloseTo(rings[1]!, 5);
  });

  it('draws nothing of the scenery, nor anything the game server did not send', () => {
    followStandsUnder([quadkeyOf({ zoom: 10, x: 70 * 8 + 3, y: 37 * 8 + 3 })]);
    standsArrived(70, 37, recordsOf(70 * 256 + 50, 37 * 256 + 50, 70, 37), 'biome');
    const { context, rings } = canvas();
    expect(drawRuins(context, map, file)).toBe(0);
    expect(rings).toEqual([]);
  });
});
