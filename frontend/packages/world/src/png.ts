/**
 * Writing the master image: an eight-bit indexed PNG, which is the one format that both an image editor
 * and this build agree on exactly. Indexed means the file holds a class number per pixel and a table of
 * colours, so nothing can silently blend two terrains into a third.
 *
 * Written by hand rather than borrowed because the format is small, and because the compressor is injected
 * so that this module stays free of any platform.
 */

import type { ClassRaster } from './raster.ts';
import type { Rgb } from './palette.ts';

/** Deflate, supplied by the caller: this package may not reach for a platform of its own. */
export type Deflate = (data: Uint8Array) => Uint8Array;

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let byte = 0; byte < 256; byte += 1) {
    let value = byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[byte] = value >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32(into: Uint8Array, at: number, value: number): void {
  into[at] = (value >>> 24) & 0xff;
  into[at + 1] = (value >>> 16) & 0xff;
  into[at + 2] = (value >>> 8) & 0xff;
  into[at + 3] = value & 0xff;
}

/** One PNG chunk: its length, its four-letter name, its data, and a check over the two of them. */
export function chunk(name: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  writeUint32(out, 0, data.length);
  for (let index = 0; index < 4; index += 1) {
    out[4 + index] = name.charCodeAt(index);
  }
  out.set(data, 8);
  writeUint32(out, 8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

const COLOUR_TYPE_INDEXED = 3;

function header(width: number, height: number): Uint8Array {
  const data = new Uint8Array(13);
  writeUint32(data, 0, width);
  writeUint32(data, 4, height);
  data[8] = 8; // bits per pixel
  data[9] = COLOUR_TYPE_INDEXED;
  data[10] = 0; // deflate, the only compression PNG has
  data[11] = 0; // the standard filter set
  data[12] = 0; // not interlaced
  return data;
}

/**
 * The scanlines, each announced by the filter used on it. Filter zero means the bytes are the class
 * numbers themselves, which keeps a hand edit legible in a hex editor and costs nothing worth having:
 * flat terrain compresses to almost nothing regardless.
 */
function scanlines(raster: ClassRaster): Uint8Array {
  const stride = raster.width + 1;
  const out = new Uint8Array(stride * raster.height);
  for (let row = 0; row < raster.height; row += 1) {
    out[row * stride] = 0;
    out.set(raster.cells.subarray(row * raster.width, (row + 1) * raster.width), row * stride + 1);
  }
  return out;
}

export function encodeIndexedPng(raster: ClassRaster, colours: readonly Rgb[], deflate: Deflate): Uint8Array {
  if (colours.length === 0 || colours.length > 256) {
    throw new Error(`an indexed image needs between 1 and 256 colours, not ${colours.length}`);
  }

  const table = new Uint8Array(colours.length * 3);
  colours.forEach((colour, index) => {
    table.set(colour, index * 3);
  });

  const parts = [
    new Uint8Array(SIGNATURE),
    chunk('IHDR', header(raster.width, raster.height)),
    chunk('PLTE', table),
    chunk('IDAT', deflate(scanlines(raster))),
    chunk('IEND', new Uint8Array(0)),
  ];

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const png = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    png.set(part, at);
    at += part.length;
  }
  return png;
}
