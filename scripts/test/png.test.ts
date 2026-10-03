import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { deflateSync } from 'node:zlib';

import { readMaster, readPalette } from '../lib/master.ts';
import { chunk, encodeIndexedPng, readPng } from '../lib/png.ts';

const folder = mkdtempSync(join(tmpdir(), 'villages-png-'));
const save = (name: string, png: Uint8Array) => {
  const path = join(folder, name);
  writeFileSync(path, png);
  return path;
};

async function rowsOf(path: string): Promise<number[][]> {
  const rows: number[][] = [];
  await readPng(path, (row) => rows.push([...row]));
  return rows;
}

/** Filters a row the way an image editor might, so the reader has to undo every kind of filter. */
function filtered(kind: number, row: number[], above: number[], channels: number): number[] {
  return row.map((value, x) => {
    const left = x >= channels ? row[x - channels]! : 0;
    const up = above[x] ?? 0;
    const corner = x >= channels ? (above[x - channels] ?? 0) : 0;
    const p = left + up - corner;
    const paeth =
      Math.abs(p - left) <= Math.abs(p - up) && Math.abs(p - left) <= Math.abs(p - corner)
        ? left
        : Math.abs(p - up) <= Math.abs(p - corner)
          ? up
          : corner;
    const guess = [0, left, up, (left + up) >> 1, paeth][kind]!;
    return (value - guess) & 0xff;
  });
}

function rgbPng(rows: number[][], alpha: boolean): Buffer {
  const channels = alpha ? 4 : 3;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(rows[0]!.length / channels, 0);
  header.writeUInt32BE(rows.length, 4);
  header.set([8, alpha ? 6 : 2, 0, 0, 0], 8);
  const raw = rows.flatMap((row, y) => [y % 5, ...filtered(y % 5, row, rows[y - 1] ?? [], channels)]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Uint8Array.from(raw))),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

describe('reading and writing PNGs', () => {
  it('reads back an indexed image exactly as it was written', async () => {
    const pixels = Uint8Array.from({ length: 7 * 5 }, (_, at) => (at * 13) % 4);
    const path = save(
      'indexed.png',
      encodeIndexedPng(7, 5, pixels, [
        [0, 0, 0],
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
      ]),
    );
    const header = await readPng(path, () => {});
    assert.deepEqual([header.width, header.height, header.colourType], [7, 5, 3]);
    assert.deepEqual((await rowsOf(path)).flat(), [...pixels]);
  });

  it('undoes all five row filters, in colour and with alpha', async () => {
    for (const alpha of [false, true]) {
      const channels = alpha ? 4 : 3;
      const rows = Array.from({ length: 10 }, (_, y) =>
        Array.from({ length: 6 * channels }, (_, x) => (x * 37 + y * 91 + x * y * 7) % 256),
      );
      assert.deepEqual(await rowsOf(save(`filtered-${channels}.png`, rgbPng(rows, alpha))), rows);
    }
  });

  it('refuses a PNG of a kind it does not read, saying how to save it instead', async () => {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(1, 0);
    header.writeUInt32BE(1, 4);
    header.set([16, 2, 0, 0, 0], 8);
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', header),
      chunk('IEND', new Uint8Array(0)),
    ]);
    await assert.rejects(
      readPng(save('sixteen.png', png), () => {}),
      /8-bit PNG/,
    );
  });
});

describe('reading a master', () => {
  const classes = readPalette();
  const colourOf = (name: string) => classes.find((terrain) => terrain.name === name)!.colour;
  const idOf = (name: string) => classes.find((terrain) => terrain.name === name)!.id;

  it('reads an indexed master by its colours, whatever order its palette is in', async () => {
    const colours = [colourOf('river'), colourOf('ocean'), colourOf('meadow')];
    const path = save('master.png', encodeIndexedPng(3, 1, Uint8Array.from([2, 0, 1]), colours));
    const { raster, offColour } = await readMaster(path, classes);
    assert.deepEqual([...raster.cells], [idOf('meadow'), idOf('river'), idOf('ocean')]);
    assert.equal(offColour, 0);
  });

  it('snaps a colour master to the nearest class, and counts what was not exact', async () => {
    const [red, green, blue] = colourOf('river');
    const row = [...colourOf('ocean'), red + 3, green, blue - 2];
    const { raster, offColour } = await readMaster(save('rgb-master.png', rgbPng([row], false)), classes);
    assert.deepEqual([...raster.cells], [idOf('ocean'), idOf('river')]);
    assert.equal(offColour, 1);
  });
});
