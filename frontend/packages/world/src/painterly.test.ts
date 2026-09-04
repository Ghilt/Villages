import { describe, expect, it } from 'vitest';

import {
  fbm,
  hash2,
  mix,
  paintPixel,
  painterlyProblems,
  preparePainterly,
  smoothstep,
  treatment,
  valueNoise,
} from './painterly.ts';
import type { ClassSampler, PainterlyStyle, TreatmentKind } from './painterly.ts';
import type { Palette } from './palette.ts';

const palette: Palette = {
  master: { width: 64, height: 32, projection: 'equirectangular' },
  classes: [
    { id: 0, name: 'ocean', colour: '#104058', water: true, group: 'water' },
    { id: 1, name: 'meadow', colour: '#88cc44', group: 'open' },
    { id: 2, name: 'taiga', colour: '#226644', group: 'forest' },
  ],
};

const colours = { ocean: '#93aebc', meadow: '#c4ce8d', taiga: '#6e9078' };

const style: PainterlyStyle = {
  warm: '#fff0cf',
  cool: '#4a5a58',
  wash: { amount: 0.16, mark: 46 },
  boundary: { wander: 1.4, scale: 3 },
  edge: { amount: 0.16, reach: 1.4 },
  shore: { ink: '#5f5544', amount: 0.55 },
  paper: { grain: 0.1, mark: 2.2, fibre: 0.03 },
  groups: {
    water: { treatment: 'ripple', mark: 9, amount: 0.035, wash: 0.3 },
    open: { treatment: 'speckle', mark: 2.6, amount: 0.055 },
    forest: { treatment: 'stipple', mark: 3.2, amount: 0.11 },
  },
};

const OCEAN = 0;
const MEADOW = 1;
const TAIGA = 2;

/** Terrain that is the same everywhere, so only the medium can vary. */
const everywhereMeadow: ClassSampler = () => MEADOW;
/** Two kinds of land meeting at a hundred, with no water anywhere. */
const meadowMeetsTaiga: ClassSampler = (x) => (x < 100 ? MEADOW : TAIGA);
/** Land meeting sea at a hundred. */
const meadowMeetsOcean: ClassSampler = (x) => (x < 100 ? MEADOW : OCEAN);

const luminance = (colour: readonly [number, number, number]): number =>
  colour[0] * 0.299 + colour[1] * 0.587 + colour[2] * 0.114;

/** The average of a column, over enough rows that the noise in the medium cancels out. */
function averageDown(
  sampler: ClassSampler,
  at: number,
  of: (colour: readonly [number, number, number]) => number,
  prepared = preparePainterly(style, palette, colours),
  masterPerPixel = 1,
): number {
  let total = 0;
  const rows = 240;
  for (let row = 0; row < rows; row += 1) {
    total += of(paintPixel(prepared, sampler, at, row * 0.5, masterPerPixel));
  }
  return total / rows;
}

describe('the noise the paint is made of', () => {
  it('gives the same value for the same place, always', () => {
    expect(hash2(7, 9, 3)).toBe(hash2(7, 9, 3));
    expect(valueNoise(1.25, -3.5, 11)).toBe(valueNoise(1.25, -3.5, 11));
  });

  it('stays inside zero and one', () => {
    for (let index = 0; index < 400; index += 1) {
      const x = index * 0.37 - 70;
      const y = index * -0.61 + 25;
      expect(hash2(index, -index, 5)).toBeGreaterThanOrEqual(0);
      expect(hash2(index, -index, 5)).toBeLessThan(1);
      expect(valueNoise(x, y, 5)).toBeGreaterThanOrEqual(0);
      expect(valueNoise(x, y, 5)).toBeLessThanOrEqual(1);
      expect(fbm(x, y, 5, 3)).toBeGreaterThanOrEqual(0);
      expect(fbm(x, y, 5, 3)).toBeLessThanOrEqual(1);
    }
  });

  it('is the lattice hash exactly at a lattice point, which is what makes it interpolation', () => {
    expect(valueNoise(4, -2, 17)).toBeCloseTo(hash2(4, -2, 17), 12);
  });

  it('tells two seeds apart', () => {
    expect(valueNoise(2.5, 2.5, 1)).not.toBeCloseTo(valueNoise(2.5, 2.5, 2), 6);
  });

  it('eases rather than steps', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 12);
    // A degenerate range is a step, and must not divide by zero.
    expect(smoothstep(1, 1, 0.5)).toBe(0);
    expect(smoothstep(1, 1, 1.5)).toBe(1);
  });
});

