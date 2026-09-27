import { describe, expect, it } from 'vitest';

import {
  areaAround,
  closePath,
  diamondAt,
  diamondLattice,
  enclose,
  enclosedBy,
  fenceAround,
  fenceSize,
  fenceToPolygons,
  fenceWindow,
  insideFence,
  insideFenceAt,
  scanGrid,
} from './area.ts';
import type { DiamondGrid, DiamondSpan, EnclosedDiamonds, Fence } from './area.ts';
import { alongU, alongV, frameOf, worldXOf, worldYOf } from './lattice.ts';
import { onLattice } from './painterly.ts';
import { createRaster, fillPolygon, toPixel } from './raster.ts';
import type { Ring } from './raster.ts';
import { doubleSignedArea } from './simplify.ts';
import { MAX_MERCATOR_LATITUDE, fromWorld, toWorld } from './sphere.ts';

/**
 * A small world, square and unturned, so that a test can say what it means in diamonds and read the
 * answer in them: a corner of the grid is a point of world space, a whole number both ways.
 */
const SQUARE: DiamondGrid = { width: 360, turn: 0 };

/** The player's grid: the master's width, turned as the ground is. */
const TURNED: DiamondGrid = { width: 32768, turn: 26 };

/** Plenty: no test here draws anything near this, and the cap has a test of its own. */
const NO_CAP = 1_000_000;

/** About where Mordaunt stands, in world units, which is where the turned shapes are drawn. */
const NEAR = { x: 17721.6, y: 11089.7 };

const mordaunt = { lng: 14.695, lat: 49.871 };
const equator = { lng: 0, lat: 0 };

/** A holding's roughness, near what the web app asks for. */
const RAGGED = { seed: 7919, lumps: 0.25, jitter: 1.5 };

/** A path through points of world space, given in world units, arriving as a player's drag does: as places. */
function pathThrough(grid: DiamondGrid, ...points: readonly (readonly [number, number])[]): Ring {
  return points.map(([x, y]) => {
    const at = fromWorld(x, y, grid.width);
    return [at.lng, at.lat] as [number, number];
  });
}

/** A rectangle from one corner to another on the square grid, which everything else is checked against. */
function rectangle(left: number, top: number, right: number, bottom: number): Ring {
  return pathThrough(SQUARE, [left, top], [right, top], [right, bottom], [left, bottom]);
}

/** An irregular shape a few dozen units across, round a point of world space, as places. */
function blob(grid: DiamondGrid, around = NEAR, reach = 20): Ring {
  const points: [number, number][] = [];
  for (let step = 0; step < 17; step += 1) {
    const turn = (step / 17) * 2 * Math.PI;
    const out = reach * (0.7 + 0.3 * Math.sin(step * 2.3));
    points.push([around.x + Math.cos(turn) * out, around.y + Math.sin(turn) * out]);
  }
  return pathThrough(grid, ...points);
}

function cellsOf(spans: readonly DiamondSpan[]): Set<string> {
  const cells = new Set<string>();
  for (const span of spans) {
    for (let column = span.from; column <= span.to; column += 1) {
      cells.add(`${column},${span.row}`);
    }
  }
  return cells;
}

function diamondsOf(enclosed: EnclosedDiamonds): Set<string> {
  return cellsOf(enclosed.spans);
}

/** A square annulus, built by hand, because a hole is the case a drawn path reaches only by accident. */
function annulus(
  grid: DiamondGrid,
  outerFrom: number,
  outerTo: number,
  innerFrom: number,
  innerTo: number,
): EnclosedDiamonds {
  const spans: DiamondSpan[] = [];
  for (let row = outerFrom; row <= outerTo; row += 1) {
    if (row >= innerFrom && row <= innerTo) {
      spans.push({ row, from: outerFrom, to: innerFrom - 1 });
      spans.push({ row, from: innerTo + 1, to: outerTo });
    } else {
      spans.push({ row, from: outerFrom, to: outerTo });
    }
  }
  const side = outerTo - outerFrom + 1;
  return { grid, window: { x: outerFrom, y: outerFrom, width: side, height: side }, spans };
}

