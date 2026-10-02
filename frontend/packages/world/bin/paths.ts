import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_MASTER } from '../src/masters.ts';

const here = dirname(fileURLToPath(import.meta.url));

/** The repository root, three levels above this package's bin directory. */
export const REPO = resolve(here, '..', '..', '..', '..');

export const WARP_CONFIG = resolve(REPO, 'world', 'warp.json');
export const PALETTE = resolve(REPO, 'world', 'palette.json');
/** What each terrain class is drawn in, as opposed to what it is painted in. */
export const RENDER = resolve(REPO, 'world', 'render.json');
/** What grows where: the biomes, the kinds, and how thickly each one stands. Hand-edited. */
export const BIOMES = resolve(REPO, 'world', 'biomes.json');
export const MASTER_CONFIG = resolve(REPO, 'world', 'master.json');
/** How the world is painted, as opposed to what colour each class is. */
export const PAINTERLY = resolve(REPO, 'world', 'painterly.json');
/** Where the painterly renderer writes its views. Not committed: they are output, and they are large. */
export const PAINTERLY_DIR = resolve(REPO, 'world', 'painterly');
/**
 * Adam's portraits: upright PNGs named for whom they suit, `woman-01.png`, and committed, as the master is.
 * Placeholders are drawn into it, never over anything already there.
 */
export const PORTRAITS_DIR = resolve(REPO, 'world', 'portraits');
/**
 * Adam's scenes: landscape PNGs named for the scene a dialogue names, `harbour.png`, and committed as the
 * portraits are. Placeholders are drawn into it, never over anything already there.
 */
export const SCENES_DIR = resolve(REPO, 'world', 'scenes');
/**
 * Adam's sprites: a picture per scenery kind in `scenery/` and per mark in `marks/`, any format, any size,
 * on a flat background or a transparent one, and committed as the portraits are. Placeholders are drawn
 * into it, never over anything already there.
 */
export const SPRITES_DIR = resolve(REPO, 'world', 'sprites');
/** Where the cut sprites go: an atlas and its frames, served statically. Output, not committed. */
export const ART_DIR = resolve(REPO, 'frontend', 'apps', 'web', 'public', 'art');
/**
 * Every picture the art tool has cut, by the picture's bytes and the rules' own text, so that a save
 * re-cuts only what was saved. A cache: delete it and the next cut is slower and otherwise the same.
 */
export const ART_CACHE_DIR = resolve(REPO, 'frontend', 'node_modules', '.cache', 'villages-art');
/** The master image a human edits, and the palette strip to pick its colours from. */
export const MASTER_DIR = resolve(REPO, 'world', 'master');
/** Downloaded Natural Earth files. Not committed: they are raw material, not our world. */
export const SOURCE_DIR = resolve(REPO, 'world', 'source');
/** Where the world the game plays on goes, served statically by the dev server and the build. */
export const OUTPUT_DIR = resolve(REPO, 'frontend', 'apps', 'web', 'public', 'world');
/**
 * Where the scenery's stands go, beside the rest of the world and never inside `OUTPUT_DIR`: read by the game
 * server, which hands a page only the stands its fog lets through, and by the scenery stills. Output, not
 * committed. See `standsDirOf` and decision record 0067.
 */
export const STANDS_DIR = resolve(REPO, 'world', 'stands');
/** Where a warped copy of Earth goes: raw material for a new master, never read by the game. */
export const WARPED_DIR = resolve(REPO, 'world', 'warped');

/**
 * The master, named however is convenient.
 *
 * `terrain2`, `terrain2.png`, `world/master/terrain2.png` from the repository root, or an absolute path
 * all mean the same file. npm runs a workspace script from the workspace's own directory, so a relative
 * path typed at the repository root would otherwise resolve three levels below where it was typed - and
 * the error for that is a missing file with a path nobody recognises.
 */
export function masterAt(given: string | undefined): string {
  if (given === undefined) {
    return resolve(MASTER_DIR, `${DEFAULT_MASTER}.png`);
  }
  if (isAbsolute(given)) {
    return given;
  }
  if (!/[/\\]/.test(given)) {
    return resolve(MASTER_DIR, given.endsWith('.png') ? given : `${given}.png`);
  }
  return resolve(REPO, given);
}
