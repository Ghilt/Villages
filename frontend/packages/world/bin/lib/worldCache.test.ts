import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isLink, isShared, removeHere } from './links.ts';
import { heldBy, lock, tryLock } from './locks.ts';
import { Shelf, borrow, isBorrowed, noteBorrowed, readBorrowed } from './worldCache.ts';
import type { Parts } from './worldKeys.ts';
import type { WorldStep } from './worldSteps.ts';

/**
 * The shelf, over steps that make a file or two: an entry filed whole or not at all, never twice, lent by hard
 * link and copy, found changed when it was written into, and a tree's hand-made junction taken apart without
 * touching what it showed. See decision record 0095.
 */

let scratch: string;
let shelf: Shelf;
let tree: string;

const put = (path: string, text: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

const PARTS: Parts = { step: 's', master: 'terrain', code: {}, libraries: {}, from: {}, after: {} };
const W = 'frontend/apps/web/public/world';
const TILE: WorldStep = {
  name: 'tile',
  tool: 'bin/tile.ts',
  options: [],
  memory: 1,
  heavy: true,
  perMaster: true,
  from: [],
  after: [],
  makes: [{ path: `${W}/masters/<m>/tiles`, is: 'tiles', folder: true }],
  doing: '',
  done: '',
};
const NAMES: WorldStep = {
  ...TILE,
  name: 'names',
  makes: [
    { path: 'world/ground/<m>/regions.bin', is: 'names-server', optional: true },
    { path: 'world/ground/<m>/names.json', is: 'names-server' },
  ],
};

/** What a tool told `--into <making>` would leave there. */
const madeTiles = (making: string, text = 'a tile') => {
  put(join(making, W, 'masters', 'terrain', 'tiles', '0', '0', '0.png'), text);
  put(join(making, W, 'masters', 'terrain', 'tiles', 'cut.json'), '{}');
};

const fileTiles = (text?: string) => {
  const making = shelf.making('tile', 'k1');
  madeTiles(making, text);
  return shelf.file(making, {
    step: TILE,
    key: 'k1',
    master: 'terrain',
    parts: PARTS,
    said: 'cut',
    madeIn: 't',
  });
};

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'villages-shelf-'));
  shelf = new Shelf(join(scratch, 'shelf'));
  tree = join(scratch, 'tree');
  mkdirSync(tree);
});

afterEach(() => {
  removeHere(scratch);
});

describe('filing an entry', () => {
  it('files what was made whole, says what it was made from, and remembers what the tool said', () => {
    const { entry, problem } = fileTiles();

    expect(problem).toBeUndefined();
    expect(entry).toBe(shelf.entryOf('tile', 'k1'));
    const keyFile = shelf.has('tile', 'k1')!;
    expect(Object.keys(keyFile.files).sort()).toEqual([
      `${W}/masters/terrain/tiles/0/0/0.png`,
      `${W}/masters/terrain/tiles/cut.json`,
    ]);
    expect(keyFile.parts).toEqual(PARTS);
    expect(shelf.saidBy('tile', 'k1')).toBe('cut');
    expect(shelf.problemsWith('tile', 'k1')).toEqual([]);
  });

  it('files nothing of a run that did not make what the step makes', () => {
    const making = shelf.making('tile', 'k1');
    const { entry, problem } = shelf.file(making, {
      step: TILE,
      key: 'k1',
      master: 'terrain',
      parts: PARTS,
      said: '',
      madeIn: 't',
    });

    expect(entry).toBeUndefined();
    expect(problem).toMatch(/made no .*tiles/);
    expect(existsSync(making)).toBe(false);
    expect(shelf.has('tile', 'k1')).toBeUndefined();
  });

  it('never counts a run that was stopped halfway as an entry', () => {
    madeTiles(shelf.making('tile', 'k1'));

    expect(shelf.has('tile', 'k1')).toBeUndefined();
  });

  it('keeps the first of two trees that made the same entry at once, and throws the second away', () => {
    const first = shelf.making('tile', 'k1');
    const second = shelf.making('tile', 'k1');
    madeTiles(first, 'first');
    madeTiles(second, 'second');
    const made = { step: TILE, key: 'k1', master: 'terrain', parts: PARTS, said: '', madeIn: 't' };
    shelf.file(first, made);
    const { entry } = shelf.file(second, made);

    expect(entry).toBe(shelf.entryOf('tile', 'k1'));
    expect(readFileSync(join(entry!, W, 'masters', 'terrain', 'tiles', '0', '0', '0.png'), 'utf8')).toBe(
      'first',
    );
    expect(existsSync(second)).toBe(false);
  });
});

