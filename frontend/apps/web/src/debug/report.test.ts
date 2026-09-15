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
  viewport: { width: 1280, height: 800 },
  // At zoom 7 the world is 65536 pixels across, so it covers any window; the floor and the fit are the
  // 1280 by 800 window's own, half of 800 being 400 and the fit being where 512 * 2^z reaches 1280.
  sheet: { size: 65536, covers: true, floor: -0.36, fit: 1.32, atFloor: 0.5 },
  painted: { ready: 0, waited: 0, aheadPainted: 0, held: 0 },
  worstFrameGap: 17.4,
  cells: ['3000000', '3000001', '3000002', '3000003'],
  houses: { drawn: 12, held: 4, omitted: 0 },
  areas: { drawn: 0, armed: false, selected: null },
  world: { today: 454901, earliest: 437635, viewingAt: null },
  player: { id: '3c8f9e1a-0000-4000-8000-000000000001', connection: 'open', house: null },
  choice: null,
  selected: null,
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

describe('saying what the player has to decide', () => {
  it('says nothing to decide when there is no parchment', () => {
    expect(valueOf(state, 'choice')).toBe('nothing to decide');
  });

  it('says what is being asked and how many ways there are to answer it', () => {
    const asked = { prompt: 'Where shall the house raise its seat?', options: 3, acting: false };

    expect(valueOf({ ...state, choice: asked }, 'choice')).toBe(
      '"Where shall the house raise its seat?", 3 options',
    );
  });

  it('says when an answer is in flight, because a parchment that looks stuck is not', () => {
    const answering = { prompt: 'Where shall the house raise its seat?', options: 3, acting: true };

    expect(valueOf({ ...state, choice: answering }, 'choice')).toBe(
      '"Where shall the house raise its seat?", 3 options, answering',
    );
  });
});

describe('saying what is selected', () => {
  it('says nothing when nothing is', () => {
    expect(valueOf(state, 'selected')).toBe('nothing');
  });

  it('names what is selected rather than identifying it', () => {
    const picked = { kind: 'house', name: 'Ravenscar' };

    expect(valueOf({ ...state, selected: picked }, 'selected')).toBe('house: Ravenscar');
  });
});

describe('saying where the sheet lies', () => {
  it('says the sheet covers the view while the world is bigger than the window', () => {
    expect(valueOf(state, 'sheet')).toBe('covers the view');
  });

  it('gives the sheet as a share of the shorter side once it is on the desk, naming the side', () => {
    const onTheDesk = { ...state, zoom: 0, tileZoom: 0, sheet: { ...state.sheet, size: 512, covers: false } };

    expect(valueOf(onTheDesk, 'sheet')).toBe("512 px, 64% of the view's height, on the desk");
    expect(valueOf({ ...onTheDesk, viewport: { width: 500, height: 900 } }, 'sheet')).toBe(
      "512 px, 102% of the view's width, on the desk",
    );
  });

  it('says where the floor is and from where the sheet covers the view, since both move with the window', () => {
    expect(valueOf(state, 'floor')).toBe(
      'z-0.36 (the sheet at 50% of the shorter side), covers the view from z1.32',
    );
  });
});

describe('saying what areas are drawn', () => {
  it('says none rather than nothing at all, so the row never reads as broken', () => {
    expect(valueOf(state, 'areas')).toBe('none drawn');
    expect(valueOf(state, 'area')).toBe('none selected');
  });

  it('says when the next drag paints instead of moving the camera, because that is surprising', () => {
    const armed = { ...state, areas: { ...state.areas, armed: true } };

    expect(valueOf(armed, 'areas')).toBe('none drawn, drawing');
  });

  it('counts the selected area in master pixels, which is the unit a hand paints in', () => {
    const one = {
      ...state,
      areas: { drawn: 2, armed: false, selected: { id: 'a-1', pixels: 5603, kinds: 7 } },
    };

    expect(valueOf(one, 'areas')).toBe('2 drawn');
    expect(valueOf(one, 'area')).toBe('a-1: 5,603 master px, 7 kinds');
  });

  it('says an area is not counted yet rather than showing a nought that would read as empty ground', () => {
    const counting = {
      ...state,
      areas: { drawn: 1, armed: false, selected: { id: 'a-1', pixels: 5603, kinds: null } },
    };

    expect(valueOf(counting, 'area')).toBe('a-1: 5,603 master px, not counted yet');
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

  it('names the one cell at zoom 0, whose quadkey is the empty string, rather than trailing off', () => {
    expect(valueOf({ ...state, tileZoom: 0, cells: [''] }, 'cells')).toBe('1 at z0: the whole world');
  });
});

describe('saying what the gateway has handed over', () => {
  it('says how many houses are drawn from how many cells', () => {
    expect(valueOf(state, 'houses')).toBe('12 drawn from 4 cells');
  });

  it('says when a crowd was cut, so what is drawn is never mistaken for all there is', () => {
    expect(valueOf({ ...state, houses: { drawn: 200, held: 1, omitted: 47 } }, 'houses')).toBe(
      '200 drawn from 1 cell, 47 more not sent',
    );
  });

  it('says so when nothing has been asked for yet', () => {
    expect(valueOf({ ...state, houses: { drawn: 0, held: 0, omitted: 0 } }, 'houses')).toBe(
      'no cells held yet',
    );
  });
});

describe('saying which day the map is showing', () => {
  it('names today and says the map is live', () => {
    expect(valueOf(state, 'world')).toBe('year 1247, day 112 today, showing live');
  });

  it('names the day being looked at when the scrubber has been moved', () => {
    expect(
      valueOf({ ...state, world: { today: 454901, earliest: 437635, viewingAt: 437635 } }, 'world'),
    ).toBe('year 1247, day 112 today, showing year 1200');
  });

  it('says so before the gateway has spoken', () => {
    expect(valueOf({ ...state, world: null }, 'world')).toBe('not heard from the gateway yet');
  });
});

describe('saying who is playing here', () => {
  const asPlayer = (over: Partial<MapState['player']>) => ({
    ...state,
    player: { ...state.player, ...over },
  });

  it('names the player and says this window is the one playing', () => {
    expect(valueOf(state, 'player')).toBe('3c8f9e1a, playing here');
  });

  it('says plainly when another window has taken over, because this one has stopped', () => {
    expect(valueOf(asPlayer({ connection: 'takenOver' }), 'player')).toBe(
      '3c8f9e1a, taken over in another window',
    );
  });

  it('says when the connection went away, which is not the same thing', () => {
    expect(valueOf(asPlayer({ connection: 'closed' }), 'player')).toBe('3c8f9e1a, the connection closed');
  });

  it('copes with having heard nothing yet', () => {
    expect(valueOf(asPlayer({ id: undefined, connection: 'connecting' }), 'player')).toBe(
      'not introduced yet, connecting',
    );
  });

  it('names your house, or says you have none', () => {
    expect(valueOf(state, 'house')).toBe('none yet');
    expect(valueOf(asPlayer({ house: 'Ravenscar 42, founded year 1200' }), 'house')).toBe(
      'Ravenscar 42, founded year 1200',
    );
  });
});
