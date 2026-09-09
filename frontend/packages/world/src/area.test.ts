import { describe, expect, it } from 'vitest';

import {
  closePath,
  enclose,
  enclosedBy,
  fenceAround,
  fenceSize,
  fenceToPolygons,
  fenceWindow,
  insideFence,
} from './area.ts';
import type { EnclosedPixels, PixelSpan } from './area.ts';
import { createRaster, fillPolygon } from './raster.ts';
import type { Ring } from './raster.ts';
import { doubleSignedArea } from './simplify.ts';

/** A degree a pixel, so that a test can say what it means in pixels and read the answer in them. */
const GRID = { width: 360, height: 180 };

/** Plenty: no test here draws anything near this, and the cap has a test of its own. */
const NO_CAP = 1_000_000;

/** A path through the corners of pixels. On this grid a corner is a whole number in both directions. */
function pathThrough(...corners: readonly (readonly [number, number])[]): Ring {
  return corners.map(([x, y]) => [x - 180, 90 - y] as [number, number]);
}

/** A rectangle from one pixel corner to another, which is the shape everything else is checked against. */
function rectangle(left: number, top: number, right: number, bottom: number): Ring {
  return pathThrough([left, top], [right, top], [right, bottom], [left, bottom]);
}

function pixelsOf(enclosed: EnclosedPixels): Set<string> {
  const pixels = new Set<string>();
  for (const span of enclosed.spans) {
    for (let column = span.from; column <= span.to; column += 1) {
      pixels.add(`${column},${span.row}`);
    }
  }
  return pixels;
}

/** A square annulus, built by hand, because a hole is the case a drawn path reaches only by accident. */
function annulus(outerFrom: number, outerTo: number, innerFrom: number, innerTo: number): EnclosedPixels {
  const spans: PixelSpan[] = [];
  for (let row = outerFrom; row <= outerTo; row += 1) {
    if (row >= innerFrom && row <= innerTo) {
      spans.push({ row, from: outerFrom, to: innerFrom - 1 });
      spans.push({ row, from: innerTo + 1, to: outerTo });
    } else {
      spans.push({ row, from: outerFrom, to: outerTo });
    }
  }
  const side = outerTo - outerFrom + 1;
  return { window: { x: outerFrom, y: outerFrom, width: side, height: side }, spans };
}

describe('closing a path', () => {
  it('joins the ends, which is what lets a player let go of the mouse anywhere', () => {
    const open = rectangle(10, 20, 20, 30);
    const closed = closePath(open);

    expect(closed).toHaveLength(open.length + 1);
    expect(closed[closed.length - 1]).toEqual(closed[0]);
  });

  it('leaves a path whose ends already meet alone, so closing twice is closing once', () => {
    const closed = closePath(rectangle(10, 20, 20, 30));

    expect(closePath(closed)).toEqual(closed);
  });
});

describe('the pixels a path encloses', () => {
  it('takes exactly the pixels inside a rectangle drawn on their corners', () => {
    const enclosed = enclose(rectangle(10, 20, 20, 30), GRID, NO_CAP);

    expect(enclosed.window).toEqual({ x: 10, y: 20, width: 10, height: 10 });
    expect(pixelsOf(enclosed).size).toBe(100);
  });

  it('agrees with fillPolygon on the same shape, so there is one scanline rule and not two', () => {
    const path = pathThrough([12, 24], [40, 30], [33, 61], [15, 44]);
    const raster = createRaster(GRID.width, GRID.height);
    fillPolygon(raster, [path], 1);

    const painted = new Set<string>();
    for (let row = 0; row < GRID.height; row += 1) {
      for (let column = 0; column < GRID.width; column += 1) {
        if (raster.cells[row * GRID.width + column] === 1) {
          painted.add(`${column},${row}`);
        }
      }
    }

    expect(pixelsOf(enclose(path, GRID, NO_CAP))).toEqual(painted);
  });

  it('gives a pixel to a shape smaller than one, rather than losing what was drawn', () => {
    const speck = pathThrough([10.2, 20.2], [10.4, 20.2], [10.4, 20.4]);

    expect(pixelsOf(enclose(speck, GRID, NO_CAP))).toEqual(new Set(['10,20']));
  });

  it('stays inside the world when a path runs off it', () => {
    const overhanging = pathThrough([-20, -30], [40, -30], [40, 40], [-20, 40]);
    const enclosed = enclose(overhanging, GRID, NO_CAP);

    expect(enclosed.window.x).toBeGreaterThanOrEqual(0);
    expect(enclosed.window.y).toBeGreaterThanOrEqual(0);
    for (const span of enclosed.spans) {
      expect(span.row).toBeLessThan(GRID.height);
      expect(span.to).toBeLessThan(GRID.width);
    }
  });

  it('refuses an area larger than it was told to count, rather than allocating it', () => {
    expect(() => enclose(rectangle(0, 0, 360, 180), GRID, 1000)).toThrow(/past the 1000 this counts up to/);
  });
});

