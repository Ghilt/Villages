/**
 * Reads a master image back and cuts a region out of it, magnified, for looking at.
 *
 * A master pixel is 2.4 km, so a province is a hundred pixels across and a 1:1 crop of Blekinge is a
 * postage stamp. Magnification is nearest neighbour, which is the only kind allowed here: averaging two
 * terrain classes would invent a third.
 *
 * This is also the first half of what the importer will need — decoding the indexed PNG back into one
 * class per pixel — so it is worth having even before there is an importer.
 *
 *   node crop.mjs <master.png> <out.png> <west> <south> <east> <north> [zoom]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

import { encodeIndexedPng } from '../../../../frontend/packages/world/src/png.ts';

/** An eight-bit indexed PNG, back to one class per pixel and the colour table it was written with. */
export function decodeIndexedPng(bytes) {
  let at = 8;
  let width = 0;
  let height = 0;
  let colours = [];
  const parts = [];

  while (at + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(at);
    const name = bytes.toString('latin1', at + 4, at + 8);
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (name === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 3) {
        throw new Error(`expected an eight-bit indexed PNG, found depth ${data[8]} colour type ${data[9]}`);
      }
      if (data[12] !== 0) {
        throw new Error('interlaced PNGs are not supported');
      }
    } else if (name === 'PLTE') {
      colours = [];
      for (let i = 0; i + 2 < length; i += 3) {
        colours.push([data[i], data[i + 1], data[i + 2]]);
      }
    } else if (name === 'IDAT') {
      parts.push(data);
    } else if (name === 'IEND') {
      break;
    }
    at += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(parts));
  const cells = new Uint8Array(width * height);
  let above = new Uint8Array(width);

  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (width + 1)];
    const line = raw.subarray(row * (width + 1) + 1, (row + 1) * (width + 1));
    const out = cells.subarray(row * width, (row + 1) * width);
    for (let x = 0; x < width; x += 1) {
      const left = x > 0 ? out[x - 1] : 0;
      const up = above[x];
      const upLeft = x > 0 ? above[x - 1] : 0;
      let value = line[x];
      if (filter === 1) {
        value += left;
      } else if (filter === 2) {
        value += up;
      } else if (filter === 3) {
        value += (left + up) >> 1;
      } else if (filter === 4) {
        // Paeth: whichever of the three neighbours the gradient points closest to.
        const guess = left + up - upLeft;
        const dl = Math.abs(guess - left);
        const du = Math.abs(guess - up);
        const dul = Math.abs(guess - upLeft);
        value += dl <= du && dl <= dul ? left : du <= dul ? up : upLeft;
      }
      out[x] = value & 0xff;
    }
    above = out;
  }

  return { width, height, cells, colours };
}

if (process.argv.length < 8) {
  console.error('usage: node crop.mjs <master.png> <out.png> <west> <south> <east> <north> [zoom]');
  process.exit(1);
}

const [, , source, target, west, south, east, north, zoomArgument] = process.argv;
const master = decodeIndexedPng(readFileSync(source));
const zoom = Math.max(1, Math.floor(Number(zoomArgument ?? 1)));

const x0 = Math.max(0, Math.floor(((Number(west) + 180) / 360) * master.width));
const x1 = Math.min(master.width, Math.ceil(((Number(east) + 180) / 360) * master.width));
const y0 = Math.max(0, Math.floor(((90 - Number(north)) / 180) * master.height));
const y1 = Math.min(master.height, Math.ceil(((90 - Number(south)) / 180) * master.height));
if (x1 <= x0 || y1 <= y0) {
  throw new Error('that window is empty');
}

const width = (x1 - x0) * zoom;
const height = (y1 - y0) * zoom;
const cells = new Uint8Array(width * height);
for (let row = 0; row < height; row += 1) {
  const sourceRow = (y0 + Math.floor(row / zoom)) * master.width;
  for (let column = 0; column < width; column += 1) {
    cells[row * width + column] = master.cells[sourceRow + x0 + Math.floor(column / zoom)];
  }
}

writeFileSync(
  target,
  encodeIndexedPng({ width, height, cells }, master.colours, (data) =>
    new Uint8Array(deflateSync(data, { level: 9 })),
  ),
);
console.log(`${target}: ${width} by ${height}, from ${x1 - x0} by ${y1 - y0} master pixels at zoom ${zoom}`);