describe('the mark each kind of ground is drawn with', () => {
  const kinds: TreatmentKind[] = [
    'none',
    'speckle',
    'stipple',
    'hatch',
    'dunes',
    'dashes',
    'ripple',
    'patchwork',
  ];

  it('leaves the colour alone when there is no treatment', () => {
    expect(treatment('none', 3.5, -1.25, 7)).toBe(0);
  });

  it('stays within a band, so no treatment can wash a class out on its own', () => {
    for (const kind of kinds) {
      for (let index = 0; index < 300; index += 1) {
        const value = treatment(kind, index * 0.23, index * -0.41 + 3, 7);
        expect(Math.abs(value)).toBeLessThanOrEqual(1.35);
      }
    }
  });

  it('actually varies, or it would be doing nothing', () => {
    for (const kind of kinds.filter((candidate) => candidate !== 'none')) {
      const samples = new Set<number>();
      for (let index = 0; index < 40; index += 1) {
        samples.add(Math.round(treatment(kind, index * 0.7, index * 1.3, 7) * 1000));
      }
      expect(samples.size).toBeGreaterThan(4);
    }
  });
});

describe('mixing two colours', () => {
  it('lands on each end at each end', () => {
    expect(mix([10, 20, 30], [200, 210, 220], 0)).toEqual([10, 20, 30]);
    expect(mix([10, 20, 30], [200, 210, 220], 1)).toEqual([200, 210, 220]);
  });

  it('holds at the ends rather than running past them', () => {
    expect(mix([10, 20, 30], [200, 210, 220], -3)).toEqual([10, 20, 30]);
    expect(mix([10, 20, 30], [200, 210, 220], 4)).toEqual([200, 210, 220]);
  });

  it('meets in the middle', () => {
    expect(mix([0, 0, 0], [100, 200, 250], 0.5)).toEqual([50, 100, 125]);
  });
});

describe('a style that cannot be used', () => {
  it('says which group has no treatment', () => {
    const missing = { ...style, groups: { water: style.groups.water!, open: style.groups.open! } };

    expect(painterlyProblems(missing as PainterlyStyle, palette, colours)).toContain(
      'no treatment for the forest group',
    );
  });

  it('says which treatment is for nothing', () => {
    const extra = { ...style, groups: { ...style.groups, tundra: style.groups.open! } };

    expect(painterlyProblems(extra, palette, colours)).toContain(
      'a treatment for tundra, which no terrain class is in',
    );
  });

  it('says which class has no colour to paint', () => {
    const fewer = { ocean: colours.ocean, meadow: colours.meadow };

    expect(painterlyProblems(style, palette, fewer)).toContain('world/render.json has no colour for taiga');
  });

  it('refuses a mark of no size, which would divide by zero for every pixel', () => {
    const flat = { ...style, paper: { ...style.paper, mark: 0 } };

    expect(painterlyProblems(flat, palette, colours)).toContain(
      'the paper mark must be a positive number of pixels',
    );
  });

  it('reports every problem at once, so one run says all of what to fix', () => {
    const broken = { ...style, paper: { ...style.paper, mark: 0 }, wash: { amount: 0.1, mark: -2 } };
    const fewer = { ocean: colours.ocean, meadow: colours.meadow };

    expect(painterlyProblems(broken, palette, fewer).length).toBe(3);
  });

  it('will not prepare itself when it is unusable', () => {
    const flat = { ...style, paper: { ...style.paper, mark: 0 } };

    expect(() => preparePainterly(flat, palette, colours)).toThrow(/unusable/);
  });
});

