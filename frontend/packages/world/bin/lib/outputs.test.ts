import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isLink, isShared, linkFiles, placeFile, removeHere } from './links.ts';
import { freshFolder, ownFile, ownFolder, writtenAt } from './outputs.ts';

/**
 * A world tool run by hand in a tree that borrowed its world: it takes the borrowed names back before it writes,
 * so what it writes is the tree's own and the world cache's files are never written into. See decision 0095.
 */
let scratch: string;
let shelf: string;
let tree: string;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'villages-outputs-'));
  shelf = join(scratch, 'shelf');
  tree = join(scratch, 'tree');
  mkdirSync(join(shelf, 'tiles', '0'), { recursive: true });
  writeFileSync(join(shelf, 'tiles', '0', '0.png'), 'shared');
  writeFileSync(join(shelf, 'ground.json'), 'shared');
  mkdirSync(tree);
});

afterEach(() => {
  removeHere(scratch);
});

describe('a tool writing into the tree', () => {
  it('writes where it always did when it is not told --into', () => {
    expect(writtenAt(join(tree, 'tiles'))).toBe(join(tree, 'tiles'));
  });

  it('takes back a borrowed folder before writing it, and leaves the shelf alone', () => {
    linkFiles(join(shelf, 'tiles'), join(tree, 'tiles'));
    ownFolder(join(tree, 'tiles'), 'the tiles');

    expect(existsSync(join(tree, 'tiles'))).toBe(false);
    expect(readFileSync(join(shelf, 'tiles', '0', '0.png'), 'utf8')).toBe('shared');
    expect(isShared(join(shelf, 'tiles', '0', '0.png'))).toBe(false);
  });

  it('leaves a folder the tree made itself as it is', () => {
    mkdirSync(join(tree, 'tiles', '0'), { recursive: true });
    writeFileSync(join(tree, 'tiles', '0', '0.png'), 'mine');
    ownFolder(join(tree, 'tiles'), 'the tiles');

    expect(readFileSync(join(tree, 'tiles', '0', '0.png'), 'utf8')).toBe('mine');
  });

  it('takes away a junction where its folder goes, the link alone', () => {
    symlinkSync(join(shelf, 'tiles'), join(tree, 'tiles'), 'junction');
    freshFolder(join(tree, 'tiles'), 'the tiles');

    expect(isLink(join(tree, 'tiles'))).toBe(false);
    expect(existsSync(join(shelf, 'tiles', '0', '0.png'))).toBe(true);
  });

  it('takes back a borrowed file before writing it', () => {
    placeFile(join(shelf, 'ground.json'), join(tree, 'ground.json'), true);
    ownFile(join(tree, 'ground.json'), 'the ground map');
    writeFileSync(join(tree, 'ground.json'), 'mine');

    expect(readFileSync(join(shelf, 'ground.json'), 'utf8')).toBe('shared');
  });
});
