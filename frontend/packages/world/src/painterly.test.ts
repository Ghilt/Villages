import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  SQUARE_LATTICE,
  fbm,
  hash2,
  isSquareLattice,
  mix,
  onLattice,
  paintPixel,
  painterlyProblems,
  preparePainterly,
  saturate,
  smoothstep,
  treatment,
  valueNoise,
} from './painterly.ts';
import type { ClassSampler, PainterlyStyle, TreatmentKind } from './painterly.ts';
import { MINIMUM_CLASS_DISTANCE, colourDistance, toHex, toRgb } from './palette.ts';
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

  it('still finds an edge at any zoom', () => {
    // The reach is in output pixels, so at a close enough view it falls below one master pixel and would
    // stop finding boundaries at all. It is held off nothing, and the wet edge has to survive that.
    for (const masterPerPixel of [0.05, 1, 20]) {
      const onTheEdge = averageDown(meadowMeetsTaiga, 100, luminance, prepared, masterPerPixel);
      const wellInside = averageDown(meadowMeetsTaiga, 60, luminance, prepared, masterPerPixel);

      expect(onTheEdge).toBeLessThan(wellInside);
    }
  });
  it('keeps the shore the same weight however coarse the terrain it can see is', () => {
    // The regression that named itself the layer difference problem, and the shape of it matters. A tile
    // cut for zoom three carries one terrain sample per output pixel, so a sample covers sixteen master
    // pixels; at zoom four, eight. The shore always lies exactly on a sample edge, so it is never absent
    // altogether: what changes is how wide the inked band is in output pixels, and so whether the eye
    // sees a line at all. It has to be measured across a row of output pixels straddling the shore,
    // because the one pixel on the boundary is inked at every coarseness and says nothing.
    // Every source of variation but the ink is silenced, because the paper and the wash are sampled at
    // different places when the coarseness changes and they are far louder than the line being measured.
    const quiet: PainterlyStyle = {
      ...style,
      wash: { amount: 0, mark: 46 },
      paper: { grain: 0, mark: 2.2, fibre: 0 },
      groups: Object.fromEntries(
        Object.entries(style.groups).map(([group, spec]) => [group, { ...spec, amount: 0 }]),
      ),
    };
    const prepared = preparePainterly(quiet, palette, colours);
    const SHORE_AT = 1600;

    const inkAcrossTheShore = (sample: number): number => {
      const coarse: ClassSampler = (x) => (Math.floor(x / sample) * sample < SHORE_AT ? MEADOW : OCEAN);
      let total = 0;
      let taken = 0;
      for (let row = 0; row < 80; row += 1) {
        for (let step = -6; step < 6; step += 1) {
          // One output pixel covers `sample` master pixels, so the row is walked in steps of that.
          const x = SHORE_AT + (step + 0.5) * sample;
          total += luminance(paintPixel(prepared, coarse, x, row * sample, sample));
          taken += 1;
        }
      }
      return total / taken;
    };

    const weights = [4, 8, 16].map(inkAcrossTheShore);

    // Equal ground either side at every coarseness, so everything but the ink cancels out.
    expect(Math.max(...weights) - Math.min(...weights)).toBeLessThan(1.5);
  });
});
describe('cutting the wash into steps', () => {
  /** Everything but the wash silenced, so the count of colours in a region is the count of steps. */
  const bare: PainterlyStyle = {
    ...style,
    paper: { grain: 0, mark: 2.2, fibre: 0 },
    groups: Object.fromEntries(
      Object.entries(style.groups).map(([group, spec]) => [group, { ...spec, amount: 0 }]),
    ),
  };

  const coloursIn = (prepared: ReturnType<typeof preparePainterly>): Set<string> => {
    const seen = new Set<string>();
    for (let index = 0; index < 900; index += 1) {
      // Well away from any boundary, so the wet edge cannot add shades of its own.
      seen.add(paintPixel(prepared, everywhereMeadow, 300 + index * 1.7, index * 2.3, 1).join(','));
    }
    return seen;
  };

  it('leaves the wash alone when it is not asked for', () => {
    expect(coloursIn(preparePainterly(bare, palette, colours)).size).toBeGreaterThan(20);
  });

  it('holds the wash to the number of steps asked for', () => {
    const printed = preparePainterly({ ...bare, posterise: 4 }, palette, colours);

    // Four steps means five values from nothing to all of it, and no more.
    expect(coloursIn(printed).size).toBeLessThanOrEqual(5);
    expect(coloursIn(printed).size).toBeGreaterThan(1);
  });

  it('changes nothing but the wash, and at a fine enough step nothing anybody can see', () => {
    // The knob may only touch the wash. Sixty-four steps is a third of a level of lightness apiece, so
    // it cannot land on the same byte every time, but it must never be more than a rounding away.
    const many = preparePainterly(bare, palette, colours);
    const few = preparePainterly({ ...bare, posterise: 64 }, palette, colours);
    let worst = 0;

    for (let index = 0; index < 200; index += 1) {
      const at = 300 + index * 1.7;
      const a = paintPixel(many, everywhereMeadow, at, index, 1);
      const b = paintPixel(few, everywhereMeadow, at, index, 1);
      for (let channel = 0; channel < 3; channel += 1) {
        worst = Math.max(worst, Math.abs(a[channel]! - b[channel]!));
      }
    }

    expect(worst).toBeLessThanOrEqual(1);
  });
});