describe('the fence around a set of pixels', () => {
  it('traces one pixel as one square, which is what tells an outline from a hole', () => {
    const fence = fenceAround(enclose(pathThrough([10.2, 20.2], [10.4, 20.2], [10.4, 20.4]), GRID, NO_CAP));

    expect(fence.parts).toHaveLength(1);
    expect(fence.parts[0]!.outer).toHaveLength(5);
    expect(fence.parts[0]!.holes).toHaveLength(0);
    // The convention the rest of the file rests on: an outline is negative, a hole positive.
    expect(doubleSignedArea(fence.parts[0]!.outer)).toBeLessThan(0);
  });

  it('keeps only the corners of a straight run, so a rectangle is five vertices and not four thousand', () => {
    const fence = fenceAround(enclose(rectangle(10, 20, 20, 30), GRID, NO_CAP));

    expect(fence.parts[0]!.outer).toHaveLength(5);
  });

  it('encloses the pixels it was built from, because the fence is the truth and the rest is derived', () => {
    const enclosed = enclose(pathThrough([12, 24], [40, 30], [33, 61], [15, 44]), GRID, NO_CAP);

    expect(pixelsOf(enclosedBy(fenceAround(enclosed)))).toEqual(pixelsOf(enclosed));
  });

  it('comes out the same whichever way round the path was drawn', () => {
    const path = pathThrough([12, 24], [40, 30], [33, 61], [15, 44]);
    const backwards = [...path].reverse();

    expect(pixelsOf(enclosedBy(fenceAround(enclose(backwards, GRID, NO_CAP))))).toEqual(
      pixelsOf(enclosedBy(fenceAround(enclose(path, GRID, NO_CAP)))),
    );
  });

  it('comes out the same wherever the path was started', () => {
    const path = pathThrough([12, 24], [40, 30], [33, 61], [15, 44]);
    const rotated = [...path.slice(2), ...path.slice(0, 2)];

    expect(pixelsOf(enclosedBy(fenceAround(enclose(rotated, GRID, NO_CAP))))).toEqual(
      pixelsOf(enclosedBy(fenceAround(enclose(path, GRID, NO_CAP)))),
    );
  });

  it('sits in the same window the pixels did, so that asking either of them gives one answer', () => {
    const enclosed = enclose(pathThrough([12, 24], [40, 30], [33, 61], [15, 44]), GRID, NO_CAP);

    expect(fenceWindow(fenceAround(enclosed))).toEqual(enclosed.window);
  });

  it('keeps a hole as a hole, so that what the ring goes around is not counted', () => {
    const fence = fenceAround(annulus(10, 29, 15, 24));

    expect(fence.parts).toHaveLength(1);
    expect(fence.parts[0]!.holes).toHaveLength(1);
    expect(fenceSize(fence)).toBe(20 * 20 - 10 * 10);
  });

  it('still encloses what a path that crosses itself covered, rather than losing a lobe', () => {
    const bowtie = pathThrough([10, 20], [30, 40], [30, 20], [10, 40]);
    const enclosed = enclose(bowtie, GRID, NO_CAP);

    expect(fenceSize(fenceAround(enclosed))).toBe(pixelsOf(enclosed).size);
  });
});

describe('two areas drawn flush against each other', () => {
  const west = fenceAround(enclose(rectangle(10, 20, 20, 30), GRID, NO_CAP));
  const east = fenceAround(enclose(rectangle(20, 20, 30, 30), GRID, NO_CAP));

  it('divide the pixels between them: none counted twice, and none missed', () => {
    const inWest = pixelsOf(enclosedBy(west));
    const inEast = pixelsOf(enclosedBy(east));
    const both = [...inWest].filter((pixel) => inEast.has(pixel));

    expect(both).toEqual([]);
    expect(inWest.size + inEast.size).toBe(
      fenceSize(fenceAround(enclose(rectangle(10, 20, 30, 30), GRID, NO_CAP))),
    );
  });

  it('share a boundary that lies on the same lattice line, so neither reaches past it', () => {
    expect(Math.max(...enclosedBy(west).spans.map((span) => span.to))).toBe(19);
    expect(Math.min(...enclosedBy(east).spans.map((span) => span.from))).toBe(20);
  });
});

describe('whether a pixel is inside a fence', () => {
  it('agrees with the count on every pixel around it, because a disagreement picks the wrong area', () => {
    const fence = fenceAround(annulus(10, 29, 15, 24));
    const counted = pixelsOf(enclosedBy(fence));

    for (let row = 8; row <= 31; row += 1) {
      for (let column = 8; column <= 31; column += 1) {
        expect(insideFence(fence, column, row)).toBe(counted.has(`${column},${row}`));
      }
    }
  });
});

describe('a fence in longitude and latitude', () => {
  it('puts its vertices on the corners of pixels, so the line is drawn where the count changes', () => {
    const fence = fenceAround(enclose(rectangle(10, 20, 20, 30), GRID, NO_CAP));
    const polygons = fenceToPolygons(fence, GRID);

    expect(polygons).toHaveLength(1);
    expect(polygons[0]!).toHaveLength(1);
    expect(polygons[0]![0]!).toHaveLength(5);
    for (const [lng, lat] of polygons[0]![0]!) {
      expect(lng + 180).toBeCloseTo(Math.round(lng + 180), 10);
      expect(90 - lat).toBeCloseTo(Math.round(90 - lat), 10);
    }
  });
});
