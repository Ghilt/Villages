import type { FeatureCollection } from 'geojson';

/** The map layers an area is drawn in, by name, and how it is drawn: the overlay's, in `AreaOverlay.tsx`. */

export const SOURCE = 'areas';
export const SHADE = 'areas-shade';
export const LINE = 'areas-line';
export const PULSE = 'areas-pulse';

/**
 * The line as it is being drawn, before there is a fence to draw instead.
 *
 * Kept apart from the areas source because it is a different kind of thing: the raw drag, in longitude
 * and latitude, exactly where the hand went and snapped to nothing. Snapping is what makes a fence exact
 * and it is worth nothing while the hand is still moving, so it waits for the mouse to come up.
 */
export const DRAFT = 'areas-draft';
export const DRAFT_LINE = 'areas-draft-line';
export const DRAFT_CLOSE = 'areas-draft-close';

/** Not a terrain colour and not the map's ink: an area is a thing a player drew, and says so. */
export const FENCE = '#8f1d2f';

/** Slow enough to read as breathing rather than blinking. */
export const PERIOD_MS = 2400;

/** How far the pointer must move before another point is taken. Screen pixels, so any zoom is the same. */
export const SAMPLE_EVERY = 4;

export const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