describe('pushing the saturation of a colour', () => {
  /** A dark green, which is the case that matters: the master is full of them. */
  const green = [16, 80, 40] as const;
  const spread = (colour: readonly number[]): number => Math.max(...colour) - Math.min(...colour);

  it('leaves a colour exactly alone at one, so the default costs nothing', () => {
    expect(saturate(green, 1)).toEqual(green);
  });

  it('takes all the colour out at zero, leaving the grey it was worth', () => {
    const grey = saturate(green, 0);

    expect(grey[0]).toBe(grey[1]);
    expect(grey[1]).toBe(grey[2]);
  });

  it('widens the gap between the channels, which is what saturation is', () => {
    expect(spread(saturate(green, 1.5))).toBeGreaterThan(spread(green));
  });

  it('keeps the lightness it had, so a dark green only becomes greener', () => {
    // Rounding and the clip at zero move it a little. Two levels out of 255 is not a change of lightness.
    expect(Math.abs(luminance(saturate(green, 1.4)) - luminance(green))).toBeLessThan(2);
  });

  it('clips at the ends rather than wrapping round them', () => {
    for (const channel of saturate(green, 8)) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(255);
    }
  });
});

describe('which colours a style draws a class in', () => {
  /**
   * Every part of the medium turned off, which is what the vivid style is: the colour and nothing else.
   * With all of it at zero a painted pixel is exactly the class's colour, so it can be compared by name.
   */
  const bare: PainterlyStyle = {
    ...style,
    wash: { amount: 0, mark: 46 },
    boundary: { wander: 0, scale: 3 },
    edge: { amount: 0, reach: 1 },
    shore: { ink: '#000000', amount: 0 },
    paper: { grain: 0, mark: 2, fibre: 0 },
    groups: Object.fromEntries(
      Object.entries(style.groups).map(([group, spec]) => [
        group,
        { ...spec, treatment: 'none' as const, amount: 0 },
      ]),
    ),
  };
  const meadowIn = (of: PainterlyStyle): string =>
    toHex(paintPixel(preparePainterly(of, palette, colours), everywhereMeadow, 300, 12, 1));
  const spread = (colour: readonly number[]): number => Math.max(...colour) - Math.min(...colour);

  it('is render.json by default, which is what every style before this one drew', () => {
    expect(meadowIn(bare)).toBe(colours.meadow);
  });

  it("is the master's own colours when the style asks for them", () => {
    expect(meadowIn({ ...bare, colours: 'palette' })).toBe('#88cc44');
  });

  it('changes nothing when neither field is given, so no style before this one moved', () => {
    const asItWas = preparePainterly(style, palette, colours);

    expect(preparePainterly({ ...style, colours: 'render', vibrance: 1 }, palette, colours)).toEqual(asItWas);
  });

  it('draws the master hotter than it was painted when the vibrance is turned up', () => {
    const asPainted = paintPixel(
      preparePainterly({ ...bare, colours: 'palette' }, palette, colours),
      everywhereMeadow,
      300,
      12,
      1,
    );
    const pushed = paintPixel(
      preparePainterly({ ...bare, colours: 'palette', vibrance: 1.5 }, palette, colours),
      everywhereMeadow,
      300,
      12,
      1,
    );

    expect(spread(pushed)).toBeGreaterThan(spread(asPainted));
  });

  it('says so when the colour source is a word it does not know', () => {
    const problems = painterlyProblems({ ...style, colours: 'pallete' as 'palette' }, palette, colours);

    expect(problems).toContain('pallete is not a colour source; it is render or palette');
  });

  it('says so when the vibrance is not a number at or above zero', () => {
    for (const vibrance of [-1, Number.NaN]) {
      const problems = painterlyProblems({ ...style, vibrance }, palette, colours);

      expect(problems.some((problem) => problem.includes('vibrance'))).toBe(true);
    }
  });

  it('does not ask for a render colour it is never going to read', () => {
    const onlyMeadow = { meadow: '#c4ce8d' };

    expect(painterlyProblems({ ...style, colours: 'palette' }, palette, onlyMeadow)).toEqual([]);
    // And still does when it would read them, or a missing colour would go unnoticed.
    expect(painterlyProblems(style, palette, onlyMeadow)).toHaveLength(2);
  });
});

