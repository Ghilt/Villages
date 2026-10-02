/**
 * The grid the ground is read on, and the arithmetic of going into it and back out.
 *
 * The terrain arrives on a square lattice lying along the world's own axes, because that is how a master
 * is painted and how a tile is cut. Nothing says it has to be drawn on that one. Turn the lattice and a
 * cell is a diamond; make it bigger and a cell is a tile of ground rather than a pixel of it. The world
 * underneath is untouched - this decides only where the colour is read, so north stays where it was and
 * a coastline stays where it was. Turning the camera instead would turn the world with it, which is the
 * whole reason this exists. See experiment 0008.
 *
 * Its own module because two things stand on it and neither may own it: the painter, which reads a cell's
 * colour at its middle (`onLattice`), and an area, which is fenced along the same cells and counts them
 * (`area.ts`). Both go into the lattice and back out through the four functions here, so they cannot come
 * to disagree about which cell a place is in or where that cell's middle is. See decision record 0066.
 *
 * Scalars in and scalars out, with no object made per call, because the painter asks nine times a pixel.
 */

export interface Lattice {
  /** How far the lattice is turned from the world's own axes, in degrees. */
  turn: number;
  /** How wide one cell is, in world-space units, where one is a master pixel across. */
  size: number;
}

/** The lattice the world is stored on, and the one everything used before there was a choice. */
export const SQUARE_LATTICE: Lattice = { turn: 0, size: 1 };

/**
 * The grid the ground's colour is read on in the game: turned twenty-six degrees so a cell is a diamond while
 * north stays up, and one world unit across, the finest the terrain goes. Adam's size, on 2026-09-27, after four
 * had been the diamonds button's. The map paints on it, an area is fenced on it, and the stills a look is judged
 * from are painted on it too, which is why it lives here rather than in the page. See experiment 0008 and
 * decision records 0060 and 0066.
 */
export const GROUND_LATTICE: Lattice = { turn: 26, size: 1 };

/** Whether a lattice is the plain one, in which case nothing need be done about it at all. */
export function isSquareLattice(lattice: Lattice): boolean {
  return lattice.turn === 0 && lattice.size === 1;
}

/** A lattice worked out once: the turn as a cosine and a sine, and the width of a cell. */
export interface LatticeFrame {
  readonly cos: number;
  readonly sin: number;
  readonly size: number;
}

export function frameOf(lattice: Lattice): LatticeFrame {
  const turn = (lattice.turn * Math.PI) / 180;
  return { cos: Math.cos(turn), sin: Math.sin(turn), size: lattice.size };
}

/**
 * How far along the lattice's first axis a place in world space is, in cells. The axis runs east when the
 * lattice is not turned, and a place is in cell `floor` of this.
 */
export function alongU(frame: LatticeFrame, x: number, y: number): number {
  return (x * frame.cos + y * frame.sin) / frame.size;
}

/** How far along the lattice's second axis a place in world space is, in cells: south when not turned. */
export function alongV(frame: LatticeFrame, x: number, y: number): number {
  return (y * frame.cos - x * frame.sin) / frame.size;
}

/**
 * Where a point of the lattice, given in cells, lies in world space: east. A cell's middle is its two
 * whole numbers and a half each, and its corner is the two whole numbers.
 */
export function worldXOf(frame: LatticeFrame, u: number, v: number): number {
  return u * frame.size * frame.cos - v * frame.size * frame.sin;
}

/** The same point's south, in world space. */
export function worldYOf(frame: LatticeFrame, u: number, v: number): number {
  return u * frame.size * frame.sin + v * frame.size * frame.cos;
}
