import { describe, expect, it } from 'vitest';

import { combine, percentile, readingOf, spreadOf, wholeOf } from './stats';

const frame = (land: number, map: number, cpu = 1) => ({
  cpu,
  keys: { 'sprites:land': land, 'map:water': map },
});

describe('a run of frames', () => {
  it('adds a frame up from what drew in it', () => {
    expect(wholeOf(frame(1, 0.5))).toBe(1.5);
  });

  it('keeps the fast frames, name by name, so the slower clock step does not speak for the code', () => {
    // Six frames in the fast step and four in a step a quarter slower.
    const frames = [
      ...Array.from({ length: 6 }, () => frame(1, 0.5)),
      ...Array.from({ length: 4 }, () => frame(1.25, 0.625)),
    ];
    const reading = readingOf(frames);
    expect(reading.frame).toBeCloseTo(1.5);
    expect(reading.keys['sprites:land']).toBeCloseTo(1);
    expect(reading.keys['map:water']).toBeCloseTo(0.5);
    expect(reading.p80).toBeCloseTo(1.875);
    expect(reading.fast).toBe(6);
  });

  it('keeps names only some frames drew, at their share of the fast frames', () => {
    const reading = readingOf(
      [frame(1, 0), { cpu: 1, keys: { 'sprites:land': 1, 'map:water': 0, 'map:clear': 0 } }],
      1,
    );
    expect(Object.keys(reading.keys).sort()).toEqual(['map:clear', 'map:water', 'sprites:land']);
  });

  it('takes the middle CPU time', () => {
    expect(readingOf([frame(1, 0, 1), frame(1, 0, 9), frame(1, 0, 2)]).cpu).toBe(2);
  });

  it('scales the parts to add up to the whole, each keeping its share', () => {
    const whole = readingOf([{ cpu: 1, keys: { 'map:whole': 1, 'sprites:whole': 2 } }]);
    // Timed run by run the parts come to 3.6, a fifth over the whole: each loses a sixth of itself. Had it all been
    // the queries' cost, that is 0.1 a run over six runs.
    const parts = readingOf([
      {
        cpu: 1,
        keys: { 'map:water': 1.2, 'sprites:land': 2.4 },
        runs: { 'map:water': 2, 'sprites:land': 4 },
      },
    ]);
    const combined = combine(whole, parts);
    expect(combined.frame).toBeCloseTo(3);
    expect(combined.perRun).toBeCloseTo(0.1);
    expect(combined.keys['map:water']).toBeCloseTo(1);
    expect(combined.keys['sprites:land']).toBeCloseTo(2);
    expect(combined.partsOverWhole).toBeCloseTo(1.2);
  });

  it('says how far apart readings are, as a share of their middle', () => {
    expect(spreadOf([1, 1.05, 0.95])).toBeCloseTo(0.1);
    expect(percentile([], 0.5)).toBeNaN();
  });
});
