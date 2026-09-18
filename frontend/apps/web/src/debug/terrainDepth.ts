/**
 * Where the terrain on the screen is coming from, in words: how much ground a pixel covers at a zoom,
 * and how far past the depth it was cut at it is being stretched.
 *
 * These are the numbers that explain what the map looks like, and they are not obvious from the zoom.
 * They used to be two rows of the debug panel's state, redrawn four times a second; now they are said
 * once, when the camera settles somewhere new. Pure, so the arithmetic is checked rather than squinted
 * at, which decision 0023 asks of every figure the panel shows.
 */

export interface TerrainDepth {
  /** The zoom of tiles the map is asking for. */
  tileZoom: number;
  /** The deepest zoom the terrain was cut at. Past it, tiles are stretched from this one. */
  flatMaxZoom: number;
  masterWidth: number;
  tileSize: number;
}

/** How many master pixels one screen pixel covers at this depth. */
export function masterPerPixel(at: TerrainDepth): number {
  return at.masterWidth / (at.tileSize * 2 ** at.tileZoom);
}

/** How far the tiles are being stretched: 1 while there is detail to draw, then 2, 4, 8. */
export function stretchAt(at: TerrainDepth): number {
  return 2 ** Math.max(0, at.tileZoom - at.flatMaxZoom);
}

/**
 * One line about a move from one tile zoom to another, or null when it did not end up anywhere new.
 *
 * A camera flight crosses several zooms on its way, so the run is named by where it started and where it
 * stopped rather than a line a step. A run that came back to where it began says nothing.
 */
export function describeTerrainStep(from: number, to: TerrainDepth): string | null {
  if (from === to.tileZoom) {
    return null;
  }
  const stretch = stretchAt(to);
  const ground = `${masterPerPixel(to).toFixed(2)} master px a pixel`;
  const depth = stretch === 1 ? 'as cut' : `z${to.flatMaxZoom} stretched ${stretch}x`;
  return `z${from} to z${to.tileZoom}: ${ground}, ${depth}`;
}
