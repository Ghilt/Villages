import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

import { pictureKeys, picturesApi } from './picturesApi.ts';

/**
 * The dev server's portraits: what is in `world/portraits/`, and each picture in it.
 *
 * Adam's folder, which he saves pictures into by hand; the server picks a character's portrait from the
 * same folder and the page draws it from here, without a cache, as `picturesApi.ts` serves any folder of
 * his. See `docs/plans/characters-and-key-figures.md`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..', '..', '..');
const PORTRAITS_DIR = resolve(REPO, 'world', 'portraits');

/** The longest key the server keeps, `CharacterDecider.LONGEST_PORTRAIT_KEY`. */
const LONGEST_KEY = 40;

/** The keys of the portraits among these file names, in order: every `.png` whose name is a key. */
export function portraitKeys(files: readonly string[]): string[] {
  return pictureKeys(files, LONGEST_KEY);
}

export function portraitsApi(): Plugin {
  return picturesApi({ name: 'portraits', folder: PORTRAITS_DIR, longest: LONGEST_KEY });
}
