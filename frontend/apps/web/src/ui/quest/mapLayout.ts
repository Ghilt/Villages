/**
 * The arithmetic of a quest's map: where each node stands, and the line each edge is drawn along. Read from the top
 * down: a node's row is how far down it is, and its column which of the row's places it takes, the places spread
 * evenly across the width. Which column each node takes is the caller's to say. See decision record 0096.
 */

/** A point on the map, in the map's own pixels. */
export interface Place {
  readonly x: number;
  readonly y: number;
}

/** A node as the map places it: its row, and which of how many places across that row it takes. */
export interface Placing {
  readonly row: number;
  readonly column: number;
  readonly columns: number;
}

/** How a map is spaced: its width, how far apart the rows are, and how big a node is drawn. */
export interface Spacing {
  readonly width: number;
  readonly rowHeight: number;
  readonly nodeSize: number;
}

/** Where a node's middle stands: across the width by its column, and down by its row. */
export function placeOf(node: Placing, spacing: Spacing): Place {
  const across = Math.max(1, node.columns);
  return {
    x: ((Math.min(node.column, across - 1) + 0.5) / across) * spacing.width,
    y: spacing.nodeSize / 2 + node.row * spacing.rowHeight + STUB_ROOM,
  };
}

/** Where edges leave a node: under its title when it has one, which an edge never crosses, and its foot when not. */
export function footOf(middle: Place, spacing: Spacing, titled: boolean): Place {
  return { x: middle.x, y: middle.y + spacing.nodeSize / 2 + (titled ? TITLE_ROOM : 0) };
}

/** Where edges reach a node: its head. */
export function headOf(middle: Place, spacing: Spacing): Place {
  return { x: middle.x, y: middle.y - spacing.nodeSize / 2 };
}

/** How tall a map is: room for its deepest row, its title under it, and a stub above and below. */
export function heightOf(rows: number, spacing: Spacing): number {
  return Math.max(0, rows - 1) * spacing.rowHeight + spacing.nodeSize + TITLE_ROOM + 2 * STUB_ROOM;
}

/**
 * The line an edge is drawn along, as an SVG path: from where it leaves one node to where it reaches the next,
 * curving where they stand apart. With either end not drawn, it is a stub: a short line down out of the node it
 * leaves, or down into the node it reaches.
 */
export function pathOf(from: Place | undefined, to: Place | undefined): string | null {
  if (from !== undefined && to !== undefined) {
    const bend = (to.y - from.y) / 2;
    return `M${n(from.x)} ${n(from.y)} C${n(from.x)} ${n(from.y + bend)} ${n(to.x)} ${n(to.y - bend)} ${n(to.x)} ${n(to.y)}`;
  }
  if (from !== undefined) {
    return `M${n(from.x)} ${n(from.y)} L${n(from.x)} ${n(from.y + STUB)}`;
  }
  if (to !== undefined) {
    return `M${n(to.x)} ${n(to.y - STUB)} L${n(to.x)} ${n(to.y)}`;
  }
  return null;
}

/** How long a stub is drawn, and the room kept above the first row and below the last for one. */
export const STUB = 18;
const STUB_ROOM = STUB + 4;

/** The room under a node for its title, two lines of it at most. */
export const TITLE_ROOM = 34;

/** A coordinate as the path writes it: a tenth of a pixel is plenty. */
function n(value: number): string {
  return String(Math.round(value * 10) / 10);
}
