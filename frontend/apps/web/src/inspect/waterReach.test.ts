import { describe, expect, it } from 'vitest';

import { diamondAt } from '@villages/world';

import { cellOf, cellsAlong, cellsAround, cutShort, keyOf, waterFrom } from './waterReach';

// A world of 64 cells across, not turned, so a cell's column and row are its world x and y: the master's own pixels.
const grid = { width: 64, turn: 0 };

/** The middle of the cell at a column and a row, as a place. */
function placeOf(column: number, row: number): { lng: number; lat: number } {
  const lng = ((column + 0.5) / grid.width) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (row + 0.5)) / grid.width))) * 180) / Math.PI;
  return { lng, lat };
}

/** Which columns of a row are in a set of cells. */
function columnsOf(cells: ReadonlySet<number>, row: number): number[] {
  return [...cells]
    .map(cellOf)
    .filter(([, at]) => at === row)
    .map(([column]) => column)
    .sort((one, other) => one - other);
}

// A river two cells wide down columns 30 and 31, and another down 40 and 41.
const rivers = (x: number) => (x >= 30 && x < 32) || (x >= 40 && x < 42);

describe('the water a click picks out', () => {
  it('is, for the sea, the water joined to the cell nearest the click, as far as the reach goes', () => {
    const click = placeOf(28, 32);
    expect(diamondAt(grid, click)).toEqual({ column: 28, row: 32 });

    const cells = cellsAround(click, grid, (x) => rivers(x), 5, 4);

    // Columns 30 and 31, two and three from the click: nine rows of each within five of it, and never the other.
    expect(cells.size).toBe(18);
    expect(columnsOf(cells, 32)).toEqual([30, 31]);
    expect(cellsAround(placeOf(20, 32), grid, (x) => rivers(x), 12, 4).size).toBe(0);
  });

  it('says when the water joined to a click runs on past its reach, which is when a nameless lake is read wider', () => {
    // A lake of nine cells across about the click, and the click in the middle of it.
    const lake = (x: number, y: number) => Math.abs(x - 32.5) < 5 && Math.abs(y - 32.5) < 5;
    const click = placeOf(32, 32);

    const short = cellsAround(click, grid, lake, 3, 4);
    const whole = cellsAround(click, grid, lake, 8, 4);

    expect(cutShort(click, grid, short, 3)).toBe(true);
    expect(cutShort(click, grid, whole, 8)).toBe(false);
    expect(whole.size).toBe(81);
  });

  it('is, for a named river, the water along its whole course, however its painting breaks', () => {
    // The river painted down column 30 from row 5 to row 50, with a gap in it from row 20 to row 24, and a tributary
    // joining it along row 40 from the east; the course as the names have it runs down column 30 the whole way.
    const painted = (x: number, y: number) =>
      (x >= 30 && x < 31 && y >= 5 && y < 51 && !(y >= 20 && y < 25)) ||
      (y >= 40 && y < 41 && x >= 30 && x < 60);
    const course = [[placeOf(30, 5), placeOf(30, 50)]];

    const cells = cellsAlong(course, grid, painted, 2, 4.5);

    // Both sides of the gap, which no flood from the click could cross.
    expect(columnsOf(cells, 10)).toEqual([30]);
    expect(columnsOf(cells, 45)).toEqual([30]);
    expect(columnsOf(cells, 22)).toEqual([]);
    // The tributary only as far as four and a half from the course: the cells whose middles are within it.
    expect(columnsOf(cells, 40)).toEqual([30, 31, 32, 33, 34]);
  });

  it('is, for a named lake, all of its water within its shores', () => {
    // A lake of rows 10 to 29 and columns 10 to 29, and its shores as the names have them, a ring round it.
    const lake = (x: number, y: number) => x >= 10 && x < 30 && y >= 10 && y < 30;
    const shores = [[placeOf(10, 10), placeOf(29, 10), placeOf(29, 29), placeOf(10, 29), placeOf(10, 10)]];

    expect(cellsAlong(shores, grid, lake, 2, null).size).toBe(400);
  });

  it('is followed along the water from the click, up and down a river, leaping a break and never the land', () => {
    // The same river down column 30 with its gap from row 20 to row 24, taken whole.
    const cells = new Set<number>();
    for (let row = 5; row < 51; row += 1) if (row < 20 || row >= 25) cells.add(keyOf(30, row));

    const across = waterFrom(placeOf(30, 30), grid, cells, 100, 2, 1000, 6);
    const at = (row: number) => across.find((one) => one.column === 30 && one.row === row)?.far;

    expect(across[0]).toEqual({ column: 30, row: 30, far: 0 });
    expect(at(50)).toBe(20);
    // Up over the gap: five rows of it leapt as one step of six.
    expect(at(19)).toBe(11);
    expect(at(5)).toBe(25);
    expect(across.map((one) => one.far)).toEqual([...across.map((one) => one.far)].sort((a, b) => a - b));
    // Without a leap the gap stops it, and it stops as far along as it is let and at as many cells.
    expect(waterFrom(placeOf(30, 30), grid, cells, 100, 2, 1000, 1).some((one) => one.row < 20)).toBe(false);
    expect(waterFrom(placeOf(30, 30), grid, cells, 5, 2, 1000, 1)).toHaveLength(11);
    expect(waterFrom(placeOf(30, 30), grid, cells, 100, 2, 7, 1)).toHaveLength(7);
  });
});
