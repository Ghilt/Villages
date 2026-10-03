import { describe, expect, it } from 'vitest';

import { RIVER, mendRivers, nearestSeaWater } from './mendRivers.ts';
import { createRaster } from './raster.ts';
import type { ClassRaster } from './raster.ts';

/** A raster written out as characters: `.` ocean, `L` lake, `~` river, `#` meadow. */
const CLASSES: Record<string, number> = { '.': 0, L: 2, '~': RIVER, '#': 17 };

function paint(rows: string[]): ClassRaster {
  const raster = createRaster(rows[0]!.length, rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((mark, x) => {
      raster.cells[y * raster.width + x] = CLASSES[mark]!;
    });
  });
  return raster;
}

/** Mends, checks that only land became river, and draws the result with `+` for every painted pixel. */
function mend(rows: string[], maxGap: number) {
  const raster = paint(rows);
  const report = mendRivers(raster, { maxGap });
  for (const index of report.painted) {
    expect(raster.cells[index]).toBeGreaterThan(RIVER);
  }
  const drawn = rows.map((row) => [...row]);
  for (const index of report.painted) {
    drawn[Math.floor(index / raster.width)]![index % raster.width] = '+';
  }
  return { report, rows: drawn.map((row) => row.join('')) };
}

describe('mending the breaks in rivers', () => {
  it('joins a river that touches the sea only at a corner with one pixel', () => {
    const { report, rows } = mend(['..######', '.~######', '##~~~###'], 4);
    expect(report.painted).toHaveLength(1);
    expect(rows).toEqual(['..######', '.~+#####', '##~~~###']);
    expect(report.riverPiecesAtSeaBefore).toBe(1);
    expect(report.riverPiecesAtSeaAfter).toBe(2);
  });

  it('bridges a three pixel gap with three pixels', () => {
    const { rows, report } = mend(['######..~~###~~~########'], 3);
    expect(rows).toEqual(['######..~~+++~~~########']);
    expect(report.bridges).toEqual([{ cost: 3, at: 11 }]);
    expect(report.stranded).toEqual([]);
  });

  it('leaves a gap longer than the limit alone and names the river it strands', () => {
    const { rows, report } = mend(['######..~~####~~~########'], 3);
    expect(rows).toEqual(['######..~~####~~~########']);
    expect(report.stranded).toEqual([{ riverPixels: 3, at: 14 }]);
    expect([...report.strandedPixels]).toEqual([14, 15, 16]);
    expect(report.riverPiecesAtSeaAfter).toBe(1);
    expect(nearestSeaWater(paint(rows), report.strandedPixels, 14, 10)).toEqual({ gap: 4, at: 9 });
    expect(nearestSeaWater(paint(rows), report.strandedPixels, 14, 3)).toBeNull();
  });

  it('steps through a lake on the way to the sea, and never bridges a lake that no river needs', () => {
    const { rows } = mend(
      [
        '########~~#LLL#....########',
        '###########################',
        '###########################',
        '################LL#....####',
      ],
      3,
    );
    expect(rows).toEqual([
      '########~~+LLL+....########',
      '###########################',
      '###########################',
      '################LL#....####',
    ]);
  });

  it('joins two rivers to each other and then once to the sea, when that is fewer pixels', () => {
    const { report } = mend(
      ['#############', '###~~#~~#####', '#############', '#############', '#############', '.............'],
      4,
    );
    expect(report.painted).toHaveLength(4);
    expect(report.riverPiecesAtSeaAfter).toBe(2);
  });

  it('bridges across the antimeridian when that is the shorter way', () => {
    const { rows } = mend(['~###......##'], 4);
    expect(rows).toEqual(['~###......++']);
  });

  it('paints nothing in a world whose rivers already reach the sea', () => {
    const { report } = mend(['#~~~....#', '#~#######'], 8);
    expect(report.painted).toHaveLength(0);
    expect(report.bridges).toEqual([]);
  });

  it('counts two rivers that reach the sea apart as two, not as the one sea they reach', () => {
    const { report } = mend(['#~.~#', '#####'], 8);
    expect(report.riverPieces).toBe(2);
    expect(report.riverPiecesAtSeaBefore).toBe(2);
  });

  it('goes over the world until nothing more joins, so that running it again paints nothing', () => {
    let seed = 7;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const rows = Array.from({ length: 40 }, (_, y) =>
      Array.from({ length: 60 }, () =>
        y >= 36 ? '.' : random() < 0.08 ? '~' : random() < 0.01 ? 'L' : '#',
      ).join(''),
    );
    const once = mend(rows, 3);
    const twice = mend(
      once.rows.map((row) => row.replaceAll('+', '~')),
      3,
    );
    expect(once.report.painted.length).toBeGreaterThan(0);
    expect(twice.report.painted).toHaveLength(0);
    expect(twice.report.stranded).toEqual(once.report.stranded);
  });

  it('refuses a limit that is not a whole number of pixels', () => {
    expect(() => mendRivers(paint(['~#.']), { maxGap: 0 })).toThrow();
    expect(() => mendRivers(paint(['~#.']), { maxGap: 2.5 })).toThrow();
  });
});
