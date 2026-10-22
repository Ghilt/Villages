import { describe, expect, it } from 'vitest';

import { roadKindByte } from '@villages/world/build';

import { tileKey } from '../../net/stands';
import type { HeldPiece } from '../ground/roads';
import type { RoadsideItem } from './roadsideItems';
import {
  aboutTile,
  ownerOf,
  piecesByOwner,
  roadsideOfTile,
  signaturesOf,
  tilesChanged,
} from './roadsideTiles';

const widths = { track: 0.7, road: 1, trunk: 1.4, bridge: 1 };
const ground = { biome: () => 'temperate', clear: () => true };
const kind = roadKindByte('road');
const A = tileKey(70, 37);
const B = tileKey(71, 37);
// A road from tile 70 forty units into 71, its middle in 70; and a short road of 71's crossing it there.
const across: HeldPiece = {
  ax: 70 * 256 + 200,
  ay: 37 * 256 + 100,
  bx: 71 * 256 + 40,
  by: 37 * 256 + 100,
  kind,
};
const crossing: HeldPiece = {
  ax: 71 * 256 + 20,
  ay: 37 * 256 + 90,
  bx: 71 * 256 + 20,
  by: 37 * 256 + 110,
  kind,
};

/** Every state of the held pieces in turn, each laying out again only the tiles that changed and those about them. */
function laidOut(states: readonly (readonly HeldPiece[])[]): Map<number, RoadsideItem[]> {
  let signatures = new Map<number, number>();
  const laid = new Map<number, RoadsideItem[]>();
  for (const pieces of states) {
    const by = piecesByOwner(pieces);
    const now = signaturesOf(by);
    for (const tile of tilesChanged(signatures, now)) {
      const items = roadsideOfTile(tile, by, widths, 1, ground);
      if (items.length > 0) laid.set(tile, items);
      else laid.delete(tile);
    }
    signatures = now;
  }
  return laid;
}

describe('the roadside, a tile at a time', () => {
  it('lays each piece out by the tile its middle stands in', () => {
    expect(ownerOf(across)).toBe(A);
    expect(ownerOf(crossing)).toBe(B);
    expect(aboutTile(A)).toHaveLength(9);
    expect(aboutTile(A)).toContain(B);
  });

  it('keeps off the roads of the tiles about it, so a neighbour arriving changes it', () => {
    const alone = roadsideOfTile(A, piecesByOwner([across]), widths, 1, ground);
    const beside = roadsideOfTile(A, piecesByOwner([across, crossing]), widths, 1, ground);
    expect(beside.length).toBeLessThan(alone.length);
  });

  it('is the same whatever order its tiles came in, and when one goes again', () => {
    const whole = laidOut([[across, crossing]]);
    expect(laidOut([[across], [across, crossing]])).toEqual(whole);
    expect(laidOut([[crossing], [crossing, across]])).toEqual(whole);
    expect(laidOut([[across, crossing], [across]])).toEqual(laidOut([[across]]));
  });

  it('lays out again only the tiles whose pieces changed and those about them', () => {
    const was = signaturesOf(piecesByOwner([across]));
    expect(tilesChanged(was, was).size).toBe(0);
    const changed = tilesChanged(was, signaturesOf(piecesByOwner([across, crossing])));
    expect([...changed].sort()).toEqual(aboutTile(B).sort());
  });
});
