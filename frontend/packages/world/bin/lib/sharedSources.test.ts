import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { commonGitDir, isMainCheckout, mainCheckout, worldCacheDir } from './checkouts.ts';
import { isLink, isShared, removeHere } from './links.ts';
import { borrowSources } from './sharedSources.ts';

/** A main checkout with downloads and a worktree beside it, laid out as git lays them out. */
let scratch: string;
let main: string;
let tree: string;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'villages-sources-'));
  main = join(scratch, 'Villages');
  tree = join(main, '.claude', 'worktrees', 'small-change');
  mkdirSync(join(main, '.git', 'worktrees', 'small-change'), { recursive: true });
  writeFileSync(join(main, '.git', 'worktrees', 'small-change', 'commondir'), '../..\n');
  mkdirSync(tree, { recursive: true });
  writeFileSync(join(tree, '.git'), `gitdir: ${join(main, '.git', 'worktrees', 'small-change')}\n`);
  mkdirSync(join(main, 'world', 'source', 'etopo'), { recursive: true });
  writeFileSync(join(main, 'world', 'source', 'ne_10m_lakes.geojson'), 'lakes');
  writeFileSync(join(main, 'world', 'source', 'etopo', 'ETOPO.tif'), 'height');
});

afterEach(() => {
  removeHere(scratch);
});

describe('which checkout is which', () => {
  it('is told from .git, a folder in the main checkout and a file in a worktree', () => {
    expect(isMainCheckout(main)).toBe(true);
    expect(isMainCheckout(tree)).toBe(false);
    expect(commonGitDir(tree)).toBe(join(main, '.git'));
    expect(mainCheckout(tree)).toBe(main);
    expect(mainCheckout(main)).toBe(main);
    expect(worldCacheDir(tree)).toBe(join(main, '.git', 'world-cache'));
  });
});

describe('borrowing the downloads', () => {
  it('gives a fresh tree a hard link to every file, and finds them all there the next time', () => {
    const first = borrowSources(tree);

    expect(first.files).toBe(2);
    expect(first.said).toMatch(/borrowed from the main checkout by hard link: 2 files/);
    expect(readFileSync(join(tree, 'world', 'source', 'etopo', 'ETOPO.tif'), 'utf8')).toBe('height');
    expect(isShared(join(main, 'world', 'source', 'ne_10m_lakes.geojson'))).toBe(true);
    expect(borrowSources(tree).said).toBe('all here, 2 files');
  });

  it('keeps a file the tree fetched itself, and borrows only what it lacks', () => {
    mkdirSync(join(tree, 'world', 'source', 'etopo'), { recursive: true });
    writeFileSync(join(tree, 'world', 'source', 'etopo', 'ETOPO.tif'), 'fetched here');

    expect(borrowSources(tree).files).toBe(1);
    expect(readFileSync(join(tree, 'world', 'source', 'etopo', 'ETOPO.tif'), 'utf8')).toBe('fetched here');
  });

  it("takes away a junction to the main checkout's downloads, the link alone, and borrows in its place", () => {
    mkdirSync(join(tree, 'world'), { recursive: true });
    symlinkSync(join(main, 'world', 'source'), join(tree, 'world', 'source'), 'junction');

    expect(borrowSources(tree).said).toMatch(/in place of a junction/);
    expect(isLink(join(tree, 'world', 'source'))).toBe(false);
    expect(existsSync(join(main, 'world', 'source', 'ne_10m_lakes.geojson'))).toBe(true);
  });

  it('lends nothing from the main checkout, which owns them', () => {
    expect(borrowSources(main).files).toBe(0);
  });
});
