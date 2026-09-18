/**
 * What a burst of snapshots brought, added up, and what is worth saying about it.
 *
 * A snapshot is the whole of one cell, and a view is a few dozen cells, so every pan used to write a few
 * dozen lines into the debug log - almost all of them "0 houses" over empty world. Once the panel was
 * the log and nothing else, that buried everything worth reading in it. So the snapshots of one burst
 * are counted and said once, and a burst that brought nothing is not said at all: moving the camera
 * about is not news, and arriving somewhere with houses in it is.
 *
 * Pure, so the counting and the wording can be tested without a socket. See decision record 0023.
 */

export interface Arrival {
  /** How many cells answered in this burst. */
  cells: number;
  /**
   * The depth of those cells. A view asks at one zoom, so they agree; a burst that somehow mixed them
   * is named by the last one counted, which is near enough for a line in a log.
   */
  zoom: number;
  houses: number;
  /** How many more the cells held than they sent, which is the snapshot cap speaking. */
  omitted: number;
}

export const NOTHING_ARRIVED: Arrival = { cells: 0, zoom: 0, houses: 0, omitted: 0 };

/** One more snapshot in the burst. Only the parts of the frame this counts are asked for. */
export function alsoArrived(
  soFar: Arrival,
  snapshot: { cell: string; houses: readonly unknown[]; omitted?: number },
): Arrival {
  return {
    cells: soFar.cells + 1,
    zoom: snapshot.cell.length,
    houses: soFar.houses + snapshot.houses.length,
    omitted: soFar.omitted + (snapshot.omitted ?? 0),
  };
}

/** What to say about the burst, or null when it is not worth a line. */
export function describeArrival(arrival: Arrival): string | null {
  if (arrival.houses === 0 && arrival.omitted === 0) {
    return null;
  }
  const cells = `${arrival.cells} cell${arrival.cells === 1 ? '' : 's'} at z${arrival.zoom}`;
  const houses = `${arrival.houses} house${arrival.houses === 1 ? '' : 's'}`;
  return `${cells}: ${houses}${arrival.omitted > 0 ? `, ${arrival.omitted} more not sent` : ''}`;
}
