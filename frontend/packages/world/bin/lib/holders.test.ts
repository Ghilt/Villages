import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { holdersSaid, whoHolds } from './holders.ts';
import { removeHere } from './links.ts';

/**
 * Who holds a folder, asked of Windows: a folder with one file another process has open, and the same folder let go.
 */

let folder: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'villages-holders-'));
  mkdirSync(join(folder, '0'));
  writeFileSync(join(folder, '0', '0.png'), 'a tile');
  writeFileSync(join(folder, 'cut.json'), '{}');
});

afterEach(() => {
  removeHere(folder);
});

describe.runIf(process.platform === 'win32')('asking Windows who holds a folder', () => {
  it('names the program that has a file in it open, and how many are open', async () => {
    const reader = spawn(
      process.execPath,
      [
        '-e',
        "const fs = require('fs'); fs.openSync(process.argv[1], 'r'); process.stdout.write('open'); setTimeout(() => {}, 60000)",
        join(folder, '0', '0.png'),
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    try {
      await new Promise((opened) => reader.stdout.once('data', opened));

      expect(whoHolds(folder)).toEqual({
        looked: 4,
        open: 1,
        holders: [{ pid: reader.pid, name: 'node', entries: 1 }],
      });
    } finally {
      reader.kill();
      await new Promise((exited) => reader.once('exit', exited));
    }
  }, 60_000);

  it('finds nothing when nothing has it open', () => {
    expect(whoHolds(folder)).toEqual({ looked: 4, open: 0, holders: [] });
  }, 60_000);
});

describe('saying who holds a folder', () => {
  it('names a program Windows runs by what it is, and any other by its name', () => {
    expect(
      holdersSaid({
        looked: 22_110,
        open: 312,
        holders: [
          { pid: 5076, name: 'MsMpEng', entries: 20 },
          { pid: 8072, name: 'warp', entries: 9 },
          { pid: 812, name: 'node', entries: 1 },
        ],
      }),
    ).toBe(
      'held by Windows Defender (MsMpEng, pid 5076) and the Warp terminal (warp, pid 8072) and node (pid 812), ' +
        '312 of its 22,110 files and folders open',
    );
  });

  it('says so when nothing held it by the time it was asked, or what held it has stopped', () => {
    expect(holdersSaid({ looked: 4, open: 0, holders: [] })).toBe(
      'nothing else had any of its 4 files and folders open by the time it was asked',
    );
    expect(holdersSaid({ looked: 4, open: 0, holders: [{ pid: 9, name: '', entries: 1 }] })).toBe(
      'held by a program that has since stopped (pid 9)',
    );
  });
});
