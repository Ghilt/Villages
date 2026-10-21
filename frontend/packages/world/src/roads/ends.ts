import { GROUND_LATTICE, frameOf, worldXOf, worldYOf } from '../lattice.ts';
import type { RuinPiece } from '../ruinLayout.ts';
import { RUIN_PIECES } from '../ruins.ts';
import { inSquare, streetEnds } from '../settlements.ts';
import type { SettlementSquare } from '../settlements.ts';
import { unitKey } from './course.ts';
import type { RoadEnd } from './network.ts';

/*
 * Where a road meets a place, and what of a place it keeps off. Into a settlement by one of its two streets, at the
 * diamond just outside its square where the street leaves it, and never over the square itself, which its buildings
 * stand in. At a ruined town by a gate, a step outside it, where the town was walled, and at the outline of its built
 * ground where it was not; never among its pieces. See docs/plans/settlements-and-roads.md.
 */

const FRAME = frameOf(GROUND_LATTICE);
const GATE = RUIN_PIECES.indexOf('gate');
/** How far outside a gate a road ends, and outside a ruin's built ground where it has no wall, in world units. */
const OUTSIDE = 1.5;
/** How many places round an unwalled ruin's outline a road may end at. */
const AROUND = 16;
/** How far about a ruin's piece no road passes, in world units. */
const CLEAR = 0.8;

/**
 * The four ends of a settlement's streets, in world units: the middle of the diamond just outside each, and the way
 * out along its street.
 */
export function settlementEnds(square: SettlementSquare): RoadEnd[] {
  return streetEnds(square).map(({ u, v }) => {
    const du = u < square.fromU ? -1 : u >= square.fromU + square.side ? 1 : 0;
    const dv = v < square.fromV ? -1 : v >= square.fromV + square.side ? 1 : 0;
    return {
      x: worldXOf(FRAME, u + 0.5, v + 0.5),
      y: worldYOf(FRAME, u + 0.5, v + 0.5),
      out: { x: worldXOf(FRAME, du, dv), y: worldYOf(FRAME, du, dv) },
    };
  });
}

/**
 * The world's units a settlement's square covers, by `unitKey`: every one whose middle lies inside it, but the ones its
 * streets' ends are in, which its roads come in by.
 */
export function settlementUnits(square: SettlementSquare): number[] {
  const open = new Set(settlementEnds(square).map((end) => unitKey(Math.floor(end.x), Math.floor(end.y))));
  const corners = [
    [square.fromU, square.fromV],
    [square.fromU + square.side, square.fromV],
    [square.fromU, square.fromV + square.side],
    [square.fromU + square.side, square.fromV + square.side],
  ].map(([u, v]) => ({ x: worldXOf(FRAME, u!, v!), y: worldYOf(FRAME, u!, v!) }));
  const out: number[] = [];
  for (
    let y = Math.floor(Math.min(...corners.map((c) => c.y)));
    y <= Math.max(...corners.map((c) => c.y));
    y += 1
  ) {
    for (
      let x = Math.floor(Math.min(...corners.map((c) => c.x)));
      x <= Math.max(...corners.map((c) => c.x));
      x += 1
    ) {
      const u = Math.floor((x + 0.5) * FRAME.cos + (y + 0.5) * FRAME.sin);
      const v = Math.floor((y + 0.5) * FRAME.cos - (x + 0.5) * FRAME.sin);
      if (inSquare(square, u, v) && !open.has(unitKey(x, y))) out.push(unitKey(x, y));
    }
  }
  return out;
}

/** A ruined town as its ends are found: its middle and how far its built ground reaches, in world units. */
export interface RuinTown {
  readonly x: number;
  readonly y: number;
  readonly built: number;
}

/**
 * Where a road may end at a ruin: outside each of its gates, out from its middle, where `pieces` - the town's, laid out
 * by `ruinsIn` - hold any; else at even bearings round its built ground. Either way a step past the furthest piece
 * along its way out, so no end is shut in among the pieces at the town's ragged edge, or among those outside its wall.
 */
export function ruinEnds(town: RuinTown, pieces: readonly RuinPiece[]): RoadEnd[] {
  const near = pieces.filter((one) => Math.hypot(one.x - town.x, one.y - town.y) < town.built * 2.5);
  const gates = near.filter(
    (one) => one.piece === GATE && Math.hypot(one.x - town.x, one.y - town.y) < town.built * 1.5,
  );
  /** The first point along `out` from `from`, a step at a time, at least `OUTSIDE` on and clear of every piece. */
  const past = (from: { x: number; y: number }, out: { x: number; y: number }): RoadEnd => {
    for (let along = OUTSIDE; ; along += 0.5) {
      const x = from.x + out.x * along;
      const y = from.y + out.y * along;
      const shut = near.some(
        (piece) => Math.abs(piece.x - x) < CLEAR + 1.2 && Math.abs(piece.y - y) < CLEAR + 1.2,
      );
      if (!shut || along > town.built * 1.5 + OUTSIDE) return { x, y, out };
    }
  };
  if (gates.length > 0) {
    return gates.map((gate) => {
      const away = Math.hypot(gate.x - town.x, gate.y - town.y) || 1;
      return past(gate, { x: (gate.x - town.x) / away, y: (gate.y - town.y) / away });
    });
  }
  const ends: RoadEnd[] = [];
  for (let at = 0; at < AROUND; at += 1) {
    const turn = (at / AROUND) * 2 * Math.PI;
    const out = { x: Math.cos(turn), y: Math.sin(turn) };
    ends.push(past({ x: town.x + out.x * town.built, y: town.y + out.y * town.built }, out));
  }
  return ends;
}

/** The world's units a ruin's pieces stand on and about, by `unitKey`, which no road passes over. */
export function ruinUnits(pieces: readonly RuinPiece[]): number[] {
  const out = new Set<number>();
  for (const piece of pieces) {
    for (let y = Math.floor(piece.y - CLEAR); y <= Math.floor(piece.y + CLEAR); y += 1) {
      for (let x = Math.floor(piece.x - CLEAR); x <= Math.floor(piece.x + CLEAR); x += 1)
        out.add(unitKey(x, y));
    }
  }
  return [...out];
}
