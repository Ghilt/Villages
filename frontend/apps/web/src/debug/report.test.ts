import { describe, expect, it } from 'vitest';

import { describeState } from './report';
import type { MapState } from './report';

const state: MapState = {
  renderer: 'painted',
  zoom: 7,
  tileZoom: 7,
  flatMaxZoom: 7,
  masterWidth: 32768,
  tileSize: 256,
  centre: { lng: 0, lat: 0 },
  canvas: { width: 1280, height: 800 },
  pixelRatio: 1,
  painted: { ready: 0, waited: 0, aheadPainted: 0, held: 0 },
  worstFrameGap: 17.4,
  cells: ['3000000', '3000001', '3000002', '3000003'],
};

const valueOf = (from: MapState, label: string): string =>
  describeState(from).find((line) => line.label === label)?.value ?? '';

describe('saying where the terrain is coming from', () => {
  it('says it is as cut when the tiles are not being stretched', () => {
    expect(valueOf(state, 'terrain')).toBe('z7, as cut');
    expect(valueOf({ ...state, zoom: 4, tileZoom: 4 }, 'terrain')).toBe('z4, as cut');
  });

  it('says how far they are stretched once the detail has run out', () => {
    // This is the number that explains why a deep zoom looks the way it does, and it is not the zoom.
    expect(valueOf({ ...state, zoom: 8, tileZoom: 8 }, 'terrain')).toBe('z7 as cut, stretched 2x');
    expect(valueOf({ ...state, zoom: 10, tileZoom: 10 }, 'terrain')).toBe('z7 as cut, stretched 8x');
  });
});

describe('saying how much ground a pixel covers', () => {
  it('is one master pixel at the zoom the master was cut for', () => {
    expect(valueOf(state, 'a pixel is')).toContain('1.00 master px');
  });

  it('halves with every zoom in, and doubles with every zoom out', () => {
    expect(valueOf({ ...state, tileZoom: 8 }, 'a pixel is')).toContain('0.50 master px');
    expect(valueOf({ ...state, tileZoom: 5 }, 'a pixel is')).toContain('4.00 master px');
  });

  it('gives a distance in kilometres when it is one, and in metres when it is not', () => {
    // A master pixel is about 1.2 km at the equator, so zoom seven is kilometres and zoom ten is metres.
    expect(valueOf({ ...state, tileZoom: 7 }, 'a pixel is')).toMatch(/1\.2 km/);
    expect(valueOf({ ...state, tileZoom: 10 }, 'a pixel is')).toMatch(/1\d\d m/);
  });

  it('shrinks with the latitude, because Mercator stretches the far north', () => {
    const equator = valueOf(state, 'a pixel is');
    const north = valueOf({ ...state, centre: { lng: 0, lat: 60 } }, 'a pixel is');

    expect(equator).not.toBe(north);
    // Sixty degrees north is half the ground for the same pixel.
    expect(north).toMatch(/6\d\d m/);
  });
});

describe('saying how the looking ahead is going', () => {
  it('admits when nothing has been asked for yet', () => {
    expect(valueOf(state, 'painted')).toBe('nothing asked for yet, 0 ahead');
  });

  it('gives readiness as a share of what was asked for', () => {
    const busy = { ...state, painted: { ready: 3, waited: 1, aheadPainted: 40, held: 96 } };

    expect(valueOf(busy, 'painted')).toBe('75% ready (3/4), 40 ahead, 96 held');
  });
});

describe('the report as a whole', () => {
  it('always has a value for every line, so nothing reads as blank on the screen', () => {
    for (const line of describeState(state)) {
      expect(line.label.length).toBeGreaterThan(0);
      expect(line.value.length).toBeGreaterThan(0);
    }
  });

  it('says the zoom the camera is at and the zoom of the tiles, which differ', () => {
    expect(valueOf({ ...state, zoom: 8.62, tileZoom: 9 }, 'zoom')).toBe('8.62, asking for z9 tiles');
  });
});

describe('saying which cells the view covers', () => {
  it('says how many and at what zoom, because the count should not grow as you zoom out', () => {
    expect(valueOf(state, 'cells')).toContain('4 at z7');
  });

  it('names a few and counts the rest, so the line stays readable', () => {
    expect(valueOf(state, 'cells')).toBe('4 at z7: 3000000 3000001 3000002 and 1 more');
  });

  it('names them all when there are few enough to name', () => {
    expect(valueOf({ ...state, cells: ['12', '13'] }, 'cells')).toBe('2 at z7: 12 13');
  });

  it('says so plainly when the view covers nothing', () => {
    expect(valueOf({ ...state, cells: [] }, 'cells')).toBe('none');
  });
});
