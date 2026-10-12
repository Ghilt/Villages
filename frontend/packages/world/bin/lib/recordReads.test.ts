import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { removeHere } from './links.ts';

/**
 * The recorder `world:ready` loads before a tool, proved on a tool of four lines: every way the world's tools read
 * a file is seen, through the names they import from `node:fs` and `node:fs/promises`, and a write is not a read.
 */
let scratch: string;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'villages-reads-'));
});

afterEach(() => {
  removeHere(scratch);
});

describe('the recorder of files opened', () => {
  it('sees every read a tool makes, and its own code, and none of its writes', () => {
    for (const name of ['sync.json', 'promised.json', 'streamed.bin', 'opened.bin']) {
      writeFileSync(join(scratch, name), '{}');
    }
    const tool = join(scratch, 'tool.mjs');
    writeFileSync(
      tool,
      [
        "import { createReadStream, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';",
        "import { readFile } from 'node:fs/promises';",
        "readFileSync(process.argv[2] + '/sync.json');",
        "await readFile(process.argv[2] + '/promised.json');",
        "closeSync(openSync(process.argv[2] + '/opened.bin', 'r'));",
        "await new Promise((done) => createReadStream(process.argv[2] + '/streamed.bin').on('close', done).resume());",
        "writeFileSync(process.argv[2] + '/written.json', '{}');",
      ].join('\n'),
    );
    const reads = join(scratch, 'reads.txt');
    const recorder = pathToFileURL(fileURLToPath(new URL('./recordReads.ts', import.meta.url))).href;
    execFileSync(process.execPath, ['--import', recorder, tool, scratch], {
      env: { ...process.env, VILLAGES_READS: reads },
    });

    const seen = readFileSync(reads, 'utf8')
      .split('\n')
      .map((path) => path.slice(scratch.length + 1))
      .sort();
    // The tool's own code is seen as Node loads it, which is why world:ready counts a tool's code among what it may read.
    expect(seen).toEqual(['opened.bin', 'promised.json', 'streamed.bin', 'sync.json', 'tool.mjs']);
  });
});
