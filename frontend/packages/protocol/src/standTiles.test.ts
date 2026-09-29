import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { STANDS_FROM_ZOOM, STAND_TILES, STAND_TILE_MARGIN, standTilesUnder } from './standTiles';

const fixture = JSON.parse(
  readFileSync(new URL('../../../../contracts/fixtures/stand-tiles.json', import.meta.url), 'utf8'),
) as {
  tiles: number;
  margin: number;
  fromZoom: number;
  vectors: { name: string; cell: string; tiles: [number, number][] }[];
};

describe('the shared vectors, which the Kotlin side is held to as well', () => {
  it('has all of them, on this grid', () => {
    expect(fixture.vectors).toHaveLength(10);
    expect(fixture.tiles).toBe(STAND_TILES);
    expect(fixture.margin).toBe(STAND_TILE_MARGIN);
    expect(fixture.fromZoom).toBe(STANDS_FROM_ZOOM);
  });

  it.each(fixture.vectors)('answers $name', (vector) => {
    const wanted = vector.tiles.map(([x, y]) => y * STAND_TILES + x).sort((a, b) => a - b);
    expect([...standTilesUnder(vector.cell)].sort((a, b) => a - b)).toEqual(wanted);
  });
});
