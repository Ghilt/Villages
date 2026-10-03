import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { UI_KINDS, UI_PICTURES, nameProblem, readBorderFile } from './uiArt.ts';
import { UI_PLACEHOLDERS } from './uiPlaceholders.ts';

/**
 * The rules `world/ui/` is held to, by reading the folder itself. It is Adam's: he saves pictures over the
 * placeholders by hand, and `npm run world:ui` refuses to cut a folder that breaks these, so a broken
 * folder is said here rather than by a page with a hole in it. See decision record 0068.
 */
const UI = new URL('../../../../world/ui/', import.meta.url);

const filesIn = (kind: string): string[] => {
  const folder = fileURLToPath(new URL(`${kind}/`, UI));
  return existsSync(folder) ? readdirSync(folder) : [];
};

const picturesIn = (kind: string): string[] =>
  filesIn(kind).filter((file) => UI_PICTURES.has(extname(file).toLowerCase()));

const stem = (file: string) => file.slice(0, -extname(file).length);

/** The kinds whose pictures can have a file of cuts beside them: a border must; a face and a divider may. */
const SLICED = ['borders', 'controls', 'dividers'];

describe("the interface's pictures folder, which is Adam's", () => {
  it('holds a folder a kind of picture, the sources, the moodboard, the placeholders’ record, and nothing else', () => {
    const allowed = new Set<string>([
      ...UI_KINDS,
      'sources',
      'moodboard.webp',
      'placeholders.json',
      'README.md',
    ]);
    const strays = readdirSync(fileURLToPath(UI)).filter((entry) => !allowed.has(entry));
    expect(strays).toEqual([]);
  });

  it('names every picture so a recipe can call it by its name', () => {
    for (const kind of UI_KINDS) {
      for (const file of filesIn(kind)) {
        if (SLICED.includes(kind) && file.endsWith('.json')) {
          continue;
        }
        expect(nameProblem(file), `${kind}/${file}`).toBeNull();
      }
    }
  });

  it('holds one picture for every placeholder the library ships with, whether it is still the placeholder or not', () => {
    for (const placeholder of UI_PLACEHOLDERS) {
      const names = picturesIn(placeholder.kind).map(stem);
      expect(
        names.filter((name) => name === placeholder.name),
        `${placeholder.kind}/${placeholder.name}`,
      ).toHaveLength(1);
    }
  });

  it('gives every border a file saying where its cuts go, and every such file a border', () => {
    const borders = new Set(picturesIn('borders').map(stem));
    const files = new Set(
      filesIn('borders')
        .filter((file) => file.endsWith('.json'))
        .map(stem),
    );
    expect(
      [...borders].filter((name) => !files.has(name)),
      'borders with no file of cuts',
    ).toEqual([]);
    expect(
      [...files].filter((name) => !borders.has(name)),
      'files of cuts with no border',
    ).toEqual([]);
  });

  it('gives every control’s and every divider’s file of cuts a picture to cut', () => {
    for (const kind of ['controls', 'dividers']) {
      const pictures = new Set(picturesIn(kind).map(stem));
      const files = filesIn(kind)
        .filter((file) => file.endsWith('.json'))
        .map(stem);
      expect(
        files.filter((name) => !pictures.has(name)),
        `${kind}: files of cuts with no picture`,
      ).toEqual([]);
    }
  });

  it('has files of cuts the tool can read', () => {
    for (const kind of SLICED) {
      for (const file of filesIn(kind).filter((one) => one.endsWith('.json'))) {
        const text = readFileSync(new URL(`${kind}/${file}`, UI), 'utf8');
        expect(() => readBorderFile(text, file), `${kind}/${file}`).not.toThrow();
      }
    }
  });

  it('records placeholders only for files that are in the folder', () => {
    const recorded = JSON.parse(readFileSync(new URL('placeholders.json', UI), 'utf8')) as Record<
      string,
      string
    >;
    const there = new Set(UI_KINDS.flatMap((kind) => filesIn(kind).map((file) => `${kind}/${file}`)));
    for (const file of Object.keys(recorded)) {
      expect(there.has(file), file).toBe(true);
    }
  });

  it('names each placeholder once', () => {
    const names = UI_PLACEHOLDERS.map((placeholder) => `${placeholder.kind}/${placeholder.name}`);
    expect(new Set(names).size).toBe(names.length);
  });
});
