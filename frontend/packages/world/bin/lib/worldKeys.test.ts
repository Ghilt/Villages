import { cpSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { removeHere } from './links.ts';
import { REPO } from './paths.ts';
import { HashMemo, codeOf, fingerprintsOf, whatMoved } from './worldKeys.ts';
import { WORLD_STEPS, forMaster } from './worldSteps.ts';
import type { WorldStep } from './worldSteps.ts';

/**
 * What a fingerprint is made of, proved by changing one thing at a time: each change moves the steps made from it
 * and no others, and two trees with the same inputs agree. See decision record 0095.
 */

let scratch: string;
let tree: string;

const put = (root: string, path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

/** A few steps shaped as the real ones are, over tools of a line or two. */
const STEPS: WorldStep[] = [
  {
    name: 'tile',
    tool: 'bin/tile.ts',
    options: [],
    memory: 1,
    heavy: true,
    perMaster: true,
    from: [
      { path: 'world/master/<m>.png', is: 'master' },
      { path: 'world/palette.json', is: 'palette' },
    ],
    after: [],
    makes: [{ path: 'out/<m>/tiles', is: 'tiles', folder: true }],
    doing: '',
    done: '',
  },
  {
    name: 'sprites',
    tool: 'bin/sprites.ts',
    options: [],
    memory: 1,
    heavy: true,
    perMaster: true,
    from: [
      { path: 'world/master/<m>.png', is: 'master' },
      { path: 'world/painterly.json', is: 'painterly', part: 'views' },
    ],
    after: [],
    makes: [{ path: 'out/<m>/sprites', is: 'sprite-map', folder: true }],
    doing: '',
    done: '',
  },
  {
    name: 'styles',
    tool: 'bin/styles.ts',
    options: ['--config-only'],
    memory: 1,
    heavy: false,
    perMaster: false,
    from: [{ path: 'world/painterly.json', is: 'painterly' }],
    after: [],
    makes: [{ path: 'out/paint.json', is: 'paint' }],
    doing: '',
    done: '',
  },
  {
    name: 'origin',
    tool: 'bin/origin.ts',
    options: [],
    memory: 1,
    heavy: true,
    perMaster: true,
    from: [{ path: 'world/master/<m>.png', is: 'master' }],
    after: [],
    makes: [{ path: 'out/<m>/origin', is: 'origin', folder: true }],
    doing: '',
    done: '',
  },
  {
    name: 'culture',
    tool: 'bin/culture.ts',
    options: [],
    memory: 1,
    heavy: false,
    perMaster: true,
    from: [
      { path: 'world/cultures.json', is: 'cultures' },
      { path: 'world/names/about.json', is: 'names-review', optional: true },
    ],
    after: ['origin'],
    makes: [{ path: 'out/<m>/culture', is: 'culture', folder: true }],
    doing: '',
    done: '',
  },
];

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'villages-keys-'));
  tree = join(scratch, 'tree');
  put(tree, 'frontend/packages/world/package.json', '{"devDependencies":{"sharp":"^0.34.5"}}');
  put(tree, 'world/master/terrain.png', 'the painting');
  put(tree, 'world/palette.json', '{"classes":[]}');
  put(tree, 'world/painterly.json', '{"views":[{"name":"alps"}],"styles":{"oil":1}}');
  put(tree, 'world/cultures.json', '[]');
  put(tree, 'bin/lib/shared.ts', 'export const shared = 1;\n');
  put(tree, 'bin/lib/types.ts', 'export interface Only { a: number }\n');
  put(tree, 'src/tiles.ts', 'export const tiles = 1;\n');
  put(
    tree,
    'bin/tile.ts',
    "import type { Only } from './lib/types.ts';\nimport {\n  tiles,\n} from '../src/tiles.ts';\nimport { shared } from './lib/shared.ts';\n",
  );
  put(tree, 'bin/sprites.ts', "import { shared } from './lib/shared.ts';\n");
  put(tree, 'bin/styles.ts', 'export {};\n');
  put(tree, 'bin/origin.ts', 'export {};\n');
  put(tree, 'bin/culture.ts', 'export {};\n');
});

afterEach(() => {
  removeHere(scratch);
});

const keys = (root = tree, master = 'terrain') =>
  new Map(
    [...fingerprintsOf(master, { root, memo: new HashMemo(), steps: STEPS })].map(([name, one]) => [
      name,
      one.key,
    ]),
  );

/** The names of the steps whose fingerprints differ between two runs. */
const moved = (before: Map<string, string>, after: Map<string, string>) =>
  [...before.keys()].filter((name) => before.get(name) !== after.get(name)).sort();

