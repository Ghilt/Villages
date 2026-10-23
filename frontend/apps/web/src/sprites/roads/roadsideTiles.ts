import { STAND_TILES } from '@villages/protocol';
import { GROUND_LATTICE, frameOf, readRoadKind, worldXOf, worldYOf } from '@villages/world';
import type { RoadsMapFile } from '@villages/world';

import { TILE } from '../../geometry/world';
import { tileKey } from '../../net/stands';
import type { HeldPiece } from '../ground/roads';
import { WORKED } from '../ground/worked';
import type { Worked } from '../ground/worked';
import { diamondOf } from '../ground/workedGround';
import { roadsideAlong } from './roadsideItems';
import type { RoadsideGround, RoadsideItem } from './roadsideItems';

/*
 * The roadside laid out a tile of the stands at a time (decision record 0119). A piece of road belongs to the tile its
 * middle stands in, so every piece is laid out by exactly one tile; a tile's roadside keeps off the bands of the
 * pieces of the tiles about it too, so it is laid out again whenever their pieces change as well as its own, which is
 * what makes the roadside the same whatever order its tiles came in. Pure, so that rule is held by a test.
 */

const FRAME = frameOf(GROUND_LATTICE);

/** The tile of the stands a piece belongs to: the one its middle stands in, by `tileKey`. */
export function ownerOf(piece: HeldPiece): number {
  return tileKey(Math.floor((piece.ax + piece.bx) / 2 / TILE), Math.floor((piece.ay + piece.by) / 2 / TILE));
}

/** The pieces held, by the tile each belongs to. */
export function piecesByOwner(pieces: readonly HeldPiece[]): Map<number, HeldPiece[]> {
  const by = new Map<number, HeldPiece[]>();
  for (const piece of pieces) {
    const owner = ownerOf(piece);
    const held = by.get(owner);
    if (held === undefined) by.set(owner, [piece]);
    else held.push(piece);
  }
  return by;
}

/** A number for each tile's pieces that changes when any of them does: what a tile is laid out again by. */
export function signaturesOf(by: ReadonlyMap<number, readonly HeldPiece[]>): Map<number, number> {
  const signatures = new Map<number, number>();
  for (const [tile, pieces] of by) {
    let sum = pieces.length;
    for (const piece of pieces) {
      sum =
        (sum * 31 + piece.ax * 3 + piece.ay * 5 + piece.bx * 7 + piece.by * 11 + piece.kind) % 1_000_000_007;
    }
    signatures.set(tile, sum);
  }
  return signatures;
}

/** A tile and the eight about it, by `tileKey`, wrapped round the world as the tiles are. */
export function aboutTile(tile: number): number[] {
  const x = tile % STAND_TILES;
  const y = Math.floor(tile / STAND_TILES);
  const about: number[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (y + dy >= 0 && y + dy < STAND_TILES) about.push(tileKey(x + dx, y + dy));
    }
  }
  return about;
}

/** The tiles whose pieces came, went or changed between two signatures, and the tiles about each. */
export function tilesChanged(
  was: ReadonlyMap<number, number>,
  now: ReadonlyMap<number, number>,
): Set<number> {
  const changed = new Set<number>();
  const mark = (tile: number) => {
    for (const one of aboutTile(tile)) changed.add(one);
  };
  for (const [tile, signature] of now) if (was.get(tile) !== signature) mark(tile);
  for (const tile of was.keys()) if (!now.has(tile)) mark(tile);
  return changed;
}

/** The grid the road's bands are found by, for keeping the roadside off them, in world units. */
const CELL = 4;

/** Whether a point is on any piece's band, by a grid of the pieces. */
export function bandsOf(
  pieces: readonly HeldPiece[],
  widths: RoadsMapFile['widths'],
  scale: number,
): (x: number, y: number) => boolean {
  const grid = new Map<number, { piece: HeldPiece; half: number }[]>();
  const key = (cx: number, cy: number) => cy * 65536 + cx;
  for (const piece of pieces) {
    const kind = readRoadKind(piece.kind);
    if (kind === null) continue;
    const half = (('bridge' in kind ? widths.bridge : widths[kind.road]) / 2) * scale + 0.15;
    const [x0, x1] = [Math.min(piece.ax, piece.bx) - half, Math.max(piece.ax, piece.bx) + half];
    const [y0, y1] = [Math.min(piece.ay, piece.by) - half, Math.max(piece.ay, piece.by) + half];
    for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy += 1) {
      for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx += 1) {
        const held = grid.get(key(cx, cy));
        if (held === undefined) grid.set(key(cx, cy), [{ piece, half }]);
        else held.push({ piece, half });
      }
    }
  }
  return (x, y) =>
    (grid.get(key(Math.floor(x / CELL), Math.floor(y / CELL))) ?? []).some(({ piece, half }) => {
      const dx = piece.bx - piece.ax;
      const dy = piece.by - piece.ay;
      const long = dx * dx + dy * dy;
      const t = long === 0 ? 0 : Math.max(0, Math.min(1, ((x - piece.ax) * dx + (y - piece.ay) * dy) / long));
      return Math.hypot(x - (piece.ax + t * dx), y - (piece.ay + t * dy)) < half;
    });
}

/**
 * One tile's roadside: along the pieces it owns, kept off the bands of every piece of it and the tiles about it, the
 * nearer drawn later.
 */
export function roadsideOfTile(
  tile: number,
  by: ReadonlyMap<number, readonly HeldPiece[]>,
  widths: RoadsMapFile['widths'],
  scale: number,
  ground: Omit<RoadsideGround, 'onRoad'>,
): RoadsideItem[] {
  const own = by.get(tile) ?? [];
  if (own.length === 0) return [];
  const near = aboutTile(tile).flatMap((one) => by.get(one) ?? []);
  const items = roadsideAlong(own, widths, scale, { ...ground, onRoad: bandsOf(near, widths, scale) });
  return items.sort((one, other) => one.y - other.y || one.x - other.x);
}

/**
 * The tiles a change of the worked ground lays out again: every one about a diamond that became or stopped being the
 * wayside, the only ground the roadside stands on, by where the middle of the diamond lies.
 */
export function tilesOfWayside(
  was: ReadonlyMap<number, Worked>,
  now: ReadonlyMap<number, Worked>,
): Set<number> {
  const tiles = new Set<number>();
  const mark = (key: number) => {
    const { u, v } = diamondOf(key);
    const x = worldXOf(FRAME, u + 0.5, v + 0.5);
    const y = worldYOf(FRAME, u + 0.5, v + 0.5);
    for (const one of aboutTile(tileKey(Math.floor(x / TILE), Math.floor(y / TILE)))) tiles.add(one);
  };
  for (const [key, kind] of now)
    if ((kind === WORKED.wayside) !== (was.get(key) === WORKED.wayside)) mark(key);
  for (const [key, kind] of was) if (kind === WORKED.wayside && !now.has(key)) mark(key);
  return tiles;
}