describe('where the paint gives way to the scenery', () => {
  const palette: Palette = {
    master: { width: 32768, height: 16384, projection: 'equirectangular' },
    classes: [
      { id: 0, name: 'ocean', colour: '#104058', water: true, group: 'water' },
      { id: 7, name: 'taiga', colour: '#105028', group: 'forest' },
    ],
  };
  const colours = { ocean: '#104058', taiga: '#2f4a33' };
  const base: PainterlyStyle = {
    warm: '#fff3d0',
    cool: '#2a3b4a',
    wash: { amount: 0.3, mark: 40 },
    boundary: { wander: 2, scale: 30 },
    edge: { amount: 0.2, reach: 1 },
    shore: { ink: '#1a2a38', amount: 0.5 },
    paper: { grain: 0.02, mark: 6, fibre: 0.01 },
    groups: {
      water: { treatment: 'none', mark: 3, amount: 0 },
      forest: { treatment: 'stipple', mark: 3.2, amount: 0.3 },
    },
  };
  const taiga = () => 7;

  /**
   * How much the group's treatment moves the paint, and nothing else.
   *
   * The same style painted twice, once with the mark and once with its amount at nought, and the mean
   * difference between them. Measuring the spread of the paint on its own would not do: the wash and the
   * paper are in brush space too, so their frequency moves with `masterPerPixel` and the spread would
   * change for reasons that have nothing to do with the treatment. This subtracts all of that out.
   */
  const markStrength = (style: PainterlyStyle, masterPerPixel: number): number => {
    const withMark = preparePainterly(style, palette, colours);
    const flat = preparePainterly(
      { ...style, groups: { ...style.groups, forest: { ...style.groups.forest!, amount: 0 } } },
      palette,
      colours,
    );
    let sum = 0;
    const of = 400;
    for (let at = 0; at < of; at += 1) {
      const x = 1000 + at * 0.37;
      const y = 2000 + at * 0.61;
      sum += Math.abs(
        paintPixel(withMark, taiga, x, y, masterPerPixel)[0] -
          paintPixel(flat, taiga, x, y, masterPerPixel)[0],
      );
    }
    return sum / of;
  };

  it('leaves a style alone that never hands over, which is every style until one says so', () => {
    const far = markStrength(base, 2);
    const near = markStrength(base, 0.1);

    expect(far).toBeGreaterThan(1);
    expect(near / far).toBeGreaterThan(0.75);
    expect(near / far).toBeLessThan(1.33);
  });

  /**
   * Decision record 0051 says the painted terrain is scenery's far-out form, and until this it was not:
   * a canopy stipple is a constant few pixels of brush space, so it looked the same at the zoom trees
   * arrived as it had five zooms out. Named as unfinished in 0052, in experiment 0006 and in 0007.
   */
  it('keeps the treatment whole far out and gives it up close in', () => {
    const handing: PainterlyStyle = {
      ...base,
      groups: { ...base.groups, forest: { ...base.groups.forest!, handOver: { from: 0.8, to: 0.15 } } },
    };

    expect(markStrength(handing, 2) / markStrength(base, 2)).toBeGreaterThan(0.98);
    expect(markStrength(handing, 0.1) / markStrength(base, 0.1)).toBeLessThan(0.02);
    // And in between it is in between, rather than stepping at one zoom.
    const middle = markStrength(handing, 0.45);
    expect(middle).toBeGreaterThan(markStrength(handing, 0.1));
    expect(middle).toBeLessThan(markStrength(handing, 2));
  });

  it('keeps what it is told to keep, so a wood is not bare between its trees', () => {
    const keeping: PainterlyStyle = {
      ...base,
      groups: {
        ...base.groups,
        forest: { ...base.groups.forest!, handOver: { from: 0.8, to: 0.15, keep: 0.5 } },
      },
    };

    const share = markStrength(keeping, 0.1) / markStrength(base, 0.1);

    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.6);
  });

  it('refuses a hand over written the wrong way round', () => {
    const backwards: PainterlyStyle = {
      ...base,
      groups: { ...base.groups, forest: { ...base.groups.forest!, handOver: { from: 0.15, to: 0.8 } } },
    };

    expect(painterlyProblems(backwards, palette, colours).join(' ')).toContain('further to nearer');
  });

  it('refuses a keep that is not a fraction', () => {
    const odd: PainterlyStyle = {
      ...base,
      groups: {
        ...base.groups,
        forest: { ...base.groups.forest!, handOver: { from: 0.8, to: 0.15, keep: 2 } },
      },
    };

    expect(painterlyProblems(odd, palette, colours).join(' ')).toContain('not a fraction');
  });
});

