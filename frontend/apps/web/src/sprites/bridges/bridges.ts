import { readRoadKind } from '@villages/world';
import type { BridgeWay } from '@villages/world';

import type { HeldPiece } from '../ground/roads';
import type { GroundFootprint, GroundPoint } from '../standing/footprint';

/*
 * The bridges among the roads the page holds: every piece of the `roads` layer whose kind says it is one, with its
 * way, its middle and its span, and the strip of ground its deck stands on, which the trees are drawn in
 * front of or behind (decision record 0110). A bridge reads the same from either end, so one picture an axis draws it
 * whichever way its road runs. See docs/plans/settlements-and-roads.md and decision record 0115.
 */

/** How far either side of its line a bridge's deck reaches, in world units: the strip it stands on. */
const DECK_HALF = 0.6;

/** A bridge as the map draws it. */
export interface Bridge {
  /** Its own name on the map, the same for the same bridge whichever tile brought it. */
  readonly id: string;
  readonly axis: BridgeWay;
  /** The middle of its deck, in world units. */
  readonly middle: GroundPoint;
  /** Which way its deck runs, a unit long, and how long it is end to end. */
  readonly along: GroundPoint;
  readonly span: number;
}

/** The bridges among the pieces held, each once. */
export function bridgesAmong(pieces: readonly HeldPiece[]): Bridge[] {
  const bridges: Bridge[] = [];
  for (const piece of pieces) {
    const kind = readRoadKind(piece.kind);
    if (kind === null || !('bridge' in kind)) continue;
    const dx = piece.bx - piece.ax;
    const dy = piece.by - piece.ay;
    const span = Math.hypot(dx, dy);
    if (span === 0) continue;
    const middle = { x: (piece.ax + piece.bx) / 2, y: (piece.ay + piece.by) / 2 };
    bridges.push({
      id: `bridge:${middle.x},${middle.y}`,
      axis: kind.bridge,
      middle,
      along: { x: dx / span, y: dy / span },
      span,
    });
  }
  return bridges;
}

/**
 * The strip a bridge's deck stands on, its corners round it, the one nearest the camera first: what the trees are
 * sorted against, as a building's footprint is.
 */
export function deckOf(bridge: Bridge): GroundFootprint {
  const { middle, along, span } = bridge;
  const across = { x: -along.y, y: along.x };
  const at = (s: number, w: number): GroundPoint => ({
    x: middle.x + along.x * s + across.x * w,
    y: middle.y + along.y * s + across.y * w,
  });
  const half = span / 2;
  const round = [at(-half, -DECK_HALF), at(half, -DECK_HALF), at(half, DECK_HALF), at(-half, DECK_HALF)];
  // The camera looks north, so the corner furthest south is nearest it.
  const nearest = round.reduce((best, corner, at) => (corner.y > round[best]!.y ? at : best), 0);
  return [0, 1, 2, 3].map((step) => round[(nearest + step) % 4]!) as unknown as GroundFootprint;
}
