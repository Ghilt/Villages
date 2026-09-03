import { deflateSync, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { chunk, crc32, encodeIndexedPng } from './png.ts';
import { createRaster, fillPolygon } from './raster.ts';
import type { Rgb } from './palette.ts';

const deflate = (data: Uint8Array) => new Uint8Array(deflateSync(data));

const PALETTE: Rgb[] = [
  [16, 61, 92],
  [108, 194, 74],
  [242, 246, 248],
];

function findChunk(png: Uint8Array, name: string): { length: number; data: Uint8Array } | null {
  let at = 8;
  while (at + 12 <= png.length) {
    const view = new DataView(png.buffer, png.byteOffset);
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    if (type === name) {
      return { length, data: png.subarray(at + 8, at + 8 + length) };
    }
    at += 12 + length;
  }
  return null;
}

describe('the check value', () => {
  it('matches the value the format specifies for a known input', () => {
    // The CRC of "IEND" with no data, which every PNG in the world ends with.
    expect(crc32(new Uint8Array([0x49, 0x45, 0x4e, 0x44]))).toBe(0xae426082);
  });

  it('changes when a single byte changes', () => {
    expect(crc32(new Uint8Array([1, 2, 3]))).not.toBe(crc32(new Uint8Array([1, 2, 4])));
  });
});

describe('a chunk', () => {
  it('announces its length, names itself, and checks itself', () => {
    const built = chunk('IDAT', new Uint8Array([7, 7]));

    expect(built.length).toBe(12 + 2);
    expect(String.fromCharCode(...built.subarray(4, 8))).toBe('IDAT');
    expect(new DataView(built.buffer, built.byteOffset).getUint32(0)).toBe(2);
  });
});

describe('the master image', () => {
  const raster = createRaster(8, 4);
  fillPolygon(
    raster,
    [
      [
        [-90, -45],
        [90, -45],
        [90, 45],
        [-90, 45],
      ],
    ],
    1,
  );
  const png = encodeIndexedPng(raster, PALETTE, deflate);

  it('is a PNG', () => {
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it('says how big it is, and that it is indexed at eight bits', () => {
    const header = findChunk(png, 'IHDR')!;
    const view = new DataView(header.data.buffer, header.data.byteOffset);

    expect(view.getUint32(0)).toBe(8);
    expect(view.getUint32(4)).toBe(4);
    expect(header.data[8]).toBe(8);
    expect(header.data[9]).toBe(3);
    expect(header.data[12]).toBe(0);
  });

  it('carries the palette, in order, as the classes were given', () => {
    const table = findChunk(png, 'PLTE')!;

    expect(table.length).toBe(PALETTE.length * 3);
    expect([...table.data.subarray(0, 3)]).toEqual([16, 61, 92]);
    expect([...table.data.subarray(3, 6)]).toEqual([108, 194, 74]);
  });

  it('holds the class of every pixel, recoverable byte for byte', () => {
    const data = findChunk(png, 'IDAT')!;
    const raw = new Uint8Array(inflateSync(data.data));
    const stride = raster.width + 1;

    expect(raw.length).toBe(stride * raster.height);
    for (let row = 0; row < raster.height; row += 1) {
      expect(raw[row * stride]).toBe(0);
      const line = [...raw.subarray(row * stride + 1, (row + 1) * stride)];
      expect(line).toEqual([...raster.cells.subarray(row * raster.width, (row + 1) * raster.width)]);
    }
  });

  it('ends where a PNG ends', () => {
    expect(String.fromCharCode(...png.subarray(png.length - 8, png.length - 4))).toBe('IEND');
  });

  it('refuses a palette an indexed image cannot hold', () => {
    expect(() => encodeIndexedPng(raster, [], deflate)).toThrow(/1 and 256/);
    expect(() => encodeIndexedPng(raster, new Array<Rgb>(257).fill([0, 0, 0]), deflate)).toThrow(/1 and 256/);
  });

  it('compresses flat terrain to almost nothing', () => {
    const wide = createRaster(2048, 1024, 5);
    const flat = encodeIndexedPng(wide, PALETTE, deflate);

    expect(flat.length).toBeLessThan(wide.cells.length / 100);
  });
});