describe('the styles the world is actually painted with', () => {
  const real = JSON.parse(
    readFileSync(new URL('../../../../world/painterly.json', import.meta.url), 'utf8'),
  ) as { styles: Record<string, PainterlyStyle> };
  const realPalette = JSON.parse(
    readFileSync(new URL('../../../../world/palette.json', import.meta.url), 'utf8'),
  ) as Palette;
  const realColours = JSON.parse(
    readFileSync(new URL('../../../../world/render.json', import.meta.url), 'utf8'),
  ) as { colours: Record<string, string> };

  /**
   * Every style, checked against the palette and the colours it will actually be drawn with.
   *
   * The offline painter reports this on the way past, but only when somebody runs it, and a style is
   * hand-edited JSON that nothing typechecks. A typo in it costs five minutes of painting or an empty
   * renderer in the browser, and either is worse than a failing test.
   */
  it.each(Object.keys(real.styles))('%s can be used', (name) => {
    expect(painterlyProblems(real.styles[name]!, realPalette, realColours.colours)).toEqual([]);
  });

  it('has at least the one that draws the master as it was painted', () => {
    expect(real.styles.vivid?.colours).toBe('palette');
  });

  it('does not push the vivid colours so far that classes collapse into each other again', () => {
    const pushed = realPalette.classes.map((terrain) =>
      saturate(toRgb(terrain.colour), real.styles.vivid?.vibrance ?? 1),
    );
    let closest = Infinity;
    for (let i = 0; i < pushed.length; i += 1) {
      for (let j = i + 1; j < pushed.length; j += 1) {
        closest = Math.min(closest, colourDistance(pushed[i]!, pushed[j]!));
      }
    }

    // The whole point of the style is that the classes are far apart, so it may not undo what the
    // palette guarantees. Past about 1.75 the push starts pinning channels at an end and does exactly
    // that: two colours that differed only in how much of a channel they had arrive at the same place.
    expect(closest).toBeGreaterThanOrEqual(MINIMUM_CLASS_DISTANCE);
  });
});

describe('the lattice the ground is read on', () => {
  /** A sampler that reports where it was asked, so a wrapper can be checked by what it passes through. */
  const asked: { x: number; y: number }[] = [];
  const spy: ClassSampler = (x, y) => {
    asked.push({ x, y });
    return MEADOW;
  };

  beforeEach(() => {
    asked.length = 0;
  });

  it('is the sampler it was given when it is the plain square one', () => {
    expect(onLattice(spy, SQUARE_LATTICE)).toBe(spy);
    expect(isSquareLattice(SQUARE_LATTICE)).toBe(true);
    expect(isSquareLattice({ turn: 45, size: 1 })).toBe(false);
  });

  it('reads the middle of the cell a place falls in rather than the place itself', () => {
    onLattice(spy, { turn: 0, size: 4 })(9.3, 2.1);
    expect(asked).toEqual([{ x: 10, y: 2 }]);
  });

  it('puts everywhere in one cell onto the same reading, which is what makes a cell a cell', () => {
    const read = onLattice(spy, { turn: 45, size: 4 });
    // Well inside a cell rather than on its edge: on a boundary the answer flips for any step at all,
    // which is what a boundary is and not what this is about.
    const middle = [19.8, 22.6] as const;
    read(...middle);
    const first = asked[0]!;
    // A step much shorter than a cell cannot leave it, whichever way it is taken.
    for (const [dx, dy] of [
      [0.4, 0],
      [0, 0.4],
      [-0.4, -0.4],
    ] as const) {
      asked.length = 0;
      read(middle[0] + dx, middle[1] + dy);
      expect(asked[0]!.x).toBeCloseTo(first.x, 9);
      expect(asked[0]!.y).toBeCloseTo(first.y, 9);
    }
  });

  it('turns the cells without moving the world, so a cell still covers the ground it stands on', () => {
    const size = 4;
    const read = onLattice(spy, { turn: 45, size });
    // Whatever cell a place lands in, its middle is within half a diagonal of the place itself: the
    // lattice is turned, not shifted, so nothing is read from somewhere else on the map.
    for (const [x, y] of [
      [0, 0],
      [13.7, -22.1],
      [1000.5, 999.5],
    ] as const) {
      asked.length = 0;
      read(x, y);
      expect(Math.hypot(asked[0]!.x - x, asked[0]!.y - y)).toBeLessThanOrEqual((size * Math.SQRT2) / 2);
    }
  });
});