describe('borrowing an entry', () => {
  it('lends a folder by hard link, and knows the tree has it', () => {
    const { entry } = fileTiles();
    borrow(entry!, TILE, 'terrain', tree);

    const tile = join(tree, W, 'masters', 'terrain', 'tiles', '0', '0', '0.png');
    expect(readFileSync(tile, 'utf8')).toBe('a tile');
    expect(isShared(tile)).toBe(true);
    expect(isBorrowed(entry!, shelf.has('tile', 'k1')!, TILE, 'terrain', tree)).toBe(true);
  });

  it('knows when the tree has made its own since', () => {
    const { entry } = fileTiles();
    borrow(entry!, TILE, 'terrain', tree);
    removeHere(join(tree, W, 'masters', 'terrain', 'tiles'));
    madeTiles(tree);

    expect(isBorrowed(entry!, shelf.has('tile', 'k1')!, TILE, 'terrain', tree)).toBe(false);
  });

  it('copies loose files with the entry dates, and takes away one the entry does not have', () => {
    const making = shelf.making('names', 'n1');
    put(join(making, 'world', 'ground', 'terrain', 'names.json'), '{"names":[]}');
    const then = new Date('2026-10-01T00:00:00Z');
    utimesSync(join(making, 'world', 'ground', 'terrain', 'names.json'), then, then);
    const { entry } = shelf.file(making, {
      step: NAMES,
      key: 'n1',
      master: 'terrain',
      parts: PARTS,
      said: '',
      madeIn: 't',
    });
    put(join(tree, 'world', 'ground', 'terrain', 'regions.bin'), 'an older run named other seas');
    borrow(entry!, NAMES, 'terrain', tree);

    const names = join(tree, 'world', 'ground', 'terrain', 'names.json');
    expect(statSync(names).mtime.getTime()).toBe(then.getTime());
    expect(isShared(names)).toBe(false);
    expect(existsSync(join(tree, 'world', 'ground', 'terrain', 'regions.bin'))).toBe(false);
    expect(isBorrowed(entry!, shelf.has('names', 'n1')!, NAMES, 'terrain', tree)).toBe(true);
  });

  it('takes apart a hand-made junction above, keeping the other masters it showed and not touching them', () => {
    const main = join(scratch, 'main', 'world');
    put(join(main, 'masters', 'terrain2', 'tiles', 'cut.json'), 'the main checkout cut this');
    mkdirSync(join(tree, 'frontend', 'apps', 'web', 'public'), { recursive: true });
    symlinkSync(main, join(tree, W), 'junction');
    const { entry } = fileTiles();
    borrow(entry!, TILE, 'terrain', tree);

    expect(isLink(join(tree, W))).toBe(false);
    expect(readFileSync(join(tree, W, 'masters', 'terrain2', 'tiles', 'cut.json'), 'utf8')).toBe(
      'the main checkout cut this',
    );
    expect(existsSync(join(main, 'masters', 'terrain'))).toBe(false);
    expect(existsSync(join(tree, W, 'masters', 'terrain', 'tiles', 'cut.json'))).toBe(true);
  });

  it('finds an entry written into in place, and takes it off the shelf', () => {
    const { entry } = fileTiles();
    borrow(entry!, TILE, 'terrain', tree);
    const tile = join(tree, W, 'masters', 'terrain', 'tiles', '0', '0', '0.png');
    writeFileSync(tile, 'written into, through the tree');
    utimesSync(tile, new Date('2030-01-01'), new Date('2030-01-01'));

    expect(shelf.problemsWith('tile', 'k1')[0]).toMatch(/was written since it was filed/);
    shelf.discard('tile', 'k1');
    expect(shelf.has('tile', 'k1')).toBeUndefined();
    expect(readFileSync(tile, 'utf8')).toBe('written into, through the tree');
  });
});

describe("a tree's record", () => {
  it('says what it borrowed, master by master', () => {
    noteBorrowed(tree, 'terrain', 'tile', 'k1');
    noteBorrowed(tree, 'terrain', 'flow', 'f1');
    noteBorrowed(tree, '*', 'styles', 's1');

    expect(readBorrowed(tree)).toEqual({ terrain: { tile: 'k1', flow: 'f1' }, '*': { styles: 's1' } });
  });
});

describe('a lock', () => {
  it('is held by one at a time, and taken over when its holder stopped', async () => {
    const at = join(scratch, 'locks', 'tree.lock');
    const first = tryLock(at, 'the quick start')!;

    expect(tryLock(at, 'the debug panel')).toBeUndefined();
    expect(heldBy(at)).toBe('the quick start');
    first.release();
    expect(heldBy(at)).toBeUndefined();

    tryLock(at, 'a run that was killed');
    const long = new Date(Date.now() - 5 * 60_000);
    utimesSync(at, long, long);
    const taken = tryLock(at, 'the next run');
    expect(taken?.by).toBe('the next run');

    const waiting: string[] = [];
    const later = lock(at, 'a third', { waiting: (holder) => waiting.push(holder) });
    setTimeout(() => taken!.release(), 100);
    expect((await later).by).toBe('a third');
    expect(waiting).toEqual(['the next run']);
  });
});
