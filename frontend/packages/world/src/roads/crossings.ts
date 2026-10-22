import { GROUND_LATTICE, frameOf } from '../lattice.ts';
import { BRIDGE_WAYS, WAY_STEPS } from '../bridgeModel.ts';
import type { BridgeWay } from '../bridgeModel.ts';
import { BRIDGEABLE, RIVER, WATER } from './course.ts';
import type { CourseGround, Point } from './course.ts';
import { unitsAlong } from './line.ts';

/*
 * Where a road may cross a river: from a point on its bank, along one of the ground lattice's eight ways, land walked
 * to the water's edge, a river small enough to bridge and no longer than the longest span, and land again with land
 * beyond it. What a road's course tries wherever it stands beside such a river (`course.ts`). See decision record 0115.
 */

const FRAME = frameOf(GROUND_LATTICE);

/**
 * The sixteen directions a bridge may be built in, in world units: each of its eight ways - the lattice's two axes, its
 * two diagonals and the four halfway between - both ways along it, with the step of the lattice it goes, if it is one.
 */
const WAYS: readonly { axis: BridgeWay; dx: number; dy: number; du: number; dv: number }[] =
  BRIDGE_WAYS.flatMap((axis) => {
    const [u, v] = WAY_STEPS[axis];
    const length = Math.hypot(u, v);
    const dx = (u * FRAME.cos - v * FRAME.sin) / length;
    const dy = (u * FRAME.sin + v * FRAME.cos) / length;
    return [
      { axis, dx, dy, du: u, dv: v },
      { axis, dx: -dx, dy: -dy, du: -u, dv: -v },
    ];
  });

/** A bridge out of a point: the unit it lands in, where on the axis its far end is, its way and its span. */
export interface Crossing {
  readonly x: number;
  readonly y: number;
  readonly end: Point;
  readonly axis: BridgeWay;
  readonly span: number;
  /** The step of the lattice its way is, in diamonds along each axis. */
  readonly du: number;
  readonly dv: number;
}

/** Every bridge out of a point of the world, a diamond's middle, one a direction at most, in the order of `WAYS`. */
export function bridgesFrom(start: Point, ground: CourseGround, longestSpan: number): Crossing[] {
  const out: Crossing[] = [];
  const { x: sx, y: sy } = start;
  const far = longestSpan + 3;
  for (const way of WAYS) {
    let phase: 'start' | 'leaving' | 'river' | 'landed' = 'start';
    let riverFrom = 0;
    let landing: { x: number; y: number; middle: number } | null = null;
    let ok = false;
    unitsAlong(sx, sy, sx + way.dx * far, sy + way.dy * far, (ux, uy, entered, left) => {
      const cost = ground.cost(ux, uy);
      if (phase === 'start') {
        phase = 'leaving';
        return cost >= 1;
      }
      if (left === entered) {
        // A unit passed only at its corner: a river is still crossed there, and open water still bars it.
        return !(phase === 'river' && (cost === WATER || cost === RIVER));
      }
      if (phase === 'leaving') {
        // Still on the bank: land is walked to the water's edge, and a bridge starts there.
        if (cost >= 1 && !ground.barred(ux, uy)) return entered * far < 1.5;
        if (cost !== BRIDGEABLE) return false;
        phase = 'river';
        riverFrom = entered;
        return true;
      }
      if (phase === 'river') {
        if ((entered - riverFrom) * far > longestSpan) return false;
        if (cost === BRIDGEABLE) return true;
        if (cost < 1 || ground.barred(ux, uy)) return false;
        landing = { x: ux, y: uy, middle: (entered + left) / 2 };
        phase = 'landed';
        return true;
      }
      // The unit past the landing is land too, so a bridge never lands on a sliver between two rivers.
      ok = cost >= 1 && !ground.barred(ux, uy);
      return false;
    });
    const landed = landing as { x: number; y: number; middle: number } | null;
    if (!ok || landed === null) continue;
    const reach = landed.middle * far;
    out.push({
      x: landed.x,
      y: landed.y,
      end: { x: sx + way.dx * reach, y: sy + way.dy * reach },
      axis: way.axis,
      span: reach,
      du: way.du,
      dv: way.dv,
    });
  }
  return out;
}
