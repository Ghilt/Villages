import { GROUND_LATTICE, alongU, alongV, frameOf, readRoadKind, worldXOf, worldYOf } from '@villages/world';
import type { RoadChunk, RoadsMapFile } from '@villages/world';

import { heldStandsOf, standsVersion } from '../../net/stands';
import type { GroundOf } from './paths';
import { WORKED } from './worked';
import type { Worked } from './worked';
import { diamondKey } from './workedGround';

/*
 * The ground the roads keep clear: every piece of road the game server sent, the `roads` layer of the stands, worn as
 * the wayside along its line, as wide as its grade is drawn and its roadside either side, a diamond of the ground's
 * lattice at a time. Nothing of it is drawn - the road is, as a shape over it (`sprites/roads/`) - but no tree grows
 * on it, as on any worked ground (`growing.ts`). Only on land - a bridge's piece keeps nothing clear, and the river
 * under it shows - and only where the house has revealed the ground. See docs/plans/settlements-and-roads.md, docs/plans/houses-bridges-and-road-render.md and
 * decision record 0115.
 */

const FRAME = frameOf(GROUND_LATTICE);
/**
 * The least half-width a road is worn at, in diamonds: past half a diamond's diagonal, so every diamond its line crosses is
 * worn whatever way it runs; narrower, a line across the lattice breaks into dashes.
 */
const LEAST_HALF = 0.75;
/** How much further either side of a road's band the ground is kept clear, for its roadside, in world units. */
export const ROADSIDE = 0.7;

/** A piece of road as the page holds it: its two ends, in world units, and its kind byte. */
export interface HeldPiece {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
  readonly kind: number;
}

/** Every piece in the tiles held, each once though a piece is sent in every tile its reach touches. */
export function piecesHeld(chunks: Iterable<RoadChunk>): HeldPiece[] {
  const seen = new Set<string>();
  const pieces: HeldPiece[] = [];
  for (const chunk of chunks) {
    for (let at = 0; at < chunk.count; at += 1) {
      const piece = {
        ax: chunk.ax[at]!,
        ay: chunk.ay[at]!,
        bx: chunk.bx[at]!,
        by: chunk.by[at]!,
        kind: chunk.kind[at]!,
      };
      const key = `${piece.ax} ${piece.ay} ${piece.bx} ${piece.by} ${piece.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pieces.push(piece);
    }
  }
  return pieces;
}

let held: { version: number; pieces: HeldPiece[] } | null = null;

/**
 * Every piece of road the page holds, worked out once a version of the `roads` layer and shared by everything that
 * reads them: the roads drawn, their roadside, the bridges and the worn ground. Each worked it out again at every
 * step of the camera, four times over (decision record 0119).
 */
export function roadsHeld(): readonly HeldPiece[] {
  const version = standsVersion('roads');
  if (held?.version !== version) {
    held = {
      version,
      pieces: piecesHeld(
        [...heldStandsOf('roads')].flatMap((tile) => (tile.roads === undefined ? [] : [tile.roads])),
      ),
    };
  }
  return held.pieces;
}

/** How far a point lies from a straight piece, both in world units. */
function awayFrom(x: number, y: number, piece: HeldPiece): number {
  const dx = piece.bx - piece.ax;
  const dy = piece.by - piece.ay;
  const long = dx * dx + dy * dy;
  const t = long === 0 ? 0 : Math.max(0, Math.min(1, ((x - piece.ax) * dx + (y - piece.ay) * dy) / long));
  return Math.hypot(x - (piece.ax + t * dx), y - (piece.ay + t * dy));
}

/**
 * The diamonds the pieces keep clear, by `diamondKey`, as the wayside: each diamond of land whose middle lies within
 * half its grade's width, times `scale`, and its roadside of a piece, and that `revealed` says the house has seen - everywhere with the fog off,
 * which is null. A bridge's piece wears nothing; a diamond whose ground is not known yet is left until it is.
 */
export function wearRoads(
  pieces: readonly HeldPiece[],
  widths: RoadsMapFile['widths'],
  scale: number,
  ground: GroundOf,
  revealed: ((x: number, y: number) => boolean) | null,
): Map<number, Worked> {
  const worn = new Map<number, Worked>();
  for (const piece of pieces) {
    const kind = readRoadKind(piece.kind);
    if (kind === null || 'bridge' in kind) continue;
    const half = Math.max(LEAST_HALF, (widths[kind.road] / 2) * scale + ROADSIDE);
    const us = [alongU(FRAME, piece.ax, piece.ay), alongU(FRAME, piece.bx, piece.by)];
    const vs = [alongV(FRAME, piece.ax, piece.ay), alongV(FRAME, piece.bx, piece.by)];
    for (let u = Math.floor(Math.min(...us) - half); u <= Math.floor(Math.max(...us) + half); u += 1) {
      for (let v = Math.floor(Math.min(...vs) - half); v <= Math.floor(Math.max(...vs) + half); v += 1) {
        const key = diamondKey(u, v);
        if (worn.has(key)) continue;
        const x = worldXOf(FRAME, u + 0.5, v + 0.5);
        const y = worldYOf(FRAME, u + 0.5, v + 0.5);
        if (awayFrom(x, y, piece) > half) continue;
        if (ground(u, v) !== 'land') continue;
        if (revealed !== null && !revealed(x, y)) continue;
        worn.set(key, WORKED.wayside);
      }
    }
  }
  return worn;
}

/**
 * `wearRoads` that hands back the very map it handed back last while the pieces, the widths, the width lever, the
 * ground and the sight are the ones they were, and the ground known (`known`) has grown only since a wear that left no
 * diamond waiting on ground not known yet: then nothing more of the ground can change it. A tile of ground arriving
 * wore every road again (decision record 0119).
 */
export function rememberingWornRoads(): (
  pieces: readonly HeldPiece[],
  widths: RoadsMapFile['widths'],
  scale: number,
  ground: GroundOf,
  revealed: ((x: number, y: number) => boolean) | null,
  known: number,
) => Map<number, Worked> {
  let last: {
    pieces: readonly HeldPiece[];
    widths: RoadsMapFile['widths'];
    scale: number;
    ground: GroundOf;
    revealed: ((x: number, y: number) => boolean) | null;
    known: number;
    waiting: boolean;
    worn: Map<number, Worked>;
  } | null = null;
  return (pieces, widths, scale, ground, revealed, known) => {
    if (
      last !== null &&
      last.pieces === pieces &&
      last.widths === widths &&
      last.scale === scale &&
      last.ground === ground &&
      last.revealed === revealed &&
      (last.known === known || !last.waiting)
    ) {
      return last.worn;
    }
    let waiting = false;
    const asked: GroundOf = (u, v) => {
      const footing = ground(u, v);
      if (footing === null) waiting = true;
      return footing;
    };
    const worn = wearRoads(pieces, widths, scale, asked, revealed);
    last = { pieces, widths, scale, ground, revealed, known, waiting, worn };
    return worn;
  };
}

const files = new Map<string, Promise<RoadsMapFile | null>>();

/** The roads map of a master, fetched once, or null where `world:roads` has laid none: then no road is worn. */
export function roadsMap(tilesRoot: string): Promise<RoadsMapFile | null> {
  let already = files.get(tilesRoot);
  if (already === undefined) {
    already = fetch(`${tilesRoot}/sprites/roads/map.json`, { cache: 'no-store' })
      .then((answer) => (answer.ok ? (answer.json() as Promise<RoadsMapFile>) : null))
      .catch(() => null);
    files.set(tilesRoot, already);
  }
  return already;
}
