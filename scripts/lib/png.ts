import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createInflate, deflateSync } from 'node:zlib';

/**
 * Reading and writing PNGs with nothing but Node, so that the tools need no `npm install`.
 *
 * Reads eight-bit images of every colour type, indexed, grey and colour, with or without alpha, and not
 * interlaced, which is what an image editor saves a master as. A master is half a billion pixels, so a row
 * is handed over as soon as it is inflated rather than the whole image being held decoded at once.
 */

export interface PngHeader {
  width: number;
  height: number;
  /** 0 grey, 2 colour, 3 indexed, 4 grey and alpha, 6 colour and alpha. */
  colourType: number;
  /** Bytes a pixel in a row. */
  channels: number;
  /** Three bytes a colour, for an indexed image; empty otherwise. */
  palette: Uint8Array;
}

const SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Reads a PNG, calling `onRow` with every row of pixels in turn, top to bottom. The row is reused. */
export async function readPng(
  path: string,
  onRow: (row: Uint8Array, y: number, header: PngHeader) => void,
): Promise<PngHeader> {
  const file = await readFile(path);
  if (!file.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error(`${path} is not a PNG`);
  }
  let header: PngHeader | null = null;
  let palette = new Uint8Array(0);
  const compressed: Buffer[] = [];
  for (let at = 8; at < file.length;) {
    const length = file.readUInt32BE(at);
    const name = file.toString('latin1', at + 4, at + 8);
    const data = file.subarray(at + 8, at + 8 + length);
    if (name === 'IHDR') {
      const [bitDepth, colourType, , , interlace] = data.subarray(8, 13);
      if (bitDepth !== 8 || CHANNELS[colourType!] === undefined || interlace !== 0) {
        throw new Error(
          `${path} is a PNG of a kind these tools do not read (bit depth ${bitDepth}, colour type ` +
            `${colourType}, interlace ${interlace}): save it as an 8-bit PNG, not interlaced`,
        );
      }
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        colourType: colourType!,
        channels: CHANNELS[colourType!]!,
        palette,
      };
    } else if (name === 'PLTE') {
      palette = Uint8Array.from(data);
    } else if (name === 'IDAT') {
      compressed.push(data);
    } else if (name === 'IEND') {
      break;
    }
    at += 12 + length;
  }
  if (header === null) {
    throw new Error(`${path} has no header`);
  }
  header.palette = palette;

  const { width, height, channels } = header;
  const stride = width * channels;
  let previous = new Uint8Array(stride);
  let current = new Uint8Array(stride);
  let filter = -1;
  let filled = 0;
  let y = 0;
  for await (const piece of Readable.from(compressed).pipe(createInflate()) as AsyncIterable<Buffer>) {
    for (let at = 0; at < piece.length && y < height;) {
      if (filter < 0) {
        filter = piece[at++]!;
        continue;
      }
      const take = Math.min(stride - filled, piece.length - at);
      current.set(piece.subarray(at, at + take), filled);
      filled += take;
      at += take;
      if (filled === stride) {
        unfilter(filter, current, previous, channels);
        onRow(current, y, header);
        [previous, current] = [current, previous];
        filter = -1;
        filled = 0;
        y += 1;
      }
    }
  }
  if (y !== height) {
    throw new Error(`${path} ends after ${y} of its ${height} rows`);
  }
  return header;
}

/** Undoes the filter a row was written with, in place, against the row above it. */
export function unfilter(filter: number, row: Uint8Array, above: Uint8Array, channels: number): void {
  for (let x = 0; x < row.length; x += 1) {
    const left = x >= channels ? row[x - channels]! : 0;
    const up = above[x]!;
    const corner = x >= channels ? above[x - channels]! : 0;
    let guess = 0;
    if (filter === 1) {
      guess = left;
    } else if (filter === 2) {
      guess = up;
    } else if (filter === 3) {
      guess = (left + up) >> 1;
    } else if (filter === 4) {
      const p = left + up - corner;
      const toLeft = Math.abs(p - left);
      const toUp = Math.abs(p - up);
      const toCorner = Math.abs(p - corner);
      guess = toLeft <= toUp && toLeft <= toCorner ? left : toUp <= toCorner ? up : corner;
    } else if (filter !== 0) {
      throw new Error(`a row is filtered with ${filter}, which is not a PNG filter`);
    }
    row[x] = (row[x]! + guess) & 0xff;
  }
}

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

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** One PNG chunk: its length, its four-letter name, its data, and a check over the two of them. */
export function chunk(name: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(name, 4, 'latin1');
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** An eight-bit indexed PNG: one byte a pixel, row by row from the top, and a colour for every byte used. */
export function encodeIndexedPng(
  width: number,
  height: number,
  pixels: Uint8Array,
  colours: readonly (readonly [number, number, number])[],
): Buffer {
  if (colours.length === 0 || colours.length > 256) {
    throw new Error(`an indexed image needs between 1 and 256 colours, not ${colours.length}`);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 3, 0, 0, 0], 8);
  const rows = Buffer.alloc(height * (width + 1));
  for (let y = 0; y < height; y += 1) {
    rows.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from(SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('PLTE', Uint8Array.from(colours.flat())),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}
