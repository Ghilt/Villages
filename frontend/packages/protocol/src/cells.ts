/**
 * The grid the world is partitioned by, and how far out a thing is worth drawing. The other half of
 * `villages.protocol.Cells` in Kotlin, held to the same vectors in `contracts/fixtures/cells.json`.
 *
 * A cell is a Web Mercator tile address written as one digit per zoom level, most significant first:
 * each digit is the tile's x bit plus twice its y bit at that level. So a cell's ancestor is its prefix,
 * and that one property is what makes the map affordable. The browser's share of the work is knowing
 * which tiles cover what it is looking at; the server's is knowing which tile a thing falls in. Neither
 * is any use if they disagree. See decision record 0026.
 */

/** How deep the grid goes, which is where the world's own painted detail runs out. */
export const MAX_ZOOM = 10;

/** Mercator cannot draw the poles; beyond this a place is in the edge row of cells. */
export const MERCATOR_EDGE = 85.05112878;

/** A tile address in the grid: x and y at a zoom, which is how MapLibre asks for things. */
export interface Tile {
  zoom: number;
  x: number;
  y: number;
}

const clamp = (value: number, least: number, most: number): number =>
  value < least ? least : value > most ? most : value;

/** Which tile a place falls in, at the deepest zoom unless told otherwise. */
export function tileAt(lat: number, lon: number, zoom: number = MAX_ZOOM): Tile {
  const across = 2 ** zoom;
  const x = clamp(Math.floor(((lon + 180) / 360) * across), 0, across - 1);
  const radians = (clamp(lat, -MERCATOR_EDGE, MERCATOR_EDGE) * Math.PI) / 180;
  const mercator = Math.log(Math.tan(radians) + 1 / Math.cos(radians));
  const y = clamp(Math.floor(((1 - mercator / Math.PI) / 2) * across), 0, across - 1);
  return { zoom, x, y };
}

/** A tile's address as a quadkey, which is the form a cell travels and is stored in. */
export function quadkeyOf(tile: Tile): string {
  let digits = '';
  for (let level = tile.zoom; level > 0; level -= 1) {
    const bit = 1 << (level - 1);
    let digit = 0;
    if ((tile.x & bit) !== 0) {
      digit += 1;
    }
    if ((tile.y & bit) !== 0) {
      digit += 2;
    }
    digits += String(digit);
  }
  return digits;
}

/** Which cell a place falls in. The same answer the server gets, or the map has a hole in it. */
export function cellAt(lat: number, lon: number, zoom: number = MAX_ZOOM): string {
  return quadkeyOf(tileAt(lat, lon, zoom));
}

/** The cell containing this one at a shallower zoom, which is simply its prefix. */
export function cellAtZoom(quadkey: string, zoom: number): string {
  return quadkey.slice(0, zoom);
}

/** Whether a cell lies within another, at any depth. The whole of the spatial query. */
export function isInside(quadkey: string, tile: string): boolean {
  return quadkey.startsWith(tile);
}

/**
 * The coarsest zoom anything on the map is sent at, whatever its significance, as `ON_THE_MAP_FROM` in `Cells.kt`:
 * everything arrives together, and the page fades it in together at 7.25. See decision record 0096.
 */
export const ON_THE_MAP_FROM = 7;

/** What a camera is looking at: the corners of the view, and the zoom it is at. */
export interface View {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
}

/**
 * The cells covering what the camera can see, at the camera's own zoom.
 *
 * This is the whole of the client's share of the level of detail: it asks for data on the same grid, at
 * the same zoom, as the terrain tiles it is already drawing. Zooming out does not ask for more cells, it
 * asks for bigger ones, so a screenful costs about the same wherever and however far out you are.
 */
export function cellsForView(view: View, margin = 0): string[] {
  const zoom = clamp(Math.floor(view.zoom), 0, MAX_ZOOM);
  const across = 2 ** zoom;
  const topLeft = tileAt(view.north, view.west, zoom);
  const bottomRight = tileAt(view.south, view.east, zoom);

  const cells: string[] = [];
  const fromY = clamp(topLeft.y - margin, 0, across - 1);
  const toY = clamp(bottomRight.y + margin, 0, across - 1);
  // The camera can be turned to face across the antimeridian, where the western column is a higher
  // number than the eastern one. Walking with a wrap covers that without a second case.
  const width = ((bottomRight.x - topLeft.x + across) % across) + 1 + margin * 2;
  for (let step = 0; step < Math.min(width, across); step += 1) {
    const x = (topLeft.x - margin + step + across * 2) % across;
    for (let y = fromY; y <= toY; y += 1) {
      cells.push(quadkeyOf({ zoom, x, y }));
    }
  }
  return cells;
}
