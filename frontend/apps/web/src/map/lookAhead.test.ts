import { describe, expect, it } from 'vitest';

import { KEPT_TO_ZOOM, aroundAsked, paintedZoomAt, wayOut } from './lookAhead';
import type { TileAt } from './lookAhead';

const key = ({ zoom, x, y }: TileAt): string => `${zoom}/${x}/${y}`;

describe('what is painted around what the map asked for', () => {
  it('is the ring beside it first, then the four inside it, then the one and the two out', () => {
    const asked = { zoom: 5, x: 10, y: 10 };

    const around = aroundAsked([asked], 1).map(({ at }) => key(at));

    expect(around.slice(0, 8)).toHaveLength(8);
    expect(around.slice(0, 8).every((one) => one.startsWith('5/'))).toBe(true);
    expect(around.slice(8)).toEqual(['6/20/20', '6/21/20', '6/20/21', '6/21/21', '4/5/5', '3/2/2']);
  });

  it('keeps to the world: nothing past its edge, and nothing past the zooms that are painted', () => {
    const around = aroundAsked([{ zoom: 0, x: 0, y: 0 }], 1).map(({ at }) => key(at));

    expect(around).toEqual(['1/0/0', '1/1/0', '1/0/1', '1/1/1']);
  });

  it('says which request each was found around', () => {
    const asked = { zoom: 2, x: 1, y: 1, style: 'painted' };

    expect(aroundAsked([asked], 1).every(({ from }) => from === asked)).toBe(true);
  });
});

describe('the way out from where the game starts', () => {
  const HOUSE = { centre: { lng: -99.7, lat: 41.2 }, width: 1024, height: 768, zoom: 8.5 };

  it('starts a zoom out from the painted tiles the camera is drawn with', () => {
    expect(paintedZoomAt(8.5)).toBe(10);
    expect(wayOut(HOUSE)[0]?.zoom).toBe(9);
  });

  it("is a window's worth of tiles at every zoom out, and the whole world from the kept zooms out", () => {
    const tiles = wayOut(HOUSE);
    const at = (zoom: number) => tiles.filter((one) => one.zoom === zoom).length;

    // Four tiles across and three down, a half and a tile more on each side.
    expect(at(9)).toBeGreaterThanOrEqual(6 * 5);
    expect(at(9)).toBeLessThanOrEqual(8 * 7);
    for (let zoom = KEPT_TO_ZOOM; zoom >= 0; zoom -= 1) {
      expect(at(zoom)).toBe(4 ** zoom);
    }
    expect(new Set(tiles.map(key)).size).toBe(tiles.length);
  });

  it('paints the middle of each zoom first', () => {
    const nine = wayOut(HOUSE).filter((one) => one.zoom === 9);
    const middle = nine[0]!;
    const corner = nine[nine.length - 1]!;

    expect(Math.abs(middle.x - ((HOUSE.centre.lng + 180) / 360) * 512)).toBeLessThan(1);
    expect(Math.abs(corner.x - middle.x) + Math.abs(corner.y - middle.y)).toBeGreaterThan(2);
  });
});
