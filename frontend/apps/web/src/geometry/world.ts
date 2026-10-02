/*
 * The ground's own measures, which the map, the scenery, the fog and the areas all mean the same thing by. Kept
 * below all of them, so that none has to reach into another for a number. See decision record 0073.
 */

/** The deepest zoom the world is drawn at. */
export const WORLD_MAX_ZOOM = 10;

/** How wide the master is, which is what sets how much ground a tile pixel covers at each zoom. */
export const WORLD_MASTER_WIDTH = 32768;

/**
 * How wide a flat tile is, which is what the terrain is cut into and read back from. The areas, the
 * scenery and the terrain log all mean this one.
 */
export const TILE = 256;

/** Beyond this there are no flat tiles, because a tile pixel is already a master pixel at seven. */
export const FLAT_MAX_ZOOM = 7;
