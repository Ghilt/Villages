import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { linkFiles, removeHere } from './links.ts';
import { tryLock } from './locks.ts';
import { Shelf, noteBorrowed } from './worldCache.ts';
import type { Parts } from './worldKeys.ts';
import { pruneShelf } from './worldPrune.ts';
import { stepNamed } from './worldSteps.ts';

/**
 * Clearing the shelf takes what no tree uses and nothing a tree does, however it uses it. See decision 0095.
 */
let scratch: string;
let shelf: Shelf;
let tree: string;

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-01T00:00:00Z');
const PARTS: Parts = { step: 's', master: 'terrain', code: {}, libraries: {}, from: {}, after: {} };
const W = 'frontend/apps/web/public/world';

const put = (path: string, text: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

/** Files a tile entry, made `daysAgo` before NOW. */
function fileTiles(key: string, daysAgo: number): string {
  const making = shelf.making('tile', key);
  put(join(making, W, 'masters', 'terrain', 'tiles', '0', '0', '0.png'), key);
  const { entry } = shelf.file(making, {
    step: stepNamed('tile'),
    key,
    master: 'terrain',
    parts: PARTS,
    said: '',
    madeIn: 'a tree',
  });
  const keyFile = join(entry!, 'key.json');
  const made = JSON.parse(readFileSync(keyFile, 'utf8')) as { madeAt: string };
  made.madeAt = new Date(NOW - daysAgo * DAY).toISOString();
  writeFileSync(keyFile, JSON.stringify(made));
  return entry!;
}

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'villages-prune-'));
  shelf = new Shelf(join(scratch, 'shelf'));
  tree = join(scratch, 'tree');
  mkdirSync(tree);
});

afterEach(() => {
  removeHere(scratch);
});

describe('clearing the shelf', () => {
  it('keeps what a tree borrows, what a tree says it borrowed, what is locked and what is new, and drops the rest', () => {
    const borrowed = fileTiles('borrowed', 30);
    linkFiles(join(borrowed, W), join(tree, W));
    fileTiles('recorded', 30);
    noteBorrowed(tree, 'terrain', 'tile', 'recorded');
    fileTiles('locked', 30);
    const held = tryLock(shelf.lockOfEntry('tile', 'locked'), 'a tree lending it')!;
    fileTiles('new', 2);
    fileTiles('forgotten', 30);

    const rows = pruneShelf(shelf, { trees: [tree], now: NOW });
    const said = Object.fromEntries(rows.map((row) => [row.key, row.keep]));
    expect(said).toEqual({
      borrowed: 'a tree borrows it',
      recorded: 'a tree says it borrowed it',
      locked: 'it is being lent or made just now',
      new: 'it was made in the last week',
      forgotten: null,
    });
    expect(shelf.has('tile', 'forgotten')).toBeDefined();

    pruneShelf(shelf, { trees: [tree], now: NOW, drop: true });
    expect(shelf.has('tile', 'forgotten')).toBeUndefined();
    expect(
      ['borrowed', 'recorded', 'locked', 'new'].every((key) => shelf.has('tile', key) !== undefined),
    ).toBe(true);
    held.release();
  });

  it('takes away a folder nobody is making any more, a day old, and leaves one being made', () => {
    const left = shelf.making('tile', 'stopped');
    const busy = shelf.making('tile', 'busy');
    const old = new Date(NOW - 2 * DAY);
    utimesSync(left, old, old);
    utimesSync(busy, old, old);
    const held = tryLock(shelf.lockOfEntry('tile', 'busy'), 'making it')!;

    pruneShelf(shelf, { trees: [], now: NOW, drop: true });

    expect(existsSync(left)).toBe(false);
    expect(existsSync(busy)).toBe(true);
    held.release();
  });

  it('drops nothing it was not told to', () => {
    fileTiles('forgotten', 30);
    pruneShelf(shelf, { trees: [], now: NOW });

    expect(shelf.has('tile', 'forgotten')).toBeDefined();
  });
});
