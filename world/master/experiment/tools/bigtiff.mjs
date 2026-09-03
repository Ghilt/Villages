/**
 * A read-only reader for one shape of BigTIFF: eight-bit, single sample, tiled, deflate compressed.
 *
 * That is exactly what the Copernicus land cover map is, and reading it is the only way to get a hundred
 * metre look at the world. The file is 362880 by 141120 pixels in 782736 tiles of 256 by 256, so it is
 * handed out one row of tiles at a time and never held whole.
 *
 * Hand written for the same reason the PNG encoder in packages/world is: the part of the format we need
 * is small, and a dependency here would mean a package.json in a folder that is meant to be an
 * experiment.
 */

import { openSync, readSync, closeSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const TAG = {
  ImageWidth: 256,
  ImageLength: 257,
  BitsPerSample: 258,
  Compression: 259,
  SamplesPerPixel: 277,
  TileWidth: 322,
  TileLength: 323,
  TileOffsets: 324,
  TileByteCounts: 325,
  PixelScale: 33550,
  TiePoint: 33922,
};

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 12: 8, 16: 8, 17: 8, 18: 8 };

function readAt(fd, offset, length) {
  const buffer = Buffer.alloc(length);
  readSync(fd, buffer, 0, length, offset);
  return buffer;
}

export class TiledBigTiff {
  constructor(path) {
    this.fd = openSync(path, 'r');
    const header = readAt(this.fd, 0, 16);
    if (header.toString('latin1', 0, 2) !== 'II' || header.readUInt16LE(2) !== 43) {
      throw new Error(`${path} is not a little-endian BigTIFF`);
    }
    const ifdOffset = Number(header.readBigUInt64LE(8));

    const count = Number(readAt(this.fd, ifdOffset, 8).readBigUInt64LE(0));
    const entries = readAt(this.fd, ifdOffset + 8, count * 20);
    /** @type {Map<number, { type: number, count: number, inline: Buffer, offset: number }>} */
    const tags = new Map();
    for (let i = 0; i < count; i += 1) {
      const at = i * 20;
      const tag = entries.readUInt16LE(at);
      const type = entries.readUInt16LE(at + 2);
      const n = Number(entries.readBigUInt64LE(at + 4));
      const inline = entries.subarray(at + 12, at + 20);
      const fits = (TYPE_SIZE[type] ?? 1) * n <= 8;
      tags.set(tag, { type, count: n, inline, offset: fits ? -1 : Number(inline.readBigUInt64LE(0)) });
    }

    const scalar = (tag) => {
      const entry = tags.get(tag);
      if (entry === undefined) {
        throw new Error(`the file has no tag ${tag}`);
      }
      return entry.type === 3 ? entry.inline.readUInt16LE(0) : entry.inline.readUInt32LE(0);
    };

    const array = (tag) => {
      const entry = tags.get(tag);
      const size = TYPE_SIZE[entry.type] ?? 1;
      const bytes =
        entry.offset === -1
          ? entry.inline.subarray(0, size * entry.count)
          : readAt(this.fd, entry.offset, size * entry.count);
      const out = new Float64Array(entry.count);
      for (let i = 0; i < entry.count; i += 1) {
        out[i] = entry.type === 16 ? Number(bytes.readBigUInt64LE(i * size)) : bytes.readUInt32LE(i * size);
      }
      return out;
    };

    this.width = scalar(TAG.ImageWidth);
    this.height = scalar(TAG.ImageLength);
    this.tileWidth = scalar(TAG.TileWidth);
    this.tileHeight = scalar(TAG.TileLength);
    this.compression = scalar(TAG.Compression);
    if (scalar(TAG.BitsPerSample) !== 8 || scalar(TAG.SamplesPerPixel) !== 1) {
      throw new Error('only eight-bit single-sample tiles are supported');
    }
    if (this.compression !== 8 && this.compression !== 32946 && this.compression !== 1) {
      throw new Error(`compression ${this.compression} is not supported`);
    }
    this.tileOffsets = array(TAG.TileOffsets);
    this.tileByteCounts = array(TAG.TileByteCounts);
    this.tileColumns = Math.ceil(this.width / this.tileWidth);
    this.tileRows = Math.ceil(this.height / this.tileHeight);

    // Where the grid sits on the globe. Both of these tags hold doubles, which `array` does not decode.
    const doubles = (tag, n) => {
      const entry = tags.get(tag);
      const bytes = readAt(this.fd, entry.offset, 8 * n);
      return Array.from({ length: n }, (_, i) => bytes.readDoubleLE(i * 8));
    };
    const [scaleX, scaleY] = doubles(TAG.PixelScale, 2);
    // The tie point maps a raster position to a world one; entries 3 and 4 are the world longitude and
    // latitude of the north-west corner of pixel zero.
    const tiePoint = doubles(TAG.TiePoint, 6);
    this.degreesPerPixel = scaleX;
    this.degreesPerPixelY = scaleY;
    this.westEdge = tiePoint[3];
    this.northEdge = tiePoint[4];

    /** One row of tiles, decoded. Reused, because it is ninety megabytes. */
    this.rowStride = this.tileColumns * this.tileWidth;
    this.rowBuffer = new Uint8Array(this.rowStride * this.tileHeight);
    this.rowBufferIndex = -1;
    this.tileBuffer = Buffer.alloc(1 << 20);
  }

  /**
   * Decodes tile row `index` into the shared buffer and returns it, along with the stride between rows.
   * The buffer is `tileColumns * tileWidth` wide, so its right-hand edge is tile padding, not world.
   */
  tileRow(index) {
    if (index === this.rowBufferIndex) {
      return this.rowBuffer;
    }
    this.rowBuffer.fill(0);
    for (let column = 0; column < this.tileColumns; column += 1) {
      const tile = index * this.tileColumns + column;
      const length = this.tileByteCounts[tile];
      if (length === 0) {
        continue;
      }
      if (length > this.tileBuffer.length) {
        this.tileBuffer = Buffer.alloc(length * 2);
      }
      readSync(this.fd, this.tileBuffer, 0, length, this.tileOffsets[tile]);
      const raw =
        this.compression === 1
          ? this.tileBuffer.subarray(0, length)
          : inflateSync(this.tileBuffer.subarray(0, length));
      for (let row = 0; row < this.tileHeight; row += 1) {
        this.rowBuffer.set(
          raw.subarray(row * this.tileWidth, (row + 1) * this.tileWidth),
          row * this.rowStride + column * this.tileWidth,
        );
      }
    }
    this.rowBufferIndex = index;
    return this.rowBuffer;
  }

  /** The latitude of the centre of source row `y`. */
  latitudeOfRow(y) {
    return this.northEdge - (y + 0.5) * this.degreesPerPixelY;
  }

  /** The longitude of the centre of source column `x`. */
  longitudeOfColumn(x) {
    return this.westEdge + (x + 0.5) * this.degreesPerPixel;
  }

  close() {
    closeSync(this.fd);
  }
}
