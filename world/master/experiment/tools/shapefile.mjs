/**
 * A read-only shapefile and dBASE reader, just enough for this experiment.
 *
 * Written by hand rather than borrowed because this folder has no package.json and no node_modules: it
 * is meant to run with bare `node` against files already on disk. The format is old and simple, and the
 * three sources here only use three of its shape types.
 *
 * Records come back one at a time. HydroRIVERS is 8.5 million reaches and HydroLAKES 1.4 million lakes,
 * so nothing here may hold a whole file's geometry at once.
 */

import { openSync, readSync, closeSync, statSync } from 'node:fs';

/** A field of the attribute table, as the dBASE header describes it. */
function readDbfHeader(fd) {
  const head = Buffer.alloc(32);
  readSync(fd, head, 0, 32, 0);
  const recordCount = head.readUInt32LE(4);
  const headerLength = head.readUInt16LE(8);
  const recordLength = head.readUInt16LE(10);

  const descriptors = Buffer.alloc(headerLength - 32);
  readSync(fd, descriptors, 0, descriptors.length, 32);

  const fields = [];
  let offset = 1; // Byte zero of every record is the deletion flag.
  for (let at = 0; at + 32 <= descriptors.length && descriptors[at] !== 0x0d; at += 32) {
    const length = descriptors[at + 16];
    fields.push({
      name: descriptors.toString('latin1', at, at + 11).replace(/\0.*$/, ''),
      type: String.fromCharCode(descriptors[at + 11]),
      offset,
      length,
    });
    offset += length;
  }
  return { recordCount, headerLength, recordLength, fields };
}

/**
 * The attribute table of a shapefile, read a record at a time.
 *
 * Only the fields asked for are decoded. HydroLAKES' table is 359 MB and 21 fields wide; decoding all of
 * it for the two numbers this build wants would dominate the run.
 */
export class Dbf {
  constructor(path, wanted) {
    this.fd = openSync(path, 'r');
    const header = readDbfHeader(this.fd);
    this.recordCount = header.recordCount;
    this.headerLength = header.headerLength;
    this.recordLength = header.recordLength;
    this.fields = header.fields.filter((field) => wanted === undefined || wanted.includes(field.name));
    this.missing = (wanted ?? []).filter((name) => !header.fields.some((f) => f.name === name));
    this.blockRecords = Math.max(1, Math.floor((1 << 20) / this.recordLength));
    this.block = Buffer.alloc(this.blockRecords * this.recordLength);
    this.blockFrom = 0;
    this.blockCount = 0;
  }

  /**
   * The attributes of record `index`, zero based, as a plain object.
   *
   * Records are read in blocks rather than one at a time: HydroRIVERS has 8.5 million of them, and a
   * separate read for each turns a minute of work into ten.
   */
  at(index) {
    if (index < 0 || index >= this.recordCount) {
      return {};
    }
    if (index < this.blockFrom || index >= this.blockFrom + this.blockCount) {
      const from = index - (index % this.blockRecords);
      const wanted = Math.min(this.blockRecords, this.recordCount - from) * this.recordLength;
      const got = readSync(this.fd, this.block, 0, wanted, this.headerLength + from * this.recordLength);
      this.blockFrom = from;
      this.blockCount = Math.floor(got / this.recordLength);
    }
    const base = (index - this.blockFrom) * this.recordLength;
    const out = {};
    for (const field of this.fields) {
      const raw = this.block
        .toString('latin1', base + field.offset, base + field.offset + field.length)
        .trim();
      out[field.name] = field.type === 'N' || field.type === 'F' ? Number(raw) : raw;
    }
    return out;
  }

  close() {
    closeSync(this.fd);
  }
}

const XY_TYPES = new Set([
  1, 3, 5, 8, // point, polyline, polygon, multipoint
  11, 13, 15, 18, // the same with a Z ordinate
  21, 23, 25, 28, // the same with a measure
]);

/**
 * Every record of a `.shp`, in file order, as `{ index, type, rings }` or `{ index, type, point }`.
 *
 * Z and M ordinates are ignored: they sit after the XY array, so reading only the XY part of a record is
 * the same code for all nine shape types this handles.
 */
export function* readShapes(path, { chunkSize = 1 << 22 } = {}) {
  const fd = openSync(path, 'r');
  try {
    const size = statSync(path).size;
    // A single record can be larger than a chunk: Antarctica's ring is megabytes on its own.
    let buffer = Buffer.alloc(chunkSize);
    let bufferStart = 0;
    let bufferEnd = 0;
    let at = 100; // The 100-byte file header.
    let index = 0;

    const ensure = (from, length) => {
      if (from >= bufferStart && from + length <= bufferEnd) {
        return;
      }
      if (length > buffer.length) {
        buffer = Buffer.alloc(length + chunkSize);
      }
      const want = Math.min(buffer.length, size - from);
      bufferEnd = from + readSync(fd, buffer, 0, want, from);
      bufferStart = from;
    };

    while (at + 8 <= size) {
      ensure(at, 8);
      const contentLength = buffer.readInt32BE(at - bufferStart + 4) * 2;
      const body = at + 8;
      if (contentLength <= 0) {
        at = body + Math.max(0, contentLength);
        index += 1;
        continue;
      }
      ensure(body, contentLength);
      const base = body - bufferStart;
      const type = buffer.readInt32LE(base);

      if (type === 1 || type === 11 || type === 21) {
        yield { index, type, point: [buffer.readDoubleLE(base + 4), buffer.readDoubleLE(base + 12)] };
      } else if (XY_TYPES.has(type)) {
        const partCount = buffer.readInt32LE(base + 36);
        const pointCount = buffer.readInt32LE(base + 40);
        const partsAt = base + 44;
        const pointsAt = partsAt + partCount * 4;
        const rings = [];
        for (let part = 0; part < partCount; part += 1) {
          const from = buffer.readInt32LE(partsAt + part * 4);
          const to = part + 1 < partCount ? buffer.readInt32LE(partsAt + (part + 1) * 4) : pointCount;
          const ring = new Array(to - from);
          for (let point = from; point < to; point += 1) {
            const o = pointsAt + point * 16;
            ring[point - from] = [buffer.readDoubleLE(o), buffer.readDoubleLE(o + 8)];
          }
          rings.push(ring);
        }
        yield { index, type, rings };
      }

      at = body + contentLength;
      index += 1;
    }
  } finally {
    closeSync(fd);
  }
}

/** Rings of a GeoJSON feature, in the same shape `readShapes` hands back, so layers can share code. */
export function ringsOfGeoJson(geometry) {
  if (geometry === null || geometry === undefined) {
    return [];
  }
  switch (geometry.type) {
    case 'Polygon':
      return geometry.coordinates;
    case 'MultiPolygon':
      return geometry.coordinates.flat();
    case 'LineString':
      return [geometry.coordinates];
    case 'MultiLineString':
      return geometry.coordinates;
    default:
      return [];
  }
}
