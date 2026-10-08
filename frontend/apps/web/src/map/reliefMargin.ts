/**
 * A height tile's own heights with a margin of its neighbours' on every side, so the relief's slope at its edge
 * reads the ground on both sides and two tiles agree where they meet (decision record 0090).
 *
 * A neighbour that is not here yet no longer holds the tile back: its margin is the tile's own ground carried on
 * past the edge at the slope it had there, which shades the edge as it would be shaded with the neighbour in all
 * but the sharpest of valleys, and is made again with the real one when it lands. The nine are the tile and its
 * neighbours row by row from the north-west, the tile itself in the middle.
 */
export function widen(nine: readonly (Int16Array | null)[], side: number, margin: number): Int16Array {
  const own = nine[4];
  if (own === null || own === undefined) {
    throw new Error('a tile is widened from its own heights');
  }
  const wide = side + 2 * margin;
  const out = new Int16Array(wide * wide);
  for (let row = 0; row < wide; row += 1) {
    const from = row - margin;
    const tileY = from < 0 ? 0 : from >= side ? 2 : 1;
    const inY = from - (tileY - 1) * side;
    for (let column = 0; column < wide; column += 1) {
      const at = column - margin;
      const tileX = at < 0 ? 0 : at >= side ? 2 : 1;
      const tile = nine[tileY * 3 + tileX];
      if (tile !== null && tile !== undefined) {
        out[row * wide + column] = tile[inY * side + (at - (tileX - 1) * side)]!;
      }
    }
  }

  /** Carried on past the edge: as far above the edge as the ground inside is below it. */
  const carry = (edge: number, inside: number) => Math.max(-32768, Math.min(32767, 2 * edge - inside));
  const at = (row: number, column: number) => out[row * wide + column]!;
  const first = margin;
  const last = margin + side - 1;
  const ownRows = { from: first, to: last };
  const missing = (i: number) => nine[i] === null || nine[i] === undefined;

  // The four sides first, from the tile's own ground; then the corners, from the sides either side of them.
  const sideways = (rows: { from: number; to: number }, west: boolean) => {
    for (let row = rows.from; row <= rows.to; row += 1) {
      for (let k = 1; k <= margin; k += 1) {
        out[row * wide + (west ? first - k : last + k)] = west
          ? carry(at(row, first), at(row, first + k))
          : carry(at(row, last), at(row, last - k));
      }
    }
  };
  const upDown = (north: boolean) => {
    for (let column = first; column <= last; column += 1) {
      for (let k = 1; k <= margin; k += 1) {
        out[(north ? first - k : last + k) * wide + column] = north
          ? carry(at(first, column), at(first + k, column))
          : carry(at(last, column), at(last - k, column));
      }
    }
  };
  if (missing(1)) upDown(true);
  if (missing(7)) upDown(false);
  if (missing(3)) sideways(ownRows, true);
  if (missing(5)) sideways(ownRows, false);
  for (const [corner, north, west] of [
    [0, true, true],
    [2, true, false],
    [6, false, true],
    [8, false, false],
  ] as const) {
    if (missing(corner)) {
      const rows = north ? { from: 0, to: first - 1 } : { from: last + 1, to: wide - 1 };
      sideways(rows, west);
    }
  }
  return out;
}
