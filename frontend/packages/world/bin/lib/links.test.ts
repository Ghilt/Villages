import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  FOLDER_PATIENCE,
  isLink,
  isShared,
  linkFiles,
  linkOnTheWay,
  linkTarget,
  patiently,
  placeFile,
  refuseLinked,
  removeHere,
  samePlace,
} from './links.ts';

/**
 * What a link does here, proved rather than assumed: a tree's world is borrowed from the world cache, and a remove or
 * a write that reached the cache's copy would take every tree's world with it. See decision record 0095 and
 * experiment 0019, which records what Node and git did on the machine the world is made on.
 */

let scratch: string;
let shelf: string;
let tree: string;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'villages-links-'));
  shelf = join(scratch, 'shelf');
  tree = join(scratch, 'tree');
  mkdirSync(join(shelf, 'tiles', '0'), { recursive: true });
  writeFileSync(join(shelf, 'tiles', '0', 'sentinel.png'), 'every tree borrows this');
  mkdirSync(tree);
});

afterEach(() => {
  removeHere(scratch);
});

const sentinel = () => join(shelf, 'tiles', '0', 'sentinel.png');
const junction = (target: string, path: string) => {
  mkdirSync(join(path, '..'), { recursive: true });
  symlinkSync(target, path, 'junction');
};
const git = (where: string, ...words: string[]) =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-C', where, ...words], {
    stdio: 'pipe',
  });

describe('a junction left by hand', () => {
  it('is known for one, says where it points, and is found on the way down to a path', () => {
    junction(join(shelf, 'tiles'), join(tree, 'world', 'tiles'));

    expect(isLink(join(tree, 'world', 'tiles'))).toBe(true);
    expect(isLink(join(tree, 'world'))).toBe(false);
    expect(isLink(join(tree, 'nothing here'))).toBe(false);
    expect(samePlace(linkTarget(join(tree, 'world', 'tiles'))!, join(shelf, 'tiles'))).toBe(true);
    expect(linkOnTheWay(join(tree, 'world', 'tiles', '0', 'a.png'), tree)).toBe(join(tree, 'world', 'tiles'));
    expect(linkOnTheWay(join(tree, 'world', 'flow'), tree)).toBeUndefined();
    expect(() => refuseLinked(join(tree, 'world', 'tiles'), tree, 'the tiles')).toThrow(/linked to/);
    expect(() => refuseLinked(join(tree, 'world', 'flow'), tree, 'the flow')).not.toThrow();
  });

  it('is taken away by removeHere without what it points at, inside a folder or on its own', () => {
    junction(join(shelf, 'tiles'), join(tree, 'tiles'));
    junction(join(shelf, 'tiles'), join(tree, 'masters', 'terrain', 'tiles'));
    writeFileSync(join(tree, 'masters', 'terrain', 'terrain.geojson'), '{}');
    removeHere(join(tree, 'tiles'));
    removeHere(join(tree, 'masters'));

    expect(existsSync(join(tree, 'tiles'))).toBe(false);
    expect(existsSync(join(tree, 'masters'))).toBe(false);
    expect(existsSync(sentinel())).toBe(true);
  });

  it("is taken away by Node's own rm without what it points at, on this Node", () => {
    // Not relied on - every tool uses removeHere - but recorded, so that a Node that changes it is noticed.
    junction(join(shelf, 'tiles'), join(tree, 'deeper', 'tiles'));
    rmSync(join(tree, 'deeper'), { recursive: true, force: true });

    expect(existsSync(sentinel())).toBe(true);
  });

  it.runIf(process.platform === 'win32')(
    'is followed by git worktree remove, which empties what it points at: why a tree never borrows by junction',
    () => {
      git(scratch, 'init', '-q', 'repo');
      writeFileSync(join(scratch, 'repo', '.gitignore'), 'public/\n');
      git(join(scratch, 'repo'), 'add', '.gitignore');
      git(join(scratch, 'repo'), 'commit', '-qm', 'one');
      git(join(scratch, 'repo'), 'worktree', 'add', '-q', join(scratch, 'wt'), '-b', 'wt');
      junction(join(shelf, 'tiles'), join(scratch, 'wt', 'public', 'tiles'));
      git(join(scratch, 'repo'), 'worktree', 'remove', '--force', join(scratch, 'wt'));

      expect(existsSync(sentinel())).toBe(false);
    },
  );
});

