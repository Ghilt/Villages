import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FOLDER_PATIENCE, patiently, removeHere } from './links.ts';

/**
 * How the world's tools wait for Windows to let go of a file a virus scanner is reading. Apart from the links' own
 * tests, `links.test.ts`, because these wait for real - a second and more before a word is said, a process holding a
 * file open - and in a file of their own they wait beside the rest rather than after them (2026-10-20).
 */

let tree: string;

beforeEach(() => {
  tree = mkdtempSync(join(tmpdir(), 'villages-patiently-'));
});

afterEach(() => {
  removeHere(tree);
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
