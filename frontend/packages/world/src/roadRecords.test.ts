import { describe, expect, it } from 'vitest';

import {
  LONGEST_HALF,
  bridgeKindByte,
  decodeRoads,
  encodeRoads,
  piecesOf,
  readRoadKind,
  roadKindByte,
} from './roadRecords.ts';

const TILE = 256;
const width = () => 1.5;

describe("a road's records", () => {
  it('reads both ends of every piece back exactly, the long ones cut short enough', () => {
    const run = [
      { x: 1000.25, y: 2049.5 },
      { x: 1003, y: 2051.75 },
      { x: 1041.5, y: 2030 },
      { x: 1040.75, y: 2096.25 },
    ];
    const pieces = piecesOf(run, roadKindByte('road'));
    expect(pieces.length).toBeGreaterThan(3);
    const tileX = Math.floor(1020 / TILE);
    const tileY = Math.floor(2050 / TILE);
    const chunk = decodeRoads(encodeRoads(pieces, tileX, tileY, TILE, width), tileX, tileY, TILE);
    expect(chunk.count).toBe(pieces.length);
    pieces.forEach((piece, at) => {
      expect(Math.abs(piece.bx - piece.ax) / 2).toBeLessThanOrEqual(LONGEST_HALF);
      expect(Math.abs(piece.by - piece.ay) / 2).toBeLessThanOrEqual(LONGEST_HALF);
      expect([chunk.ax[at], chunk.ay[at], chunk.bx[at], chunk.by[at]]).toEqual([
        piece.ax,
        piece.ay,
        piece.bx,
        piece.by,
      ]);
      expect(chunk.kind[at]).toBe(roadKindByte('road'));
    });
    // One piece's end is the next one's start, to the bit.
    for (let at = 1; at < chunk.count; at += 1) {
      expect([chunk.ax[at], chunk.ay[at]]).toEqual([chunk.bx[at - 1], chunk.by[at - 1]]);
    }
    expect([chunk.ax[0], chunk.ay[0]]).toEqual([1000.25, 2049.5]);
    expect([chunk.bx[chunk.count - 1], chunk.by[chunk.count - 1]]).toEqual([1040.75, 2096.25]);
  });

  it('reaches as far as half its length and half its width, for the fog', () => {
    const [piece] = piecesOf(
      [
        { x: 10, y: 10 },
        { x: 16, y: 18 },
      ],
      roadKindByte('trunk'),
    );
    const bytes = encodeRoads([piece!], 0, 0, TILE, width);
    expect(bytes[4]! / 4).toBeGreaterThanOrEqual(5 + 0.75);
    expect(bytes[4]! / 4).toBeLessThan(5 + 0.75 + 0.25);
  });

  it('says what each kind byte is', () => {
    expect(readRoadKind(roadKindByte('track'))).toEqual({ road: 'track' });
    expect(readRoadKind(roadKindByte('trunk'))).toEqual({ road: 'trunk' });
    expect(readRoadKind(bridgeKindByte('stone', 'uv'))).toEqual({ bridge: 'stone', axis: 'uv' });
    expect(readRoadKind(bridgeKindByte('timber', 'u'))).toEqual({ bridge: 'timber', axis: 'u' });
    expect(readRoadKind(200)).toBeNull();
    expect(readRoadKind(9)).toBeNull();
  });
});
