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

import type { Delta } from '@villages/protocol';

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
  /** The characters standing in those cells, counted apart from the houses. */
  characters: number;
  /** The structures standing in them, in whatever face each house is sent. */
  structures: number;
}

export const NOTHING_ARRIVED: Arrival = {
  cells: 0,
  zoom: 0,
  houses: 0,
  omitted: 0,
  characters: 0,
  structures: 0,
};

/** One more snapshot in the burst. Only the parts of the frame this counts are asked for. */
export function alsoArrived(
  soFar: Arrival,
  snapshot: {
    cell: string;
    houses: readonly unknown[];
    omitted?: number;
    characters?: readonly unknown[];
    structures?: readonly unknown[];
  },
): Arrival {
  return {
    cells: soFar.cells + 1,
    zoom: snapshot.cell.length,
    houses: soFar.houses + snapshot.houses.length,
    omitted: soFar.omitted + (snapshot.omitted ?? 0),
    characters: soFar.characters + (snapshot.characters?.length ?? 0),
    structures: soFar.structures + (snapshot.structures?.length ?? 0),
  };
}

/**
 * What to say about the burst, or null when it is not worth a line. The characters and the structures are
 * said only when there are some, so a world with neither on its map reads the way it always did.
 */
export function describeArrival(arrival: Arrival): string | null {
  if (arrival.houses === 0 && arrival.omitted === 0 && arrival.characters === 0 && arrival.structures === 0) {
    return null;
  }
  const cells = `${arrival.cells} cell${arrival.cells === 1 ? '' : 's'} at z${arrival.zoom}`;
  const houses = `${arrival.houses} house${arrival.houses === 1 ? '' : 's'}`;
  const characters =
    arrival.characters === 0 ? '' : `, ${arrival.characters} character${arrival.characters === 1 ? '' : 's'}`;
  const structures =
    arrival.structures === 0 ? '' : `, ${arrival.structures} structure${arrival.structures === 1 ? '' : 's'}`;
  const more = arrival.omitted > 0 ? `, ${arrival.omitted} more not sent` : '';
  return `${cells}: ${houses}${characters}${structures}${more}`;
}

/**
 * What to say about one batch of deltas: how many, and by name every character in it who arrived, moved
 * or went, and every structure raised, because those are rare enough to be news and a house changing is not.
 * `nameOf` is who a character is by id, from what was held before the batch, since a character who is
 * gone arrives as nothing but an id.
 */
export function describeBatch(deltas: readonly Delta[], nameOf: (id: string) => string | undefined): string {
  const count = `${deltas.length} delta${deltas.length === 1 ? '' : 's'} in one batch`;
  const people = deltas.flatMap((delta) => {
    switch (delta.type) {
      case 'characterArrived':
        return [`${delta.character.givenName} ${delta.character.familyName} arrived`];
      case 'characterChanged':
        return [`${delta.character.givenName} ${delta.character.familyName} moved`];
      case 'characterGone':
        return [`${nameOf(delta.id) ?? delta.id.slice(0, 8)} went`];
      case 'structureArrived':
        return [`${delta.structure.name} raised`];
      case 'structureChanged':
        return [`${delta.structure.name} changed, held by ${delta.structure.holder?.name ?? 'nobody'}`];
      default:
        return [];
    }
  });
  return people.length === 0 ? count : `${count}: ${people.join(', ')}`;
}

/** What a burst of stands brought: how many tiles answered, and how many stands the fog let through in them. */
export interface StandsArrival {
  tiles: number;
  stands: number;
}

export const NO_STANDS_ARRIVED: StandsArrival = { tiles: 0, stands: 0 };

/** Eight bytes a stand, as the sprite map writes them. */
const STAND_BYTES = 8;

/** One more tile of stands in the burst, counted off the length of its base64 rather than decoded. */
export function alsoStood(soFar: StandsArrival, frame: { stands: string }): StandsArrival {
  const padding = frame.stands.endsWith('==') ? 2 : frame.stands.endsWith('=') ? 1 : 0;
  const bytes = (frame.stands.length / 4) * 3 - padding;
  return { tiles: soFar.tiles + 1, stands: soFar.stands + Math.floor(bytes / STAND_BYTES) };
}

/**
 * What to say about a burst of stands, or null when it brought none: tiles of empty or unseen ground arriving
 * as the camera moves are not news, and the gateway holding the rest back is what an empty tile is.
 */
export function describeStands(arrival: StandsArrival): string | null {
  if (arrival.stands === 0) {
    return null;
  }
  const tiles = `${arrival.tiles} tile${arrival.tiles === 1 ? '' : 's'}`;
  return `${tiles} from the server: ${arrival.stands} stand${arrival.stands === 1 ? '' : 's'}`;
}
