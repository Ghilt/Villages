import type { ClassRaster } from './raster.ts';

/**
 * Turning painted pixels back into outlines.
 *
 * Every place where one terrain meets another is a step on the lattice between pixels. Those steps are
 * collected and chained into closed rings, which is what gives a coastline that can be drawn at any size
 * rather than a staircase of squares.
 *
 * Rings come out one at a time so that a caller can simplify each and let it go, rather than holding every
 * vertex of a world at once.
 */

/** A point on the lattice between pixels, in whole pixel units. */
export interface LatticePoint {
  x: number;
  y: number;
}

export type Ring = LatticePoint[];

/**
 * One step of the boundary, from one lattice point to the next. Every step is emitted so that the terrain
 * it belongs to lies to one consistent side, which is what lets steps be chained without ambiguity where
 * several terrains meet at a corner.
 */
interface Step {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

function key(x: number, y: number, stride: number): number {
  return y * stride + x;
}

/**
 * The outline of one terrain class. A pixel outside the grid counts as a different class, so a landmass
 * running off the edge of the world is still closed off rather than left open.
 */
export function* traceClass(raster: ClassRaster, value: number): Generator<Ring> {
  const { width, height, cells } = raster;
  const stride = width + 1;
  const isValue = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && cells[y * width + x] === value;

  // Steps leaving each lattice point. A saddle, where two regions of the same class touch corner to
  // corner, is the only place a point has two, and either choice closes a valid ring.
  const leaving = new Map<number, Step[]>();
  const add = (step: Step): void => {
    const at = key(step.fromX, step.fromY, stride);
    const existing = leaving.get(at);
    if (existing === undefined) {
      leaving.set(at, [step]);
    } else {
      existing.push(step);
    }
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isValue(x, y)) {
        continue;
      }
      if (!isValue(x, y - 1)) {
        add({ fromX: x + 1, fromY: y, toX: x, toY: y });
      }
      if (!isValue(x - 1, y)) {
        add({ fromX: x, fromY: y, toX: x, toY: y + 1 });
      }
      if (!isValue(x, y + 1)) {
        add({ fromX: x, fromY: y + 1, toX: x + 1, toY: y + 1 });
      }
      if (!isValue(x + 1, y)) {
        add({ fromX: x + 1, fromY: y + 1, toX: x + 1, toY: y });
      }
    }
  }

  for (const [start, steps] of leaving) {
    while (steps.length > 0) {
      const first = steps.pop()!;
      if (steps.length === 0) {
        leaving.delete(start);
      }

      const ring: Ring = [{ x: first.fromX, y: first.fromY }];
      let step: Step | undefined = first;

      while (step !== undefined) {
        ring.push({ x: step.toX, y: step.toY });
        const nextKey = key(step.toX, step.toY, stride);
        const options = leaving.get(nextKey);
        if (options === undefined || options.length === 0) {
          break;
        }

        // Prefer carrying straight on, so that a ring does not cut a corner it need not.
        const dx = step.toX - step.fromX;
        const dy = step.toY - step.fromY;
        let chosen = options.findIndex(
          (option) => option.toX - option.fromX === dx && option.toY - option.fromY === dy,
        );
        if (chosen < 0) {
          chosen = 0;
        }
        step = options.splice(chosen, 1)[0];
        if (options.length === 0) {
          leaving.delete(nextKey);
        }
      }

      if (ring.length > 3) {
        yield ring;
      }
    }
  }
}

/** Lattice coordinates to longitude and latitude, which is what the world is measured in. */
export function toLngLat(point: LatticePoint, raster: { width: number; height: number }): [number, number] {
  return [(point.x / raster.width) * 360 - 180, 90 - (point.y / raster.height) * 180];
}
