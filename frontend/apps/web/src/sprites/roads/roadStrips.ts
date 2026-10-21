import { ROAD_KINDS, readRoadKind } from '@villages/world';
import type { RoadsMapFile } from '@villages/world';

import type { HeldPiece } from '../ground/roads';

/*
 * The roads as the page draws them: every piece the game server sent cut to the ground the house has revealed, each
 * stretch of it a straight band with round ends as wide as its grade, so where two meet or a road bends the band runs
 * on unbroken and smooth. A bridge's piece is kept apart, drawn as a line only from further out, where its picture is
 * not. See docs/plans/houses-bridges-and-road-render.md and decision record 0115.
 */

/** A straight stretch of road to draw: its two ends in world units, half its width, its grade, and whether a bridge. */
export interface RoadStrip {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
  readonly half: number;
  /** Its grade by its place in `ROAD_KINDS`, a track nought; a bridge is drawn as a road. */
  readonly grade: number;
  readonly bridge: boolean;
}

/** How finely a piece is walked for where the revealed ground ends, in world units. */
const STEP = 0.25;

/**
 * Every piece as the stretches of it on revealed ground - all of it with the fog off, which is null - as wide as the
 * roads map says its grade is drawn, times `scale`.
 */
export function stripsOf(
  pieces: readonly HeldPiece[],
  widths: RoadsMapFile['widths'],
  scale: number,
  revealed: ((x: number, y: number) => boolean) | null,
): RoadStrip[] {
  const strips: RoadStrip[] = [];
  for (const piece of pieces) {
    const kind = readRoadKind(piece.kind);
    if (kind === null) continue;
    const bridge = 'bridge' in kind;
    const grade = bridge ? ROAD_KINDS.indexOf('road') : ROAD_KINDS.indexOf(kind.road);
    const half = ((bridge ? widths.bridge : widths[ROAD_KINDS[grade]!]) / 2) * scale;
    const dx = piece.bx - piece.ax;
    const dy = piece.by - piece.ay;
    const long = Math.hypot(dx, dy);
    if (revealed === null) {
      strips.push({ ax: piece.ax, ay: piece.ay, bx: piece.bx, by: piece.by, half, grade, bridge });
      continue;
    }
    // Walked a quarter of a unit at a time: each run of revealed points is a stretch, ending at its last one.
    const steps = Math.max(1, Math.ceil(long / STEP));
    let from = -1;
    for (let at = 0; at <= steps + 1; at += 1) {
      const t = at / steps;
      const seen = at <= steps && revealed(piece.ax + dx * t, piece.ay + dy * t);
      if (seen && from < 0) from = at;
      if (!seen && from >= 0) {
        const [t0, t1] = [from / steps, (at - 1) / steps];
        strips.push({
          ax: piece.ax + dx * t0,
          ay: piece.ay + dy * t0,
          bx: piece.ax + dx * t1,
          by: piece.ay + dy * t1,
          half,
          grade,
          bridge,
        });
        from = -1;
      }
    }
  }
  return strips;
}
