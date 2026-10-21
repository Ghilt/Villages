import { SETTLEMENT_TYPES } from './settlements.ts';
import type { SettlementType } from './settlements.ts';
import { STAND_BYTES } from './stands.ts';

/*
 * The settlements as the page is sent them: one record of the eight bytes the stands are sent in a settlement, written
 * into every tile its circle touches, so the gateway sends it through the fog by the same test it sends a stand by - its
 * middle and its reach, here its radius - and never learns what a settlement is (decision record 0117). Its name and
 * its site's id, which seeds its layout, are in the master's `sprites/settlements/map.json`, by the number the record
 * carries, which says nothing of where any settlement is.
 *
 * | bytes | what |
 * |---|---|
 * | 0-1 | its middle, east of the tile's corner, in eighths of a unit, signed: a corner of the ground's lattice |
 * | 2-3 | its middle, south of it |
 * | 4 | its radius in quarters of a unit: every structure within it is part of it |
 * | 5 | its type and level: four times its type's place in `SETTLEMENT_TYPES`, and its level |
 * | 6-7 | its number in the map's list of names, unsigned |
 */

/** A settlement as its record carries it. */
export interface SettlementRecord {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly type: SettlementType;
  readonly level: number;
  readonly index: number;
}

export function encodeSettlements(
  records: readonly SettlementRecord[],
  tileX: number,
  tileY: number,
  tileUnits: number,
): Uint8Array {
  const bytes = new Uint8Array(records.length * STAND_BYTES);
  const view = new DataView(bytes.buffer);
  records.forEach((record, at) => {
    const offset = at * STAND_BYTES;
    view.setInt16(offset, Math.round((record.x - tileX * tileUnits) * 8), true);
    view.setInt16(offset + 2, Math.round((record.y - tileY * tileUnits) * 8), true);
    bytes[offset + 4] = Math.min(255, Math.ceil(record.radius * 4));
    bytes[offset + 5] = SETTLEMENT_TYPES.indexOf(record.type) * 4 + record.level;
    view.setUint16(offset + 6, record.index, true);
  });
  return bytes;
}

export function decodeSettlements(
  bytes: Uint8Array,
  tileX: number,
  tileY: number,
  tileUnits: number,
): SettlementRecord[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const records: SettlementRecord[] = [];
  for (let offset = 0; offset + STAND_BYTES <= bytes.length; offset += STAND_BYTES) {
    const how = bytes[offset + 5]!;
    const type = SETTLEMENT_TYPES[Math.floor(how / 4)];
    if (type === undefined) continue;
    records.push({
      x: tileX * tileUnits + view.getInt16(offset, true) / 8,
      y: tileY * tileUnits + view.getInt16(offset + 2, true) / 8,
      radius: bytes[offset + 4]! / 4,
      type,
      level: how % 4,
      index: view.getUint16(offset + 6, true),
    });
  }
  return records;
}

/** How to read the settlements layer, as `world:settlements` writes it beside a master's world. */
export interface SettlementsMapFile {
  readonly master: string;
  readonly layer: 'settlements';
  readonly at: string;
  readonly world: { readonly side: number; readonly tileUnits: number };
  /** Each settlement's site's id, which seeds its layout, and its name, by the number its record carries. */
  readonly settlements: readonly { readonly id: string; readonly name: string }[];
}
