import { describe, expect, it } from 'vitest';

import { fillUnassigned } from './fill.ts';
import { createRaster } from './raster.ts';
import type { ClassRaster } from './raster.ts';

const SENTINEL = 255;
const OCEAN = 0;

/** A raster written out as characters: `.` sea, `?` unassigned, a digit for a terrain. */
function paint(rows: string[]): ClassRaster {
  const raster = createRaster(rows[0]!.length, rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((mark, x) => {
      raster.cells[y * raster.width + x] =
        mark === '.' ? OCEAN : mark === '?' ? SENTINEL : Number.parseInt(mark, 10);
    });
  });
  return raster;
}

const show = (raster: ClassRaster): string[] => {
  const rows: string[] = [];
  for (let y = 0; y < raster.height; y += 1) {
    let row = '';
    for (let x = 0; x < raster.width; x += 1) {
      const value = raster.cells[y * raster.width + x]!;
      row += value === OCEAN ? '.' : value === SENTINEL ? '?' : String(value);
    }
    rows.push(row);
  }
  return rows;
};

const options = { sentinel: SENTINEL, blocked: new Set([OCEAN]), fallback: 8 };

describe('filling the pixels nobody assigned', () => {
  it('takes the terrain behind it, not the sea in front', () => {
    const raster = paint(['...', '?55', '...']);

    const report = fillUnassigned(raster, options);

    expect(show(raster)).toEqual(['...', '555', '...']);
    expect(report).toMatchObject({ unassigned: 1, filled: 1, fellBack: 0 });
  });

  it('fills a fringe several pixels deep, inwards', () => {
    const raster = paint(['......', '.??66.', '.??66.', '......']);

    const report = fillUnassigned(raster, options);

    expect(show(raster)).toEqual(['......', '.6666.', '.6666.', '......']);
    expect(report.passes).toBeGreaterThan(1);
  });

  it('gives a pixel the terrain most of its neighbours have', () => {
    const raster = paint(['555', '5?7', '557']);

    fillUnassigned(raster, options);

    expect(raster.cells[4]).toBe(5);
  });

  it('leaves assigned terrain alone', () => {
    const raster = paint(['5566', '5?66', '5566']);
    const before = show(raster);

    fillUnassigned(raster, options);

    expect(show(raster)[0]).toBe(before[0]);
    expect(show(raster)[2]).toBe(before[2]);
  });

  it('falls back when there is no terrain to take, rather than leaving a hole', () => {
    const raster = paint(['...', '.?.', '...']);

    const report = fillUnassigned(raster, options);

    expect(raster.cells[4]).toBe(8);
    expect(report).toMatchObject({ filled: 0, fellBack: 1 });
  });

  it('never spreads the sea onto the land', () => {
    const raster = paint(['....', '.?5.', '....']);

    fillUnassigned(raster, options);

    expect(raster.cells).not.toContain(SENTINEL);
    expect(raster.cells[5]).toBe(5);
  });

  it('leaves nothing unassigned, whatever it started from', () => {
    const raster = paint(['?.?5', '??7?', '5??.', '.??6']);

    fillUnassigned(raster, options);

    expect([...raster.cells]).not.toContain(SENTINEL);
  });

  it('gives the same world every time, whichever way the fringe is walked', () => {
    const rows = ['......', '.?5?7.', '.??7?.', '......'];
    const first = paint(rows);
    const second = paint(rows);

    fillUnassigned(first, options);
    fillUnassigned(second, options);

    expect(show(first)).toEqual(show(second));
  });

  it('does nothing at all when there is nothing unassigned', () => {
    const raster = paint(['55', '66']);

    expect(fillUnassigned(raster, options)).toMatchObject({ unassigned: 0, filled: 0, passes: 0 });
  });

  it('stops when told to, and falls back on what is left', () => {
    const raster = paint(['..........', '.????????5', '..........']);

    const report = fillUnassigned(raster, { ...options, maxPasses: 2 });

    expect(report.passes).toBe(2);
    expect(report.fellBack).toBeGreaterThan(0);
    expect([...raster.cells]).not.toContain(SENTINEL);
  });
});