describe('painting a pixel', () => {
  const prepared = preparePainterly(style, palette, colours);

  it('paints the same place the same way, every time', () => {
    const once = paintPixel(prepared, meadowMeetsOcean, 98.25, 41.75, 1);
    const again = paintPixel(prepared, meadowMeetsOcean, 98.25, 41.75, 1);

    expect(once).toEqual(again);
  });

  it('stays a colour, whatever the noise adds up to', () => {
    for (let index = 0; index < 500; index += 1) {
      const colour = paintPixel(prepared, meadowMeetsOcean, 90 + index * 0.05, index * 0.31, 1);
      for (const channel of colour) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
        expect(Number.isInteger(channel)).toBe(true);
      }
    }
  });

  it('gathers pigment along a boundary, which is the wet edge', () => {
    // Averaged down a column, because a single pixel's paper grain is louder than the edge itself.
    const onTheEdge = averageDown(meadowMeetsTaiga, 100, luminance);
    const wellInside = averageDown(meadowMeetsTaiga, 60, luminance);

    expect(onTheEdge).toBeLessThan(wellInside);
  });

  it('varies across a region, and gently, because that is what a wash is', () => {
    // Two places far from any boundary differ only by the medium. It has to be something, or the region
    // is a flat swatch again, and it has to stay well inside the span between the warm and the cool end
    // of the class, which for this palette is about twenty-five levels.
    const here = averageDown(everywhereMeadow, 40, luminance);
    const there = averageDown(everywhereMeadow, 300, luminance);
    const apart = Math.abs(here - there);

    expect(apart).toBeGreaterThan(0.5);
    expect(apart).toBeLessThan(15);
  });

  it('draws a shore where water meets land, and only there', () => {
    const withoutShore = preparePainterly(
      { ...style, shore: { ...style.shore, amount: 0 } },
      palette,
      colours,
    );

    // Two kinds of land meeting is a boundary but not a shore, so the ink cannot be involved at all.
    expect(paintPixel(prepared, meadowMeetsTaiga, 100, 20, 1)).toEqual(
      paintPixel(withoutShore, meadowMeetsTaiga, 100, 20, 1),
    );
    // Land meeting sea is a shore, and the ink has to show.
    expect(paintPixel(prepared, meadowMeetsOcean, 100, 20, 1)).not.toEqual(
      paintPixel(withoutShore, meadowMeetsOcean, 100, 20, 1),
    );
  });

  it('pulls the shore toward the ink rather than toward anything else', () => {
    const ink = [0x5f, 0x55, 0x44] as const;
    const closeness = (colour: readonly [number, number, number]) =>
      Math.abs(colour[0] - ink[0]) + Math.abs(colour[1] - ink[1]) + Math.abs(colour[2] - ink[2]);

    expect(averageDown(meadowMeetsOcean, 100, closeness)).toBeLessThan(
      averageDown(meadowMeetsOcean, 60, closeness),
    );
  });

  it('keeps a mark the size of a mark when the view zooms', () => {
    // This is the whole point of brush space. The same place on the paper, seen at four times the zoom,
    // is the same paint: only the terrain magnifies, never the medium. Terrain is held constant here so
    // that nothing but the medium can speak.
    const far = paintPixel(prepared, everywhereMeadow, 100, 60, 1);
    const near = paintPixel(prepared, everywhereMeadow, 25, 15, 0.25);

    expect(near).toEqual(far);
  });

  it('still finds an edge at any zoom, because the reach is held off nothing and off too much', () => {
    // The reach is in output pixels, so at a far enough view it would fall below a master pixel and stop
    // finding boundaries at all, and at a close enough one it would swell into a band. It is clamped at
    // both ends, and the wet edge has to survive both clamps.
    for (const masterPerPixel of [0.05, 1, 20]) {
      const onTheEdge = averageDown(meadowMeetsTaiga, 100, luminance, prepared, masterPerPixel);
      const wellInside = averageDown(meadowMeetsTaiga, 60, luminance, prepared, masterPerPixel);

      expect(onTheEdge).toBeLessThan(wellInside);
    }
  });
});
