import { frameOf, GROUND_LATTICE } from '@villages/world';

/** A place in a scene, in its units. */
export interface Spot {
  readonly x: number;
  readonly y: number;
}

/**
 * The ground's lattice as a diorama draws it: the map's own, turned as the ground is (26 degrees) and seen as the
 * camera sees it closest in, looking north and down at 45 degrees, so it is squashed to that angle's cosine. `origin`
 * is the corner counted (0, 0); `u` and `v` are one cell along each axis, on the screen - `u` running down to the right
 * at about 19 degrees, `v` down to the left at about 55 - so a building's picture, drawn turned as the ground is, stands
 * square on its cells. Decision record 0116.
 */
export interface ScreenLattice {
  readonly origin: Spot;
  readonly u: Spot;
  readonly v: Spot;
}

/** How much the camera squashes the ground closest in: the cosine of 45 degrees. */
const SQUASH = Math.SQRT1_2;

/** The ground's lattice in a scene: its corner (0, 0) at `origin`, a cell `cell` units across, as a world unit is. */
export function latticeOf(origin: Spot, cell: number): ScreenLattice {
  const frame = frameOf(GROUND_LATTICE);
  return {
    origin,
    u: { x: frame.cos * cell, y: frame.sin * SQUASH * cell },
    v: { x: -frame.sin * cell, y: frame.cos * SQUASH * cell },
  };
}

/** Where corner (u, v) of the lattice is in the scene; a cell's middle is half a cell on from its corner. */
export function latticeAt(lattice: ScreenLattice, u: number, v: number): Spot {
  return {
    x: lattice.origin.x + u * lattice.u.x + v * lattice.v.x,
    y: lattice.origin.y + u * lattice.u.y + v * lattice.v.y,
  };
}

/** Which corner of the lattice a place in the scene is at, in cells along each axis: `latticeAt` undone. */
export function latticeFrom(lattice: ScreenLattice, spot: Spot): { u: number; v: number } {
  const { u, v, origin } = lattice;
  const x = spot.x - origin.x;
  const y = spot.y - origin.y;
  const across = u.x * v.y - v.x * u.y;
  return { u: (x * v.y - v.x * y) / across, v: (u.x * y - x * u.y) / across };
}

/** The middle of the cell a place in the scene is in. */
export function onCell(lattice: ScreenLattice, spot: Spot): Spot {
  const { u, v } = latticeFrom(lattice, spot);
  return latticeAt(lattice, Math.floor(u) + 0.5, Math.floor(v) + 0.5);
}

/** The lattice as an SVG transform: a square one unit across drawn through it is one cell. */
export function latticeMatrix(lattice: ScreenLattice): string {
  const { u, v, origin } = lattice;
  return `matrix(${u.x} ${u.y} ${v.x} ${v.y} ${origin.x} ${origin.y})`;
}
