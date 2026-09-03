import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  MINIMUM_CLASS_DISTANCE,
  byId,
  colourDistance,
  paletteProblems,
  preparePalette,
  snapPrepared,
  snapToClass,
  toHex,
  toRgb,
} from './palette.ts';
import type { Palette } from './palette.ts';

const real = JSON.parse(
  readFileSync(new URL('../../../../world/palette.json', import.meta.url), 'utf8'),
) as Palette;

describe('colours', () => {
  it('reads and writes the form an image editor shows', () => {
    expect(toRgb('#103d5c')).toEqual([16, 61, 92]);
    expect(toHex([16, 61, 92])).toBe('#103d5c');
    expect(toHex(toRgb('#f2f6f8'))).toBe('#f2f6f8');
  });

  it('refuses something that is not a colour', () => {
    expect(() => toRgb('#abc')).toThrow();
    expect(() => toRgb('forest green')).toThrow();
  });
});

describe('the palette the world is actually painted with', () => {
  it('has no problems', () => {
    expect(paletteProblems(real)).toEqual([]);
  });

  it('keeps every class far enough from every other to survive an image editor', () => {
    let closest = Infinity;
    for (let i = 0; i < real.classes.length; i += 1) {
      for (let j = i + 1; j < real.classes.length; j += 1) {
        closest = Math.min(
          closest,
          colourDistance(toRgb(real.classes[i]!.colour), toRgb(real.classes[j]!.colour)),
        );
      }
    }
    expect(closest).toBeGreaterThanOrEqual(MINIMUM_CLASS_DISTANCE);
  });

  it('describes a master that is twice as wide as it is tall, as an unprojected world is', () => {
    expect(real.master.width).toBe(real.master.height * 2);
    expect(real.master.projection).toBe('equirectangular');
  });

  it('starts at ocean, so that an empty world is all sea', () => {
    expect(real.classes[0]?.id).toBe(0);
    expect(real.classes[0]?.name).toBe('ocean');
  });

  it('marks its water, including the three kinds the pipeline depends on', () => {
    const water = real.classes.filter((terrain) => terrain.water === true).map((t) => t.name);

    expect(water).toContain('ocean');
    expect(water).toContain('lake');
    expect(water).toContain('river');
    // Everything else must be land, or the coastline would be traced around the wrong thing.
    for (const terrain of real.classes) {
      if (!water.includes(terrain.name)) {
        expect(terrain.water).not.toBe(true);
      }
    }
  });
});

describe('finding the problems in a broken palette', () => {
  const broken: Palette = {
    master: { width: 4, height: 2, projection: 'equirectangular' },
    classes: [
      { id: 0, name: 'ocean', colour: '#103d5c' },
      { id: 0, name: 'lake', colour: '#113e5d' },
      { id: 2, name: 'lake', colour: 'not a colour' },
    ],
  };

  it('reports all of them at once', () => {
    const kinds = paletteProblems(broken).map((problem) => problem.kind);

    expect(kinds).toContain('duplicate-id');
    expect(kinds).toContain('duplicate-name');
    expect(kinds).toContain('too-close');
    expect(kinds).toContain('bad-colour');
  });
});

describe('snapping a painted pixel to a class', () => {
  it('is exact for a colour painted exactly, for every class in the palette', () => {
    for (const terrain of real.classes) {
      expect(snapToClass(toRgb(terrain.colour), real)).toEqual({ id: terrain.id, distance: 0 });
    }
  });

  it('claims a blended edge pixel for whichever side it is nearer', () => {
    const ocean = toRgb(real.classes[0]!.colour);
    const forest = toRgb(real.classes.at(-1)!.colour);
    const mostlyOcean: [number, number, number] = [
      Math.round(ocean[0] * 0.8 + forest[0] * 0.2),
      Math.round(ocean[1] * 0.8 + forest[1] * 0.2),
      Math.round(ocean[2] * 0.8 + forest[2] * 0.2),
    ];

    expect(snapToClass(mostlyOcean, real).id).toBe(real.classes[0]!.id);
    expect(snapToClass(mostlyOcean, real).distance).toBeGreaterThan(0);
  });

  it('never refuses a colour, because an editor leaves colours nobody chose', () => {
    for (const wild of [
      [0, 0, 0],
      [255, 255, 255],
      [128, 0, 200],
    ] as [number, number, number][]) {
      expect(Number.isFinite(snapToClass(wild, real).distance)).toBe(true);
    }
  });
});

describe('looking a class up', () => {
  it('finds every class by its id', () => {
    const index = byId(real);
    expect(index.size).toBe(real.classes.length);
    expect(index.get(0)?.name).toBe('ocean');
  });
});

describe('preparing the palette for a loop', () => {
  it('agrees with the slow path on every class colour', () => {
    const prepared = preparePalette(real);

    for (const terrain of real.classes) {
      expect(snapPrepared(toRgb(terrain.colour), prepared)).toEqual(snapToClass(toRgb(terrain.colour), real));
    }
  });

  it('agrees with the slow path on colours nobody painted', () => {
    const prepared = preparePalette(real);

    for (const wild of [
      [0, 0, 0],
      [255, 255, 255],
      [130, 90, 200],
      [17, 62, 93],
    ] as [number, number, number][]) {
      const fast = snapPrepared(wild, prepared);
      const slow = snapToClass(wild, real);

      expect(fast.id).toBe(slow.id);
      expect(fast.distance).toBeCloseTo(slow.distance, 9);
    }
  });

  it('keeps the classes in the order the palette gave them', () => {
    const prepared = preparePalette(real);

    expect([...prepared.ids]).toEqual(real.classes.map((terrain) => terrain.id));
    expect(prepared.channels.length).toBe(real.classes.length * 3);
  });
});
