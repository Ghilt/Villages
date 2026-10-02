import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { MAX_ZOOM, cellAt, cellAtZoom, cellsForView, coarsestZoom, isInside } from './cells';

const vectors = JSON.parse(
  readFileSync(new URL('../../../../contracts/fixtures/cells.json', import.meta.url), 'utf8'),
) as {
  maxZoom: number;
  zooms: number[];
  vectors: { name: string; lat: number; lon: number; quadkeys: Record<string, string> }[];
  coarsestZoom: { cases: { significance: number; zoom: number }[] };
};

describe('the shared vectors, which the Kotlin side is held to as well', () => {
  it('goes as deep as the fixture says', () => {
    expect(MAX_ZOOM).toBe(vectors.maxZoom);
  });

  it.each(vectors.vectors)('puts $name in the right cell at every zoom', (vector) => {
    for (const zoom of vectors.zooms) {
      expect(cellAt(vector.lat, vector.lon, zoom)).toBe(vector.quadkeys[String(zoom)]);
    }
  });

  it.each(vectors.coarsestZoom.cases)(
    'draws a thing of significance $significance from zoom $zoom',
    (one) => {
      expect(coarsestZoom(one.significance)).toBe(one.zoom);
    },
  );

  it.each(vectors.vectors)('rolls $name up to the same cells it would be asked for', (vector) => {
    const deepest = cellAt(vector.lat, vector.lon);
    for (const zoom of vectors.zooms) {
      expect(cellAtZoom(deepest, zoom)).toBe(vector.quadkeys[String(zoom)]);
    }
  });
});

describe('a cell and its ancestors', () => {
  it('puts a cell inside every ancestor of it, and inside the whole world', () => {
    const cell = cellAt(59.33, 18.07);

    for (let zoom = 0; zoom <= MAX_ZOOM; zoom += 1) {
      expect(isInside(cell, cellAtZoom(cell, zoom))).toBe(true);
    }
    expect(isInside(cell, '')).toBe(true);
  });

  it('keeps two places in different halves of the world out of each other', () => {
    const west = cellAt(0, -90, 2);
    const east = cellAt(0, 90, 2);

    expect(isInside(west, east)).toBe(false);
    expect(isInside(east, west)).toBe(false);
  });
});

describe('how far out a thing is drawn', () => {
  it('draws the legendary from the whole world and the ordinary only from close up', () => {
    expect(coarsestZoom(100)).toBe(0);
    expect(coarsestZoom(0)).toBe(MAX_ZOOM);
  });

  it('agrees with the worked example: a house at 20 appears at zoom 8, a cathedral at 85 at zoom 2', () => {
    expect(coarsestZoom(20)).toBe(8);
    expect(coarsestZoom(85)).toBe(2);
  });

  it('never draws a lesser thing from further out than a greater one', () => {
    for (let lesser = 0; lesser <= 100; lesser += 5) {
      for (let greater = lesser; greater <= 100; greater += 5) {
        expect(coarsestZoom(lesser)).toBeGreaterThanOrEqual(coarsestZoom(greater));
      }
    }
  });

  it('answers with a zoom the grid has, whatever it is handed', () => {
    for (const odd of [-1000, -0.5, 100.5, 1000, Number.MAX_SAFE_INTEGER]) {
      expect(coarsestZoom(odd)).toBeGreaterThanOrEqual(0);
      expect(coarsestZoom(odd)).toBeLessThanOrEqual(MAX_ZOOM);
    }
  });
});

describe('the cells covering a view', () => {
  const around = (lat: number, lon: number, zoom: number, span = 0.5) => ({
    north: lat + span,
    south: lat - span,
    east: lon + span,
    west: lon - span,
    zoom,
  });

  it('covers the place being looked at', () => {
    const cells = cellsForView(around(55.5, 10.5, 6));

    expect(cells).toContain(cellAt(55.5, 10.5, 6));
  });

  it('asks at the zoom the camera is at, not at a fixed depth', () => {
    for (const zoom of [2, 5, 8]) {
      for (const cell of cellsForView(around(55.5, 10.5, zoom))) {
        expect(cell).toHaveLength(zoom);
      }
    }
  });

  it('takes the whole world at zoom zero as one cell', () => {
    expect(cellsForView({ north: 85, south: -85, east: 180, west: -180, zoom: 0 })).toEqual(['']);
  });

  it('stays about the same size however far out you are, which is the point', () => {
    // A screen is a fixed number of tiles across, not a fixed number of degrees: the span a screen
    // covers halves every time the grid deepens, so the count of cells does not grow with the zoom.
    for (let zoom = 0; zoom <= MAX_ZOOM; zoom += 1) {
      const tile = 360 / 2 ** zoom;
      const cells = cellsForView({
        north: 55.5 + tile,
        south: 55.5 - tile,
        east: 10.5 + tile * 2,
        west: 10.5 - tile * 2,
        zoom,
      });

      expect(cells.length).toBeLessThanOrEqual(40);
    }
  });

  it('asks for more when told to look past the edge of the view', () => {
    const tight = cellsForView(around(55.5, 10.5, 6));
    const loose = cellsForView(around(55.5, 10.5, 6), 1);

    expect(loose.length).toBeGreaterThan(tight.length);
    for (const cell of tight) {
      expect(loose).toContain(cell);
    }
  });

  it('never asks for the same cell twice, or for one off the edge of the world', () => {
    const cells = cellsForView({ north: 85, south: -85, east: 180, west: -180, zoom: 3 }, 2);

    expect(new Set(cells).size).toBe(cells.length);
    expect(cells).toHaveLength(8 * 8);
  });

  it('wraps around the back of the world rather than asking for nothing', () => {
    const across = cellsForView({ north: 10, south: -10, east: -175, west: 175, zoom: 4 });

    expect(across).toContain(cellAt(0, 179, 4));
    expect(across).toContain(cellAt(0, -179, 4));
  });
});
