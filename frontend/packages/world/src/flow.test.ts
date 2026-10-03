import { describe, expect, it } from 'vitest';

import { ACROSS_GAP, FROM_SEA, INLAND, STRANDED, riverFlow } from './flow.ts';
import type { ClassRaster } from './raster.ts';

const SEA = 0;
const LAKE = 2;
const RIVER = 3;
const FIELD = 9;
const classes = { sea: new Set([SEA]), lake: new Set([LAKE]), river: new Set([RIVER]) };
/**
 * These rasters are a few pixels wide: they do not join round as the world does, jump three pixels at most, and
 * a pixel of gap is worth five of river rather than fifty, so a detour need not be long to be one.
 */
const flat = { wraps: false, mercator: false, inlandLake: 4, bridge: 3, jumpCost: 5 };

/** A raster drawn in characters: `~` sea, `o` lake, `=` river, anything else land. */
function drawn(...rows: string[]): ClassRaster {
  const width = rows[0]!.length;
  const cells = new Uint8Array(width * rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x += 1) {
      const c = row[x];
      cells[y * width + x] = c === '~' ? SEA : c === 'o' ? LAKE : c === '=' ? RIVER : FIELD;
    }
  });
  return { width, height: rows.length, cells };
}

const at = (raster: ClassRaster, flow: ReturnType<typeof riverFlow>, x: number, y: number) => {
  const node = flow.nodeAt(y * raster.width + x);
  expect(node, `no water at ${x},${y}`).toBeGreaterThanOrEqual(0);
  return {
    east: flow.east[node]!,
    south: flow.south[node]!,
    reached: flow.reached[node]!,
    up: flow.upstream[node]!,
  };
};

describe('which way the rivers run', () => {
  it('runs a river to the sea, along its diagonal steps', () => {
    const raster = drawn('..........', '.==.......', '...==.....', '.....===~~', '........~~');
    const flow = riverFlow(raster, classes, flat);
    const source = at(raster, flow, 1, 1);
    expect(source.reached).toBe(FROM_SEA);
    expect(source.east).toBeGreaterThan(0.7);
    expect(at(raster, flow, 7, 3).east).toBeGreaterThan(0.9);
    // The mouth carries everything above it.
    expect(at(raster, flow, 7, 3).up).toBe(7);
  });

  it('measures how far down the river each pixel is, on the map', () => {
    const raster = drawn('..........', '.======~~~', '..........');
    const flow = riverFlow(raster, classes, flat);
    // One step from the sea, then one more for every pixel up the river.
    expect(flow.along[flow.nodeAt(1 * 10 + 6)]).toBeCloseTo(1);
    expect(flow.along[flow.nodeAt(1 * 10 + 1)]).toBeCloseTo(6);
    // On the map a step north or south is longer away from the equator, by the secant of the latitude.
    const onTheMap = riverFlow(drawn('~', '=', '=', '.'), classes, { ...flat, mercator: true });
    expect(onTheMap.along[onTheMap.nodeAt(2)]).toBeGreaterThan(2);
  });

  it('jumps a gap in a river, and runs the piece above it the same way', () => {
    const raster = drawn('............', '.===.====~~~', '............');
    const flow = riverFlow(raster, classes, flat);
    expect(at(raster, flow, 2, 1).reached).toBe(ACROSS_GAP);
    expect(at(raster, flow, 2, 1).east).toBeGreaterThan(0.9);
    expect(at(raster, flow, 6, 1).reached).toBe(FROM_SEA);
    expect(flow.gaps).toEqual([1 * 12 + 3, 1 * 12 + 5]);
  });

  it('never turns a joined river round for a jump to another river near its source', () => {
    // The upper river reaches the sea on its own, the long way round; its source is two pixels from a short
    // river that would be the quicker way out if a jump were cheap and allowed.
    const raster = drawn('.==========~', '.=..........', '............', '.=========~~');
    const flow = riverFlow(raster, classes, flat);
    const upper = at(raster, flow, 1, 1);
    expect(upper.reached).toBe(FROM_SEA);
    // Up and along its own course, not down towards the other river.
    expect(upper.south).toBeLessThan(0);
    expect(upper.east).toBeGreaterThan(0.9);
    expect(flow.gaps).toEqual([]);
  });

  it('takes a short break to the sea over a long way round through a touch into the next basin', () => {
    // The river has a break of two pixels before its own mouth, and its far end touches a long river that
    // reaches the sea the other way: the upper Elbe, joined to the Danube by a touch and broken below Dresden.
    const raster = drawn(
      '......................................',
      '~~..===========.......................',
      '..............=.......................',
      '..............=.......................',
      '..............======================~~',
    );
    const flow = riverFlow(raster, classes, flat);
    expect(at(raster, flow, 6, 1).reached).toBe(ACROSS_GAP);
    expect(at(raster, flow, 6, 1).east).toBeLessThan(-0.9);
    expect(at(raster, flow, 12, 1).east).toBeLessThan(-0.9);
  });

  it('lets a river whose tip brushes a dot of lake still jump to the sea', () => {
    // The Elbe at Hamburg: the estuary stops a few pixels short of the river, and a lake dot touches its tip.
    const raster = drawn('~~~...........', '~~~.o=========', '~~~...........');
    const flow = riverFlow(raster, classes, flat);
    expect(at(raster, flow, 8, 1).reached).toBe(ACROSS_GAP);
    expect(at(raster, flow, 8, 1).east).toBeLessThan(-0.9);
  });

  it('runs a river with no way to the sea into the lake it ends in', () => {
    const raster = drawn('.........', '.====.ooo', '......ooo');
    const flow = riverFlow(raster, classes, flat);
    const river = at(raster, flow, 2, 1);
    expect(river.reached).toBe(INLAND);
    expect(river.east).toBeGreaterThan(0.9);
    // Lakes are still.
    expect(at(raster, flow, 7, 1).east).toBe(0);
  });

  it('does not take a dot of a lake on a broken river for an inland sea', () => {
    // A one-pixel lake on a river whose way to the sea is broken by more than a jump: the river below the dot
    // would otherwise run back up into it.
    const raster = drawn('.................', '.===o===.....~~~~', '.................');
    const flow = riverFlow(raster, classes, flat);
    expect(at(raster, flow, 6, 1).reached).toBe(STRANDED);
    expect(at(raster, flow, 6, 1).east).toBe(0);
  });

  it('leaves a river with no water within a jump stranded and still', () => {
    const raster = drawn('.............', '.===......~~~', '.............');
    const flow = riverFlow(raster, classes, flat);
    const lost = at(raster, flow, 2, 1);
    expect(lost.reached).toBe(STRANDED);
    expect(lost.east).toBe(0);
    expect(lost.south).toBe(0);
  });
});
