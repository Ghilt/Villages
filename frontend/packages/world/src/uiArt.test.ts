import { describe, expect, it } from 'vitest';

import { asShown, borderAsShown, nameProblem, outlineMask, readBorderFile, weightAt } from './uiArt.ts';
import type { UiPicture } from './uiArt.ts';

describe('a picture as shown', () => {
  it('is a quarter of the picture as painted', () => {
    expect(asShown(400)).toBe(100);
    expect(asShown(402)).toBe(101);
  });

  it('is never nothing for something that is there', () => {
    expect(asShown(1)).toBe(1);
    expect(asShown(0)).toBe(0);
  });
});

describe("a picture's name", () => {
  it('is lowercase words joined by hyphens, with a picture’s extension', () => {
    expect(nameProblem('gilt-simple.webp')).toBeNull();
    expect(nameProblem('cherub-01.PNG')).toBeNull();
  });

  it('refuses what a recipe could not call it by', () => {
    expect(nameProblem('Gilt Simple.png')).toMatch(/lowercase words/);
    expect(nameProblem('gilt_simple.png')).toMatch(/lowercase words/);
    expect(nameProblem('notes.txt')).toMatch(/not a picture/);
    expect(nameProblem('gilt')).toMatch(/no extension/);
  });
});

describe("a border's file", () => {
  it('reads one length or four for each side', () => {
    const file = readBorderFile('{"slice": 96, "inset": [8, 12, 8, 12]}', 'gilt.json');
    expect(file.slice).toEqual([96, 96, 96, 96]);
    expect(file.inset).toEqual([8, 12, 8, 12]);
    expect(file.repeat).toEqual(['round', 'round']);
  });

  it('reads a repeat for both ways or for each', () => {
    expect(readBorderFile('{"slice": 8, "repeat": "stretch"}', 'a.json').repeat).toEqual([
      'stretch',
      'stretch',
    ]);
    expect(readBorderFile('{"slice": 8, "repeat": ["round", "stretch"]}', 'a.json').repeat).toEqual([
      'round',
      'stretch',
    ]);
  });

  it('refuses what it would have to guess at, and says what to write', () => {
    expect(() => readBorderFile('{}', 'a.json')).toThrow(/no slice/);
    expect(() => readBorderFile('{"slice": [1, 2]}', 'a.json')).toThrow(/one length or four/);
    expect(() => readBorderFile('{"slice": -4}', 'a.json')).toThrow(/one length or four/);
    expect(() => readBorderFile('{"slice": 4, "repeat": "tile"}', 'a.json')).toThrow(
      /stretch, repeat, round, space/,
    );
    expect(() => readBorderFile('{"slice": 4, "slices": 4}', 'a.json')).toThrow(/slices is not something/);
    expect(() => readBorderFile('{"slice": 4, "middle": "yes"}', 'a.json')).toThrow(/true or false/);
    expect(() => readBorderFile('not json', 'a.json')).toThrow(/not JSON/);
  });
});

describe('a border as shown', () => {
  it('has every length a quarter of the picture’s, to whole pixels', () => {
    const border = borderAsShown(
      readBorderFile('{"slice": [96, 90, 98, 100], "inset": 10, "outset": 4}', 'a.json'),
      { width: 100, height: 100 },
      'a.json',
    );
    expect(border.slice).toEqual([24, 23, 25, 25]);
    expect(border.inset).toEqual([3, 3, 3, 3]);
    expect(border.outset).toEqual([1, 1, 1, 1]);
  });

  it('lets a fill reach halfway under the border unless it is told otherwise', () => {
    const halfway = borderAsShown(
      readBorderFile('{"slice": 96}', 'a.json'),
      { width: 100, height: 100 },
      'a.json',
    );
    expect(halfway.fillUnder).toEqual([12, 12, 12, 12]);
    const told = borderAsShown(
      readBorderFile('{"slice": 96, "fillUnder": 40}', 'a.json'),
      { width: 100, height: 100 },
      'a.json',
    );
    expect(told.fillUnder).toEqual([10, 10, 10, 10]);
  });

  it('draws no middle unless it is asked to', () => {
    const shown = { width: 100, height: 100 };
    expect(borderAsShown(readBorderFile('{"slice": 96}', 'a.json'), shown, 'a.json').middle).toBe(false);
    expect(
      borderAsShown(readBorderFile('{"slice": 96, "middle": true}', 'a.json'), shown, 'a.json').middle,
    ).toBe(true);
  });

  it('refuses cuts that cross, which would leave no edge between the corners', () => {
    expect(() =>
      borderAsShown(
        readBorderFile('{"slice": [240, 8, 240, 8]}', 'a.json'),
        { width: 100, height: 100 },
        'a.json',
      ),
    ).toThrow(/cuts cross/);
  });
});

describe('an outline cut round something on a busy ground', () => {
  const square = [
    [2, 2],
    [8, 2],
    [8, 8],
    [2, 8],
  ] as const;

  it('keeps what is inside it and nothing outside it', () => {
    const mask = outlineMask(10, 10, square, 0);
    expect(mask[5 * 10 + 5]).toBe(255);
    expect(mask[0]).toBe(0);
    expect(mask[9 * 10 + 9]).toBe(0);
  });

  it('softens its edge across the feather, half and half on the line itself', () => {
    const mask = outlineMask(10, 10, square, 2);
    // A pixel whose centre is half a pixel inside the edge is three quarters in.
    expect(mask[5 * 10 + 2]).toBe(Math.round(0.75 * 255));
    // One half a pixel outside is a quarter in.
    expect(mask[5 * 10 + 1]).toBe(Math.round(0.25 * 255));
    expect(mask[5 * 10 + 5]).toBe(255);
  });
});

describe('what the pictures weigh', () => {
  const picture = (bytes: number[]): UiPicture => ({
    kind: 'borders',
    name: 'a',
    source: 'borders/a.png',
    placeholder: true,
    width: 10,
    height: 10,
    painted: { width: 40, height: 40 },
    how: 'opaque',
    cuts: bytes.map((size, at) => ({
      density: at + 1,
      url: `/ui/a@${at + 1}x.webp`,
      width: 10,
      height: 10,
      bytes: size,
    })),
  });

  it('is every picture’s file at one density, added up', () => {
    expect(weightAt([picture([100, 300, 600]), picture([10, 30, 60])], 2)).toBe(330);
  });
});
