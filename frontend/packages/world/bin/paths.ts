import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** The repository root, three levels above this package's bin directory. */
export const REPO = resolve(here, '..', '..', '..', '..');

export const WARP_CONFIG = resolve(REPO, 'world', 'warp.json');
export const PALETTE = resolve(REPO, 'world', 'palette.json');
export const MASTER_CONFIG = resolve(REPO, 'world', 'master.json');
/** The master image a human edits, and the palette strip to pick its colours from. */
export const MASTER_DIR = resolve(REPO, 'world', 'master');
/** Downloaded Natural Earth files. Not committed: they are raw material, not our world. */
export const SOURCE_DIR = resolve(REPO, 'world', 'source');
/** Where the generated world goes, served statically by the dev server and the build. */
export const OUTPUT_DIR = resolve(REPO, 'frontend', 'apps', 'web', 'public', 'world');
