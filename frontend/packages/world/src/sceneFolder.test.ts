import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SCENES } from './scene.ts';

/**
 * The rules `world/scenes/` is held to, by reading the folder itself: it is Adam's, he saves pictures into it
 * by hand, and a dialogue names its scene by the picture's name. A file that breaks a rule here is one the
 * pane would mis-draw, so this is where it says so rather than a conversation opening on a stretched picture
 * or none. See `docs/plans/character-dialogue.md`.
 */
const FOLDER = new URL('../../../../world/scenes/', import.meta.url);

/** A scene's key, which is what a dialogue names: words of small letters and numbers, joined by hyphens. */
const NAMED = /^[a-z0-9]+(-[a-z0-9]+)*\.png$/;

/** The longest key the dev server serves, `scenesApi.ts`. */
const LONGEST_KEY = 40;

/** Large enough to fill a pane on a phone at twice its density, whichever way the picture is cut. */
const SHORTEST_SIDE = 1024;

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A PNG's width and height, which are the first eight bytes of the IHDR chunk that always comes first. */
function shapeOf(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

const files = readdirSync(fileURLToPath(FOLDER));

describe("the scenes folder, which is Adam's", () => {
  it('holds only pictures named for the scene they are, in keys the dev server serves', () => {
    for (const file of files) {
      expect(file, file).toMatch(NAMED);
      expect(file.replace(/\.png$/, '').length, file).toBeLessThanOrEqual(LONGEST_KEY);
    }
  });

  // A dialogue naming a scene that is not there opens on plain paper, so the samples' own are held here.
  it('holds a picture for every scene the sample dialogues name', () => {
    for (const scene of SCENES) {
      expect(files, scene).toContain(`${scene}.png`);
    }
  });

  // Any shape will do, because the pane crops a scene to its own shape, a tall slice of it on a desktop.
  it('holds PNGs at least 1024 on their shorter side', () => {
    for (const file of files) {
      const bytes = new Uint8Array(readFileSync(new URL(file, FOLDER)));
      expect([...bytes.subarray(0, 8)], file).toEqual(SIGNATURE);
      const { width, height } = shapeOf(bytes);
      expect(Math.min(width, height), `${file} is ${width} by ${height}`).toBeGreaterThanOrEqual(
        SHORTEST_SIDE,
      );
    }
  });
});