/** Even-odd, in world space, by a ray to the east: the brute force a scan is held to. */
function insidePolygon(points: readonly (readonly [number, number])[], x: number, y: number): boolean {
  let inside = false;
  for (let index = 0, before = points.length - 1; index < points.length; before = index, index += 1) {
    const [xi, yi] = points[index]!;
    const [xj, yj] = points[before]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** How long a fence is, in diamond edges. */
function perimeter(fence: Fence): number {
  let length = 0;
  for (const part of fence.parts) {
    for (const ring of [part.outer, ...part.holes]) {
      for (let index = 0; index + 1 < ring.length; index += 1) {
        length +=
          Math.abs(ring[index + 1]!.x - ring[index]!.x) + Math.abs(ring[index + 1]!.y - ring[index]!.y);
      }
    }
  }
  return length;
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

describe('the diamonds a path encloses', () => {
  it('takes exactly the diamonds inside a rectangle drawn on their corners', () => {
    const enclosed = enclose(rectangle(10, 20, 20, 30), SQUARE, NO_CAP);

    expect(enclosed.window).toEqual({ x: 10, y: 20, width: 10, height: 10 });
    expect(diamondsOf(enclosed).size).toBe(100);
  });

  it('agrees with fillPolygon on the same shape, so there is one scanline rule and not two', () => {
    // fillPolygon's own grid, a degree a pixel, and a path given on it: once inside it and once running off.
    const grid = { width: 360, height: 180 };
    const onRaster = (...corners: readonly (readonly [number, number])[]): Ring =>
      corners.map(([x, y]) => [x - 180, 90 - y] as [number, number]);

    for (const shape of [
      onRaster([12, 24], [40, 30], [33, 61], [15, 44]),
      onRaster([-20, -30], [40, -30], [40, 40], [-20, 40]),
    ]) {
      const raster = createRaster(grid.width, grid.height);
      fillPolygon(raster, [shape], 1);
      const painted = new Set<string>();
      for (let row = 0; row < grid.height; row += 1) {
        for (let column = 0; column < grid.width; column += 1) {
          if (raster.cells[row * grid.width + column] === 1) {
            painted.add(`${column},${row}`);
          }
        }
      }

      const points = shape.map(([lng, lat]) => toPixel({ lng, lat }, grid));
      const scanned = scanGrid(points, NO_CAP, {
        left: 0,
        top: 0,
        right: grid.width - 1,
        bottom: grid.height - 1,
      });

      expect(cellsOf(scanned.spans)).toEqual(painted);
    }
  });

  it('gives a diamond to a shape smaller than one, rather than losing what was drawn', () => {
    const speck = pathThrough(SQUARE, [10.2, 20.2], [10.4, 20.2], [10.4, 20.4]);

    expect(diamondsOf(enclose(speck, SQUARE, NO_CAP))).toEqual(new Set(['10,20']));
  });

  it('gives a speck on turned ground the diamond it sits in, and a speck off the world nothing', () => {
    const speck = pathThrough(TURNED, [NEAR.x, NEAR.y], [NEAR.x + 0.1, NEAR.y], [NEAR.x + 0.1, NEAR.y + 0.1]);
    const { column, row } = diamondAt(TURNED, { lng: speck[0]![0], lat: speck[0]![1] });

    expect(diamondsOf(enclose(speck, TURNED, NO_CAP))).toEqual(new Set([`${column},${row}`]));

    const pastTheLimit: Ring = [
      [10, 87],
      [10.001, 87],
      [10.001, 87.001],
    ];
    expect(enclose(pastTheLimit, TURNED, NO_CAP).spans).toEqual([]);
  });

  it('keeps only diamonds wholly on the world when a path runs off it, so nothing drawn can wrap round', () => {
    const small: DiamondGrid = { width: 360, turn: 26 };
    const frame = frameOf(diamondLattice(small));
    const enclosed = enclose(pathThrough(small, [-20, -30], [40, -30], [40, 40], [-20, 40]), small, NO_CAP);

    expect(enclosed.spans.length).toBeGreaterThan(0);
    // The ends of each run are enough: the world is convex, so what lies between two diamonds on it is too.
    for (const span of enclosed.spans) {
      for (const column of [span.from, span.to]) {
        for (const [du, dv] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ] as const) {
          const x = worldXOf(frame, column + du, span.row + dv);
          const y = worldYOf(frame, column + du, span.row + dv);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(small.width);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(small.width);
        }
      }
    }
    for (const polygon of fenceToPolygons(fenceAround(enclosed))) {
      for (const ring of polygon) {
        for (const [lng, lat] of ring) {
          expect(Math.abs(lng)).toBeLessThanOrEqual(180);
          expect(Math.abs(lat)).toBeLessThanOrEqual(MAX_MERCATOR_LATITUDE);
        }
      }
    }
  });

  it('takes on turned ground exactly the diamonds whose middle the shape covers', () => {
    const shape = blob(TURNED);
    const enclosed = enclose(shape, TURNED, NO_CAP);
    const frame = frameOf(diamondLattice(TURNED));
    const inWorld = shape.map(([lng, lat]) => {
      const at = toWorld({ lng, lat }, TURNED.width);
      return [at.x, at.y] as const;
    });

    const covered = new Set<string>();
    const { window } = enclosed;
    for (let row = window.y - 3; row < window.y + window.height + 3; row += 1) {
      for (let column = window.x - 3; column < window.x + window.width + 3; column += 1) {
        const x = worldXOf(frame, column + 0.5, row + 0.5);
        const y = worldYOf(frame, column + 0.5, row + 0.5);
        if (insidePolygon(inWorld, x, y)) {
          covered.add(`${column},${row}`);
        }
      }
    }

    expect(covered.size).toBeGreaterThan(500);
    expect(diamondsOf(enclosed)).toEqual(covered);
  });

  it('divides turned ground cut by any line between the two sides: none taken twice, and none missed', () => {
    // A square of world space cut north to south at a place no diamond's middle lies on.
    const cut = NEAR.x + 0.3141;
    const [left, right, top, bottom] = [NEAR.x - 25, NEAR.x + 25, NEAR.y - 25, NEAR.y + 25];
    const west = diamondsOf(
      enclose(pathThrough(TURNED, [left, top], [cut, top], [cut, bottom], [left, bottom]), TURNED, NO_CAP),
    );
    const east = diamondsOf(
      enclose(pathThrough(TURNED, [cut, top], [right, top], [right, bottom], [cut, bottom]), TURNED, NO_CAP),
    );
    const whole = diamondsOf(
      enclose(
        pathThrough(TURNED, [left, top], [right, top], [right, bottom], [left, bottom]),
        TURNED,
        NO_CAP,
      ),
    );

    expect([...west].filter((diamond) => east.has(diamond))).toEqual([]);
    expect(new Set([...west, ...east])).toEqual(whole);
  });

  it('refuses an area larger than it was told to count, rather than allocating it', () => {
    expect(() => enclose(rectangle(0, 0, 360, 360), SQUARE, 1000)).toThrow(/past the 1000 this counts up to/);
  });
});

describe('the fence around a set of diamonds', () => {
  it('traces one diamond as one square, which is what tells an outline from a hole', () => {
    const fence = fenceAround(
      enclose(pathThrough(SQUARE, [10.2, 20.2], [10.4, 20.2], [10.4, 20.4]), SQUARE, NO_CAP),
    );

    expect(fence.parts).toHaveLength(1);
    expect(fence.parts[0]!.outer).toHaveLength(5);
    expect(fence.parts[0]!.holes).toHaveLength(0);
    // The convention the rest of the file rests on: an outline is negative, a hole positive.
    expect(doubleSignedArea(fence.parts[0]!.outer)).toBeLessThan(0);
  });

  it('keeps only the corners of a straight run, so a rectangle is five vertices and not four thousand', () => {
    const fence = fenceAround(enclose(rectangle(10, 20, 20, 30), SQUARE, NO_CAP));

    expect(fence.parts[0]!.outer).toHaveLength(5);
  });

  it('encloses the diamonds it was built from, because the fence is the truth and the rest is derived', () => {
    for (const [grid, shape] of [
      [SQUARE, pathThrough(SQUARE, [12, 24], [40, 30], [33, 61], [15, 44])],
      [TURNED, blob(TURNED)],
    ] as const) {
      const enclosed = enclose(shape, grid, NO_CAP);

      expect(diamondsOf(enclosedBy(fenceAround(enclosed)))).toEqual(diamondsOf(enclosed));
    }
  });

  it('comes out the same whichever way round the path was drawn', () => {
    const path = blob(TURNED);
    const backwards = [...path].reverse();

    expect(diamondsOf(enclosedBy(fenceAround(enclose(backwards, TURNED, NO_CAP))))).toEqual(
      diamondsOf(enclosedBy(fenceAround(enclose(path, TURNED, NO_CAP)))),
    );
  });

  it('comes out the same wherever the path was started', () => {
    const path = blob(TURNED);
    const rotated = [...path.slice(5), ...path.slice(0, 5)];

    expect(diamondsOf(enclosedBy(fenceAround(enclose(rotated, TURNED, NO_CAP))))).toEqual(
      diamondsOf(enclosedBy(fenceAround(enclose(path, TURNED, NO_CAP)))),
    );
  });

  it('sits in the same window the diamonds did, so that asking either of them gives one answer', () => {
    const enclosed = enclose(blob(TURNED), TURNED, NO_CAP);

    expect(fenceWindow(fenceAround(enclosed))).toEqual(enclosed.window);
  });

  it('keeps a hole as a hole, so that what the ring goes around is not counted', () => {
    const fence = fenceAround(annulus(TURNED, 1000, 1019, 1005, 1014));

    expect(fence.parts).toHaveLength(1);
    expect(fence.parts[0]!.holes).toHaveLength(1);
    expect(fenceSize(fence)).toBe(20 * 20 - 10 * 10);
  });

  it('still encloses what a path that crosses itself covered, rather than losing a lobe', () => {
    const bowtie = pathThrough(SQUARE, [10, 20], [30, 40], [30, 20], [10, 40]);
    const enclosed = enclose(bowtie, SQUARE, NO_CAP);

    expect(fenceSize(fenceAround(enclosed))).toBe(diamondsOf(enclosed).size);
  });

  it('carries the grid it was drawn on, so nothing that reads it has to be told', () => {
    expect(fenceAround(enclose(blob(TURNED), TURNED, NO_CAP)).grid).toEqual(TURNED);
  });
});

describe('two areas drawn flush against each other', () => {
  const west = fenceAround(enclose(rectangle(10, 20, 20, 30), SQUARE, NO_CAP));
  const east = fenceAround(enclose(rectangle(20, 20, 30, 30), SQUARE, NO_CAP));

  it('divide the diamonds between them: none counted twice, and none missed', () => {
    const inWest = diamondsOf(enclosedBy(west));
    const inEast = diamondsOf(enclosedBy(east));
    const both = [...inWest].filter((diamond) => inEast.has(diamond));

    expect(both).toEqual([]);
    expect(inWest.size + inEast.size).toBe(
      fenceSize(fenceAround(enclose(rectangle(10, 20, 30, 30), SQUARE, NO_CAP))),
    );
  });

  it('share a boundary that lies on the same lattice line, so neither reaches past it', () => {
    expect(Math.max(...enclosedBy(west).spans.map((span) => span.to))).toBe(19);
    expect(Math.min(...enclosedBy(east).spans.map((span) => span.from))).toBe(20);
  });
});

describe('whether a diamond is inside a fence', () => {
  it('agrees with the count on every diamond around it, because a disagreement picks the wrong area', () => {
    const fence = fenceAround(annulus(SQUARE, 10, 29, 15, 24));
    const counted = diamondsOf(enclosedBy(fence));

    for (let row = 8; row <= 31; row += 1) {
      for (let column = 8; column <= 31; column += 1) {
        expect(insideFence(fence, column, row)).toBe(counted.has(`${column},${row}`));
      }
    }
  });

  it('agrees with the count at every place around a turned fence, asked by the place rather than the diamond', () => {
    const fence = fenceAround(annulus(TURNED, 1000, 1019, 1005, 1014));
    const counted = diamondsOf(enclosedBy(fence));
    const frame = frameOf(diamondLattice(TURNED));

    for (let row = 998; row <= 1021; row += 1) {
      for (let column = 998; column <= 1021; column += 1) {
        const middle = fromWorld(
          worldXOf(frame, column + 0.5, row + 0.5),
          worldYOf(frame, column + 0.5, row + 0.5),
          TURNED.width,
        );
        expect(insideFenceAt(fence, middle)).toBe(counted.has(`${column},${row}`));
      }
    }
  });
});

describe('the diamond a place is in', () => {
  it('is the one whose middle the painter reads its colour at, so the count and the picture are one ground', () => {
    for (const turn of [26, 45, 13]) {
      const grid = { width: 32768, turn };
      const frame = frameOf(diamondLattice(grid));
      const asked: { x: number; y: number }[] = [];
      const painter = onLattice((x, y) => {
        asked.push({ x, y });
        return 0;
      }, diamondLattice(grid));

      let tried = 0;
      for (let step = 0; step < 200; step += 1) {
        // A stride no lattice line keeps pace with, so the places fall all over their diamonds.
        const x = NEAR.x + step * 3.7137;
        const y = NEAR.y + step * 2.2891;
        const u = alongU(frame, x, y);
        const v = alongV(frame, x, y);
        if (Math.abs(u - Math.round(u)) < 1e-6 || Math.abs(v - Math.round(v)) < 1e-6) {
          continue; // On a line the answer flips for any step at all, which is what a line is.
        }
        tried += 1;
        asked.length = 0;
        painter(x, y);

        const { column, row } = diamondAt(grid, fromWorld(x, y, grid.width));
        expect(asked).toEqual([
          { x: worldXOf(frame, column + 0.5, row + 0.5), y: worldYOf(frame, column + 0.5, row + 0.5) },
        ]);
      }
      expect(tried).toBeGreaterThan(190);
    }
  });

  it('is the tile pixel the painter reads on square ground, where it reads the place itself', () => {
    const square = { width: 32768, turn: 0 };
    for (let step = 0; step < 50; step += 1) {
      const x = NEAR.x + step * 3.7137;
      const y = NEAR.y + step * 2.2891;
      const { column, row } = diamondAt(square, fromWorld(x, y, square.width));

      expect([column, row]).toEqual([Math.floor(x), Math.floor(y)]);
    }
  });
});

describe('a fence in longitude and latitude', () => {
  it('puts its vertices on the corners of diamonds, so the line is drawn where the count changes', () => {
    const fence = fenceAround(enclose(rectangle(10, 20, 20, 30), SQUARE, NO_CAP));
    const polygons = fenceToPolygons(fence);

    expect(polygons).toHaveLength(1);
    expect(polygons[0]!).toHaveLength(1);
    expect(polygons[0]![0]!).toHaveLength(5);
    for (const [lng, lat] of polygons[0]![0]!) {
      const at = toWorld({ lng, lat }, SQUARE.width);
      expect(at.x).toBeCloseTo(Math.round(at.x), 9);
      expect(at.y).toBeCloseTo(Math.round(at.y), 9);
    }
  });

  it('puts every vertex on turned ground on a corner of the turned diamonds, and steps along them', () => {
    const frame = frameOf(diamondLattice(TURNED));
    for (const fence of [
      fenceAround(enclose(blob(TURNED), TURNED, NO_CAP)),
      areaAround(mordaunt, TURNED, 25, RAGGED),
    ]) {
      for (const part of fence.parts) {
        for (const ring of [part.outer, ...part.holes]) {
          for (let index = 0; index + 1 < ring.length; index += 1) {
            const from = ring[index]!;
            const to = ring[index + 1]!;
            expect(Number.isInteger(from.x) && Number.isInteger(from.y)).toBe(true);
            // Along a row or down a column, never across both, which is what stepping along the grid is.
            expect(from.x === to.x).not.toBe(from.y === to.y);
          }
        }
      }

      let corners = 0;
      for (const polygon of fenceToPolygons(fence)) {
        for (const ring of polygon) {
          for (const [lng, lat] of ring) {
            const at = toWorld({ lng, lat }, TURNED.width);
            const u = alongU(frame, at.x, at.y);
            const v = alongV(frame, at.x, at.y);
            expect(Math.abs(u - Math.round(u))).toBeLessThan(1e-6);
            expect(Math.abs(v - Math.round(v))).toBeLessThan(1e-6);
            corners += 1;
          }
        }
      }
      expect(corners).toBeGreaterThan(8);
    }
  });

  it('winds an outline one way and a hole the other, which is how a map tells them apart', () => {
    const [outer, hole] = fenceToPolygons(fenceAround(annulus(TURNED, 1000, 1019, 1005, 1014)))[0]!;
    const signed = (ring: readonly [number, number][]) => doubleSignedArea(ring.map(([x, y]) => ({ x, y })));

    // Counter-clockwise with latitude up, as GeoJSON has an outline, and a hole the other way.
    expect(signed(outer!)).toBeGreaterThan(0);
    expect(signed(hole!)).toBeLessThan(0);
  });
});

describe('an area drawn a reach round a point', () => {
  it('encloses the point it is drawn round, ragged or not', () => {
    expect(insideFenceAt(areaAround(mordaunt, TURNED, 20), mordaunt)).toBe(true);
    expect(insideFenceAt(areaAround(mordaunt, TURNED, 20, RAGGED), mordaunt)).toBe(true);
  });

  it('is one piece with nothing missing out of it and no corner it only touches, however ragged', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const fence = areaAround(mordaunt, TURNED, 25, { seed, lumps: 0.3, jitter: 2.5 });

      expect(fence.parts).toHaveLength(1);
      expect(fence.parts[0]!.holes).toHaveLength(0);
      // A ring that touched itself at a corner would pass through that corner twice.
      const outer = fence.parts[0]!.outer;
      expect(new Set(outer.slice(0, -1).map((point) => `${point.x},${point.y}`)).size).toBe(outer.length - 1);
    }
  });

  it('holds about as many diamonds as a circle of that reach, round or ragged', () => {
    const reach = 30;
    const circle = Math.PI * reach * reach;
    const round = fenceSize(areaAround(mordaunt, TURNED, reach));

    expect(round).toBeGreaterThan(circle * 0.95);
    expect(round).toBeLessThan(circle * 1.05);
    for (const seed of [1, 2, 3]) {
      const ragged = fenceSize(areaAround(mordaunt, TURNED, reach, { ...RAGGED, seed }));
      expect(ragged).toBeGreaterThan(circle * 0.8);
      expect(ragged).toBeLessThan(circle * 1.2);
    }
  });

  it('comes out the same for the same seed and otherwise for another, so every screen draws one shape', () => {
    expect(areaAround(mordaunt, TURNED, 25, RAGGED)).toEqual(areaAround(mordaunt, TURNED, 25, RAGGED));
    expect(areaAround(mordaunt, TURNED, 25, { ...RAGGED, seed: RAGGED.seed + 1 })).not.toEqual(
      areaAround(mordaunt, TURNED, 25, RAGGED),
    );
  });

  it('has a longer, more broken edge ragged than round', () => {
    expect(perimeter(areaAround(mordaunt, TURNED, 25, RAGGED))).toBeGreaterThan(
      perimeter(areaAround(mordaunt, TURNED, 25)) * 1.2,
    );
  });

  it('is round on the ground: as wide as it is tall in world space, turned or not', () => {
    for (const grid of [TURNED, { width: 32768, turn: 0 }]) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (const [lng, lat] of fenceToPolygons(areaAround(mordaunt, grid, 25))[0]![0]!) {
        const at = toWorld({ lng, lat }, grid.width);
        xs.push(at.x);
        ys.push(at.y);
      }
      const wide = Math.max(...xs) - Math.min(...xs);
      const tall = Math.max(...ys) - Math.min(...ys);

      expect(Math.abs(wide - tall)).toBeLessThan(2);
    }
  });

  it('is the same size wherever it is, north or on the equator, because a diamond is', () => {
    const north = fenceSize(areaAround(mordaunt, TURNED, 25));
    const middle = fenceSize(areaAround(equator, TURNED, 25));

    // Within two percent: what differs is where the staircase falls, not how much ground there is.
    expect(Math.abs(north - middle) / middle).toBeLessThan(0.02);
  });

  it('grows with the reach', () => {
    const small = fenceSize(areaAround(equator, TURNED, 10));
    const large = fenceSize(areaAround(equator, TURNED, 20));

    expect(large).toBeGreaterThan(small * 3);
  });

  it('refuses a reach that would swallow the world rather than allocating one', () => {
    expect(() => areaAround(equator, TURNED, 100_000)).toThrow(/past the/);
  });
});