describe('a borrow by hard link', () => {
  it('shares every file, in real folders, and says so of each', () => {
    writeFileSync(join(shelf, 'tiles', 'cut.json'), '{}');
    const linked = linkFiles(join(shelf, 'tiles'), join(tree, 'tiles'));

    expect(linked).toBe(2);
    expect(isLink(join(tree, 'tiles'))).toBe(false);
    expect(readFileSync(join(tree, 'tiles', '0', 'sentinel.png'), 'utf8')).toBe('every tree borrows this');
    expect(isShared(join(tree, 'tiles', '0', 'sentinel.png'))).toBe(true);
    expect(isShared(join(scratch, 'nothing'))).toBe(false);
  });

  it('loses only its own names to removeHere', () => {
    linkFiles(join(shelf, 'tiles'), join(tree, 'tiles'));
    removeHere(join(tree, 'tiles'));

    expect(existsSync(join(tree, 'tiles'))).toBe(false);
    expect(readFileSync(sentinel(), 'utf8')).toBe('every tree borrows this');
    expect(isShared(sentinel())).toBe(false);
  });

  it('loses only its own names to git worktree remove, which deletes a tree', () => {
    git(scratch, 'init', '-q', 'repo');
    writeFileSync(join(scratch, 'repo', '.gitignore'), 'public/\n');
    git(join(scratch, 'repo'), 'add', '.gitignore');
    git(join(scratch, 'repo'), 'commit', '-qm', 'one');
    git(join(scratch, 'repo'), 'worktree', 'add', '-q', join(scratch, 'wt'), '-b', 'wt');
    linkFiles(join(shelf, 'tiles'), join(scratch, 'wt', 'public', 'tiles'));
    git(join(scratch, 'repo'), 'worktree', 'remove', '--force', join(scratch, 'wt'));

    expect(existsSync(join(scratch, 'wt'))).toBe(false);
    expect(readFileSync(sentinel(), 'utf8')).toBe('every tree borrows this');
  });
});

describe('placing a file', () => {
  it('copies it whole, writable, with the date of what it was made from', () => {
    const from = join(shelf, 'ground.json');
    writeFileSync(from, '{"cells":1}');
    const then = new Date('2026-10-01T12:00:00Z');
    utimesSync(from, then, then);

    placeFile(from, join(tree, 'ground', 'ground.json'));
    placeFile(from, join(tree, 'ground', 'ground.json'));

    const copy = join(tree, 'ground', 'ground.json');
    expect(readFileSync(copy, 'utf8')).toBe('{"cells":1}');
    expect(statSync(copy).mtime.getTime()).toBe(then.getTime());
    expect(isShared(copy)).toBe(false);
  });

  it('over a borrowed file replaces the name and leaves the shared bytes alone', () => {
    linkFiles(join(shelf, 'tiles'), join(tree, 'tiles'));
    const mine = join(scratch, 'mine.png');
    writeFileSync(mine, 'this tree made its own');

    placeFile(mine, join(tree, 'tiles', '0', 'sentinel.png'));

    expect(readFileSync(join(tree, 'tiles', '0', 'sentinel.png'), 'utf8')).toBe('this tree made its own');
    expect(readFileSync(sentinel(), 'utf8')).toBe('every tree borrows this');
  });

  it('hard-linked, when it is a borrow', () => {
    placeFile(sentinel(), join(tree, 'names.json'), true);

    expect(isShared(join(tree, 'names.json'))).toBe(true);
    expect(isShared(sentinel())).toBe(true);
  });
});

/** An act that fails as a file a scanner is reading does, until `ms` have gone by. */
const busyFor = (ms: number) => {
  const began = performance.now();
  return () => {
    if (performance.now() - began < ms) {
      throw Object.assign(new Error('busy'), { code: 'EPERM' });
    }
    return 'through';
  };
};

describe('waiting for Windows to let go of a file', () => {
  it('tries again while it is busy, for as long as it is given and no longer', () => {
    expect(patiently(busyFor(300), { within: 2_000 })).toBe('through');

    const began = performance.now();
    expect(() => patiently(busyFor(10_000), { within: 300 })).toThrow('busy');
    expect(performance.now() - began).toBeLessThan(1_000);
  });

  it('throws at once what is not a busy file', () => {
    let tries = 0;
    const gone = () => {
      tries += 1;
      throw Object.assign(new Error('gone'), { code: 'ENOENT' });
    };

    expect(() => patiently(gone, { within: 2_000 })).toThrow('gone');
    expect(tries).toBe(1);
  });

  it('says it is waiting once a second has gone by, and once only', () => {
    let told = 0;
    patiently(busyFor(100), { waiting: () => (told += 1) });
    expect(told).toBe(0);

    let waited = 0;
    patiently(busyFor(2_500), {
      within: 5_000,
      waiting: (soFar) => {
        told += 1;
        waited = soFar;
      },
    });
    expect(told).toBe(1);
    expect(waited).toBeGreaterThanOrEqual(1_000);
  });

  it.runIf(process.platform === 'win32')(
    'waits out another process reading a file in a folder, which Windows will not let be renamed until it lets go',
    async () => {
      const folder = join(tree, 'tiles.borrowing');
      mkdirSync(join(folder, '0'), { recursive: true });
      writeFileSync(join(folder, '0', 'a.png'), 'new');
      const reader = spawn(
        process.execPath,
        [
          '-e',
          "const fs = require('fs'); const fd = fs.openSync(process.argv[1], 'r'); process.stdout.write('open'); setTimeout(() => fs.closeSync(fd), 1000)",
          join(folder, '0', 'a.png'),
        ],
        { stdio: ['ignore', 'pipe', 'inherit'] },
      );
      await new Promise((opened) => reader.stdout.once('data', opened));

      let refused: string | undefined;
      try {
        renameSync(folder, join(tree, 'tiles'));
      } catch (error) {
        refused = (error as NodeJS.ErrnoException).code;
      }
      expect(refused).toBe('EPERM');

      patiently(() => renameSync(folder, join(tree, 'tiles')), { within: FOLDER_PATIENCE });
      expect(readFileSync(join(tree, 'tiles', '0', 'a.png'), 'utf8')).toBe('new');
      if (reader.exitCode === null) await new Promise((exited) => reader.once('exit', exited));
    },
  );
});
