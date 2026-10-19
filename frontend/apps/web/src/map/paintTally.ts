/**
 * How the painting is going, counted as it happens: what `painterlyTiles.ts` counts and what is read of it.
 *
 * The tally says how well the looking ahead is working: of the tiles the map asked for, how many were already
 * painted. Ready is the number that decides how this feels, because a tile that is not ready is a tile the eye
 * catches arriving. It does not show up in a profile, so it is counted here, read from a console with
 * `window.villagesPainterly()`, and said in the log the one time it matters - see `crowded` in `painterlyTiles.ts`.
 */
export const tally = {
  ready: 0,
  waited: 0,
  aheadPainted: 0,
  dropped: 0,
  painted: 0,
  terrainMs: 0,
  paintMs: 0,
};

export interface PaintedTally {
  ready: number;
  waited: number;
  aheadPainted: number;
  /** Tiles MapLibre asked for and gave up on before any painter had them, so they were never painted. */
  dropped: number;
  /** Tiles painted, wanted or not, and the painters' own time on them, summed across all of them. */
  painted: number;
  terrainMs: number;
  paintMs: number;
  /** How many painted tiles are being kept, against the cap. */
  held: number;
}

/** Starts the tally again, so a single movement can be measured on its own. */
export function forgetTally(): void {
  for (const key of Object.keys(tally) as (keyof typeof tally)[]) {
    tally[key] = 0;
  }
}

/**
 * The map's requests for painted tiles since the page opened: how many it has made, and how many have ended,
 * answered or given up on. The difference is what the map is still waiting for, which the loading screen's meter
 * is filled from. Never started again, unlike the tally.
 */
export const requests = { asked: 0, ended: 0 };

export function paintedRequests(): { readonly asked: number; readonly ended: number } {
  return { ...requests };
}