describe('a fingerprint', () => {
  it('is the same in two trees with the same inputs, wherever they are', () => {
    const other = join(scratch, 'elsewhere', 'other tree');
    cpSync(tree, other, { recursive: true });

    expect(keys(other)).toEqual(keys());
  });

  it('moves with the master for every step made from it, and the styles stay', () => {
    const before = keys();
    put(tree, 'world/master/terrain.png', 'the painting, repainted');

    expect(moved(before, keys())).toEqual(['culture', 'origin', 'sprites', 'tile']);
  });

  it('moves with the palette for the tiles alone, here', () => {
    const before = keys();
    put(tree, 'world/palette.json', '{"classes":[1]}');

    expect(moved(before, keys())).toEqual(['tile']);
  });

  it('reads only the part of a file it is told to', () => {
    const before = keys();
    put(tree, 'world/painterly.json', '{"views":[{"name":"alps"}],"styles":{"oil":2}}');

    expect(moved(before, keys())).toEqual(['styles']);
    put(tree, 'world/painterly.json', '{"views":[{"name":"andes"}],"styles":{"oil":2}}');
    expect(moved(before, keys())).toEqual(['sprites', 'styles']);
  });

  it('moves with what a step reads the output of', () => {
    const before = keys();
    put(tree, 'world/cultures.json', '[1]');

    expect(moved(before, keys())).toEqual(['culture']);
  });

  it('counts an optional input being there, and a missing one it cannot do without', () => {
    const before = keys();
    put(tree, 'world/names/about.json', '{}');

    expect(moved(before, keys())).toEqual(['culture']);
    removeHere(join(tree, 'world', 'cultures.json'));
    const now = fingerprintsOf('terrain', { root: tree, memo: new HashMemo(), steps: STEPS });
    expect(now.get('culture')!.missing).toEqual(['world/cultures.json']);
    expect(now.get('tile')!.missing).toEqual([]);
  });

  it('moves with the code a tool runs, and not with what it imports only as a type', () => {
    const before = keys();
    put(tree, 'bin/lib/types.ts', 'export interface Only { a: string }\n');
    expect(moved(before, keys())).toEqual([]);

    put(tree, 'src/tiles.ts', 'export const tiles = 2;\n');
    expect(moved(before, keys())).toEqual(['tile']);
    put(tree, 'bin/lib/shared.ts', 'export const shared = 2;\n');
    expect(moved(before, keys())).toEqual(['sprites', 'tile']);
  });

  it('is another for another master, and the same styles for both', () => {
    put(tree, 'world/master/other.png', 'the painting');
    const one = keys();
    const two = keys(tree, 'other');

    expect(two.get('tile')).not.toBe(one.get('tile'));
    expect(two.get('styles')).toBe(one.get('styles'));
  });

  it('says what moved, in plain words', () => {
    const then = fingerprintsOf('terrain', { root: tree, memo: new HashMemo(), steps: STEPS });
    put(tree, 'world/master/terrain.png', 'the painting, repainted');
    put(tree, 'bin/lib/shared.ts', 'export const shared = 3;\n');
    const now = fingerprintsOf('terrain', { root: tree, memo: new HashMemo(), steps: STEPS });

    expect(whatMoved(then.get('tile')!.parts, now.get('tile')!.parts)).toEqual([
      'world/master/terrain.png changed',
      'bin/lib/shared.ts, its code, changed',
    ]);
    expect(whatMoved(then.get('culture')!.parts, now.get('culture')!.parts)).toEqual([
      'origin, which it is made from, was made again',
    ]);
    expect(whatMoved(undefined, now.get('tile')!.parts)).toEqual(['nothing was made before']);
  });

  it('remembers a file it has hashed, and keeps what it found for the next run', () => {
    const file = join(scratch, 'hashes.json');
    const memo = new HashMemo(file);
    const hash = memo.hashOf(join(tree, 'world', 'palette.json'));
    memo.save();

    expect(new HashMemo(file).hashOf(join(tree, 'world', 'palette.json'))).toBe(hash);
    expect(memo.hashOf(join(tree, 'nothing'))).toBe('absent');
  });
});

describe('the real steps', () => {
  it('are each made from files this tree has, or may do without, by tools that are there', () => {
    for (const step of WORLD_STEPS) {
      expect(existsSync(join(REPO, step.tool)), step.tool).toBe(true);
      for (const input of step.from) {
        const at = join(REPO, forMaster(input.path, 'terrain3_mended_2026-10-03'));
        if (!input.path.startsWith('world/source/')) {
          expect(existsSync(at) || input.optional === true, input.path).toBe(true);
        }
      }
    }
  });

  it('list every step before the steps that read its output', () => {
    const seen = new Set<string>();
    for (const step of WORLD_STEPS) {
      expect(
        step.after.filter((one) => !seen.has(one)),
        step.name,
      ).toEqual([]);
      seen.add(step.name);
    }
  });

  it("follow a tool's code into the files it runs, and not into those it only borrows a type from", () => {
    const tile = codeOf('frontend/packages/world/bin/tileWorld.ts', REPO, new HashMemo());
    const styles = codeOf('frontend/packages/world/bin/renderPainterly.ts', REPO, new HashMemo());

    expect(Object.keys(tile)).toContain('frontend/packages/world/bin/lib/master.ts');
    expect(Object.keys(tile)).toContain('frontend/packages/world/src/tiles.ts');
    expect(Object.keys(tile)).not.toContain('frontend/packages/world/src/painterly.ts');
    expect(Object.keys(styles)).toContain('frontend/packages/world/src/painterly.ts');
  });
});
