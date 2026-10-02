import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

import { pictureKeys, picturesApi } from './picturesApi.ts';

/**
 * The dev server's scenes: what is in `world/scenes/`, and each picture in it.
 *
 * Adam's folder, which he saves pictures into by hand; a dialogue names its scene, and the page draws the
 * picture of that name across the top of the conversation, without a cache, as `picturesApi.ts` serves any
 * folder of his. See `docs/plans/character-dialogue.md`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..', '..', '..');
const SCENES_DIR = resolve(REPO, 'world', 'scenes');

/** The longest key a scene is named in, the same as a portrait's. */
const LONGEST_KEY = 40;

/** The keys of the scenes among these file names, in order: every `.png` whose name is a key. */
export function sceneKeys(files: readonly string[]): string[] {
  return pictureKeys(files, LONGEST_KEY);
}

export function scenesApi(): Plugin {
  return picturesApi({ name: 'scenes', folder: SCENES_DIR, longest: LONGEST_KEY });
}
