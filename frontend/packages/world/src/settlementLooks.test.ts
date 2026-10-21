import { describe, expect, it } from 'vitest';

import { screen } from './blockOut.ts';
import { BRIDGE_WAYS } from './bridgeModel.ts';
import {
  JETTY_AXES,
  SETTLEMENT_PIECES,
  bridgeFile,
  bridgeKey,
  jettyFile,
  jettyKey,
  keyOfBridgeFile,
  keyOfSettlementFile,
  settlementPieceFaces,
  settlementPieceFile,
  settlementPieceKey,
} from './settlementLooks.ts';
import { footOfBridge } from './structureArt.ts';
import { CULTURES } from './structures.ts';

describe("the placeholders of a settlement's pieces", () => {
  it('stand every piece in every culture on the front corner of its base, the lowest thing drawn', () => {
    for (const piece of SETTLEMENT_PIECES.filter((one) => one !== 'boat' && one !== 'netRack')) {
      for (const culture of CULTURES) {
        const faces = settlementPieceFaces(piece, culture);
        const lowest = Math.max(...faces.flatMap((face) => face.at.map((point) => screen(point)[1])));
        const corner = screen([0, 0, 0])[1];
        expect(lowest - corner, `${piece} in ${culture}`).toBeLessThan(0.35);
      }
    }
  });

  it('are named by their files and their files by their keys', () => {
    for (const piece of SETTLEMENT_PIECES) {
      for (const culture of CULTURES) {
        expect(keyOfSettlementFile(settlementPieceFile(piece, culture))).toBe(
          settlementPieceKey(piece, culture),
        );
      }
    }
    for (const axis of JETTY_AXES) expect(keyOfSettlementFile(jettyFile(axis))).toBe(jettyKey(axis));
    for (const way of BRIDGE_WAYS) expect(keyOfBridgeFile(bridgeFile(way))).toBe(bridgeKey(way));
    expect(keyOfSettlementFile('castle-european.png')).toBeNull();
    expect(keyOfSettlementFile('placeholders.json')).toBeNull();
    expect(keyOfBridgeFile('bridge-uu.png')).toBeNull();
    expect(keyOfBridgeFile('stone-u.png')).toBeNull();
  });
});

describe('the jetties', () => {
  it('stand on the middle of the deck, halfway between where its ends meet the ground', () => {
    // A deck from the bottom left to the top right of a picture eight wide and four tall, a pixel thick.
    const width = 8;
    const height = 4;
    const data = new Uint8Array(width * height * 4);
    for (let x = 0; x < width; x += 1) {
      const y = height - 1 - Math.floor((x * height) / width);
      data[(y * width + x) * 4 + 3] = 255;
    }
    const foot = footOfBridge({ width, height, data });
    expect(foot.x).toBeCloseTo(0.5, 5);
    expect(foot.y).toBeCloseTo((4 + 1) / 2 / 4, 5);
  });
});
