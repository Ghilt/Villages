import { BRIDGE_WAYS } from './bridgeModel.ts';
import type { BridgeWay } from './bridgeModel.ts';
import { STAND_BYTES } from './stands.ts';

/*
 * A road as it travels: cut into straight pieces, each one record of the eight bytes the stands are sent in, so the
 * gateway sends a piece through the fog by the same test it sends a stand by - its middle and its reach - and never
 * learns what a road is (decision record 0115). A piece's ends lie on the quarter of a world unit, so its middle lies
 * on the eighth the record carries and the half of it to one end fits a signed byte each way in eighths: the page
 * reads both ends back exactly, asking no engine's trigonometry, and two pieces that meet meet to the bit.
 *
 * | bytes | what |
 * |---|---|
 * | 0-1 | the middle, east of the tile's corner, in eighths of a unit, signed |
 * | 2-3 | the middle, south of it |
 * | 4 | the reach: half its length and half its width, in quarters, so the fog's test covers all of it |
 * | 5-6 | the half of it from the middle to one end, east and south, in eighths, signed |
 * | 7 | its kind: a track, a road or a trunk; or a bridge, and the way it runs |
 */

export const ROAD_KINDS = ['track', 'road', 'trunk'] as const;
export type RoadKind = (typeof ROAD_KINDS)[number];

/** The kind byte of a bridge: past every grade, the way it runs. */
const BRIDGE_FROM = 16;
/** The most a piece reaches from its middle to an end along either axis, in world units. */
export const LONGEST_HALF = 127 / 8;

/** A piece of road: its two ends, on the quarter of a unit, and what it is, as its kind byte says. */
export interface RoadPiece {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
  readonly kind: number;
}

/** What a piece's kind byte says it is. */
export type RoadPieceKind = { readonly road: RoadKind } | { readonly bridge: BridgeWay };

export function roadKindByte(kind: RoadKind): number {
  return ROAD_KINDS.indexOf(kind);
}

export function bridgeKindByte(way: BridgeWay): number {
  return BRIDGE_FROM + BRIDGE_WAYS.indexOf(way);
}

/** What a kind byte is; null for one no road is written with. */
export function readRoadKind(byte: number): RoadPieceKind | null {
  if (byte < ROAD_KINDS.length) return { road: ROAD_KINDS[byte]! };
  const way = byte < BRIDGE_FROM ? undefined : BRIDGE_WAYS[byte - BRIDGE_FROM];
  return way === undefined ? null : { bridge: way };
}

const quarter = (value: number) => Math.round(value * 4) / 4;

/**
 * A run of points on the quarter of a unit cut into pieces of `kind`, every one short enough for its record: a line too
 * long is cut into equal parts, each part's ends put on the quarter.
 */
export function piecesOf(points: readonly { x: number; y: number }[], kind: number): RoadPiece[] {
  const pieces: RoadPiece[] = [];
  for (let at = 0; at + 1 < points.length; at += 1) {
    const a = points[at]!;
    const b = points[at + 1]!;
    const parts = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / (2 * LONGEST_HALF - 0.5)),
    );
    let from = { x: quarter(a.x), y: quarter(a.y) };
    for (let part = 1; part <= parts; part += 1) {
      const to =
        part === parts
          ? { x: quarter(b.x), y: quarter(b.y) }
          : {
              x: quarter(a.x + ((b.x - a.x) * part) / parts),
              y: quarter(a.y + ((b.y - a.y) * part) / parts),
            };
      if (to.x !== from.x || to.y !== from.y)
        pieces.push({ ax: from.x, ay: from.y, bx: to.x, by: to.y, kind });
      from = to;
    }
  }
  return pieces;
}

const clampByte = (value: number) => Math.max(0, Math.min(255, value));

/**
 * A tile's pieces as the eight bytes each that go on the wire, their middles from the tile's corner; `widthOf` says how
 * wide a piece of each kind is drawn, in world units, which its reach takes in.
 */
export function encodeRoads(
  pieces: readonly RoadPiece[],
  tileX: number,
  tileY: number,
  tileUnits: number,
  widthOf: (kind: number) => number,
): Uint8Array {
  const bytes = new Uint8Array(pieces.length * STAND_BYTES);
  const view = new DataView(bytes.buffer);
  pieces.forEach((piece, at) => {
    const offset = at * STAND_BYTES;
    const halfX = (piece.bx - piece.ax) / 2;
    const halfY = (piece.by - piece.ay) / 2;
    const reach = Math.hypot(halfX, halfY) + widthOf(piece.kind) / 2;
    view.setInt16(offset, Math.round((piece.ax + halfX - tileX * tileUnits) * 8), true);
    view.setInt16(offset + 2, Math.round((piece.ay + halfY - tileY * tileUnits) * 8), true);
    bytes[offset + 4] = clampByte(Math.ceil(reach * 4));
    view.setInt8(offset + 5, Math.round(halfX * 8));
    view.setInt8(offset + 6, Math.round(halfY * 8));
    bytes[offset + 7] = piece.kind;
  });
  return bytes;
}

/** A tile's pieces read back, as parallel arrays: both ends of each in world units, and its kind byte. */
export interface RoadChunk {
  readonly count: number;
  readonly ax: Float32Array;
  readonly ay: Float32Array;
  readonly bx: Float32Array;
  readonly by: Float32Array;
  readonly kind: Uint8Array;
}

export function decodeRoads(bytes: Uint8Array, tileX: number, tileY: number, tileUnits: number): RoadChunk {
  const count = Math.floor(bytes.length / STAND_BYTES);
  const chunk = {
    count,
    ax: new Float32Array(count),
    ay: new Float32Array(count),
    bx: new Float32Array(count),
    by: new Float32Array(count),
    kind: new Uint8Array(count),
  };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let at = 0; at < count; at += 1) {
    const offset = at * STAND_BYTES;
    const mx = tileX * tileUnits + view.getInt16(offset, true) / 8;
    const my = tileY * tileUnits + view.getInt16(offset + 2, true) / 8;
    const hx = view.getInt8(offset + 5) / 8;
    const hy = view.getInt8(offset + 6) / 8;
    chunk.ax[at] = mx - hx;
    chunk.ay[at] = my - hy;
    chunk.bx[at] = mx + hx;
    chunk.by[at] = my + hy;
    chunk.kind[at] = view.getUint8(offset + 7);
  }
  return chunk;
}

/** How to read the roads layer, as `world:roads` writes it beside a master's world: no word of where any road is. */
export interface RoadsMapFile {
  readonly master: string;
  readonly layer: 'roads';
  readonly at: string;
  readonly world: { readonly side: number; readonly tileUnits: number };
  readonly kinds: readonly RoadKind[];
  readonly bridges: { readonly ways: readonly BridgeWay[] };
  /** How wide each grade is drawn, and a bridge, in world units. */
  readonly widths: {
    readonly track: number;
    readonly road: number;
    readonly trunk: number;
    readonly bridge: number;
  };
  readonly pieces: number;
  readonly chunks: number;
  readonly bytes: number;
}
