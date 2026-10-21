/*
 * The world's units a straight line passes over, in order from its start: every one it crosses, and where it passes
 * exactly through a corner between its ends, both of the units on either side of it, so a line between two rivers
 * joined only at their corners is never taken to pass between them. What a bridge is laid along and what a smoothed
 * road is checked against. See docs/plans/settlements-and-roads.md.
 */

/**
 * Calls `visit` with every unit from (`ax`, `ay`) to (`bx`, `by`) and how far along the line it is entered, nought to
 * one, stopping as soon as `visit` says false; whether it went the whole way.
 */
export function unitsAlong(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  visit: (x: number, y: number, entered: number, left: number) => boolean,
): boolean {
  let x = Math.floor(ax);
  let y = Math.floor(ay);
  const endX = Math.floor(bx);
  const endY = Math.floor(by);
  const dx = bx - ax;
  const dy = by - ay;
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  // How far along the line each next edge of a unit is crossed, and how far between two of them.
  const acrossX = stepX === 0 ? Infinity : Math.abs(1 / dx);
  const acrossY = stepY === 0 ? Infinity : Math.abs(1 / dy);
  let nextX = stepX === 0 ? Infinity : (stepX > 0 ? x + 1 - ax : ax - x) * acrossX;
  let nextY = stepY === 0 ? Infinity : (stepY > 0 ? y + 1 - ay : ay - y) * acrossY;
  let entered = 0;
  for (let guard = 0; guard < 1_000_000; guard += 1) {
    const next = Math.min(nextX, nextY);
    const left = Math.min(next, 1);
    if (!visit(x, y, entered, left)) return false;
    if (x === endX && y === endY) return true;
    // An end on this unit's edge or corner is in the unit beside it, which is taken; a unit it only touches at that
    // corner is not, as a start on a corner takes none, so a line and the same line walked back take the same units.
    if (next >= 1 - 1e-12) return visit(endX, endY, 1, 1);
    entered = left;
    if (Math.abs(nextX - nextY) < 1e-12) {
      // Through a corner between its ends: the two units it passes between, then the one across it.
      if (
        entered > 1e-12 &&
        (!visit(x + stepX, y, entered, entered) || !visit(x, y + stepY, entered, entered))
      ) {
        return false;
      }
      x += stepX;
      y += stepY;
      nextX += acrossX;
      nextY += acrossY;
    } else if (nextX < nextY) {
      x += stepX;
      nextX += acrossX;
    } else {
      y += stepY;
      nextY += acrossY;
    }
  }
  return true;
}
