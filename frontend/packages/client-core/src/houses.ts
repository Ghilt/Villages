import { isInside } from '@villages/protocol';
import type { CharacterOnMapView, HouseView, ServerFrame } from '@villages/protocol';

/**
 * What the map should be drawing, as the gateway has told us cell by cell: the houses, and the characters
 * standing among them.
 *
 * Kept per held cell rather than as one bag of houses, because that is how it arrives and how it goes:
 * a snapshot is the whole of one cell, a delta lands in every held cell that contains the house, and
 * letting a cell go takes its houses with it. What is drawn is the union, a house counted once at its
 * highest version. No reference counting, nothing to get out of step.
 *
 * **Characters are held the same way, with one difference: they move.** A house is only ever added to a
 * cell; a character who moved is taken out of every held cell their new place is not in, and one who is
 * gone is taken out of all of them. Held and let go with the houses, so there is one set of cells and
 * never two to keep in step. See decision record 0055.
 */
export interface HousesState {
  /** Each held cell and what it holds, by house id. A cell is held from the moment it is asked for. */
  readonly byCell: ReadonlyMap<string, ReadonlyMap<string, HouseView>>;
  /** How many more each cell held than its snapshot carried, so the count on screen is never a lie. */
  readonly omitted: ReadonlyMap<string, number>;
  /** Each held cell and the characters standing in it, by character id. */
  readonly charactersByCell: ReadonlyMap<string, ReadonlyMap<string, CharacterOnMapView>>;
  /** How many more characters each cell held than its snapshot carried. */
  readonly omittedCharacters: ReadonlyMap<string, number>;
}

export const NO_HOUSES: HousesState = {
  byCell: new Map(),
  omitted: new Map(),
  charactersByCell: new Map(),
  omittedCharacters: new Map(),
};

/** Starts holding cells, empty until their snapshots come, so a delta arriving first has somewhere to land. */
export function holdCells(state: HousesState, cells: readonly string[]): HousesState {
  const byCell = new Map(state.byCell);
  const charactersByCell = new Map(state.charactersByCell);
  for (const cell of cells) {
    if (!byCell.has(cell)) {
      byCell.set(cell, new Map());
    }
    if (!charactersByCell.has(cell)) {
      charactersByCell.set(cell, new Map());
    }
  }
  return { ...state, byCell, charactersByCell };
}

/** Lets cells go, and everything drawn only because of them goes too. */
export function forgetCells(state: HousesState, cells: readonly string[]): HousesState {
  const byCell = new Map(state.byCell);
  const omitted = new Map(state.omitted);
  const charactersByCell = new Map(state.charactersByCell);
  const omittedCharacters = new Map(state.omittedCharacters);
  for (const cell of cells) {
    byCell.delete(cell);
    omitted.delete(cell);
    charactersByCell.delete(cell);
    omittedCharacters.delete(cell);
  }
  return { byCell, omitted, charactersByCell, omittedCharacters };
}

/**
 * Replaces what one held cell holds with what a snapshot says, keeping only a higher version of something
 * the snapshot also lists, from a delta that overtook it.
 */
function replaced<T extends { id: string; version: number }>(
  previous: ReadonlyMap<string, T> | undefined,
  arrived: readonly T[],
): Map<string, T> {
  const fresh = new Map<string, T>();
  for (const one of arrived) {
    fresh.set(one.id, one);
  }
  for (const [id, held] of previous ?? []) {
    const listed = fresh.get(id);
    if (listed !== undefined && held.version > listed.version) {
      fresh.set(id, held);
    }
  }
  return fresh;
}

/**
 * Folds one frame from the gateway in. Anything that is not about the map leaves the state untouched.
 *
 * A snapshot is the whole of what the cell holds on the day being looked at, so it replaces the cell: a
 * house it no longer lists is gone, which is exactly how looking at an earlier day empties the map. The
 * one thing kept from before is a higher version of a house the snapshot does list, from a delta that
 * overtook it. The characters standing in the cell are replaced the same way.
 */
export function reduceHouses(state: HousesState, frame: ServerFrame): HousesState {
  switch (frame.type) {
    case 'snapshot': {
      if (!state.byCell.has(frame.cell)) {
        return state;
      }
      const byCell = new Map(state.byCell);
      byCell.set(frame.cell, replaced(state.byCell.get(frame.cell), frame.houses));
      const omitted = new Map(state.omitted);
      omitted.set(frame.cell, frame.omitted ?? 0);
      const charactersByCell = new Map(state.charactersByCell);
      charactersByCell.set(
        frame.cell,
        replaced(state.charactersByCell.get(frame.cell), frame.characters ?? []),
      );
      const omittedCharacters = new Map(state.omittedCharacters);
      omittedCharacters.set(frame.cell, frame.omittedCharacters ?? 0);
      return { byCell, omitted, charactersByCell, omittedCharacters };
    }
    case 'batch': {
      let next = state;
      for (const delta of frame.deltas) {
        switch (delta.type) {
          case 'houseAppeared':
          case 'houseChanged':
            next = landHouse(next, delta.house);
            break;
          case 'characterArrived':
          case 'characterChanged':
            next = standCharacter(next, delta.character);
            break;
          case 'characterGone':
            next = dropCharacter(next, delta.id, delta.version);
            break;
          case 'structureArrived':
            // Said in the log already; held and drawn from the step after. See docs/plans/structures.md.
            break;
        }
      }
      return next;
    }
    case 'resync': {
      // The gateway dropped what it owed us and let the cells go. They are asked for again by whoever
      // drives the connection; here they simply hold nothing until the fresh snapshots arrive.
      const byCell = new Map(state.byCell);
      const omitted = new Map(state.omitted);
      const charactersByCell = new Map(state.charactersByCell);
      const omittedCharacters = new Map(state.omittedCharacters);
      for (const cell of frame.cells) {
        if (byCell.has(cell)) {
          byCell.set(cell, new Map());
          omitted.delete(cell);
          charactersByCell.set(cell, new Map());
          omittedCharacters.delete(cell);
        }
      }
      return { byCell, omitted, charactersByCell, omittedCharacters };
    }
    default:
      return state;
  }
}

/** A house lands in every held cell that contains it, unless that cell already has it at this version. */
function landHouse(state: HousesState, house: HouseView): HousesState {
  let byCell: Map<string, ReadonlyMap<string, HouseView>> | null = null;
  for (const [cell, held] of state.byCell) {
    if (!isInside(house.cell, cell)) {
      continue;
    }
    const known = held.get(house.id);
    if (known !== undefined && known.version >= house.version) {
      continue;
    }
    byCell ??= new Map(state.byCell);
    const updated = new Map(held);
    updated.set(house.id, house);
    byCell.set(cell, updated);
  }
  return byCell === null ? state : { ...state, byCell };
}

/**
 * A character stands in every held cell their place is in, and in no other: one who moved is taken out
 * of the held cells they left, which is the whole difference between a character and a house.
 */
function standCharacter(state: HousesState, character: CharacterOnMapView): HousesState {
  let charactersByCell: Map<string, ReadonlyMap<string, CharacterOnMapView>> | null = null;
  for (const [cell, held] of state.charactersByCell) {
    const known = held.get(character.id);
    if (known !== undefined && known.version >= character.version) {
      continue;
    }
    const here = isInside(character.cell, cell);
    if (!here && known === undefined) {
      continue;
    }
    charactersByCell ??= new Map(state.charactersByCell);
    const updated = new Map(held);
    if (here) {
      updated.set(character.id, character);
    } else {
      updated.delete(character.id);
    }
    charactersByCell.set(cell, updated);
  }
  return charactersByCell === null ? state : { ...state, charactersByCell };
}

/** A character gone from everything this connection holds is taken out of every held cell. */
function dropCharacter(state: HousesState, id: string, version: number): HousesState {
  let charactersByCell: Map<string, ReadonlyMap<string, CharacterOnMapView>> | null = null;
  for (const [cell, held] of state.charactersByCell) {
    const known = held.get(id);
    if (known === undefined || known.version > version) {
      continue;
    }
    charactersByCell ??= new Map(state.charactersByCell);
    const updated = new Map(held);
    updated.delete(id);
    charactersByCell.set(cell, updated);
  }
  return charactersByCell === null ? state : { ...state, charactersByCell };
}

/** The cells being held, in the order they were asked for. */
export function cellsHeld(state: HousesState): string[] {
  return [...state.byCell.keys()];
}

/** The union of what the held cells hold, once each at its highest version, in a stable order. */
function unionOf<T extends { id: string; version: number }>(cells: Iterable<ReadonlyMap<string, T>>): T[] {
  const best = new Map<string, T>();
  for (const held of cells) {
    for (const one of held.values()) {
      const known = best.get(one.id);
      if (known === undefined || one.version > known.version) {
        best.set(one.id, one);
      }
    }
  }
  return [...best.values()].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

/** Every house to draw, once each at its highest version, in a stable order. */
export function housesInView(state: HousesState): HouseView[] {
  return unionOf(state.byCell.values());
}

/** Every character standing in the held cells, once each at their highest version, in a stable order. */
export function charactersInView(state: HousesState): CharacterOnMapView[] {
  return unionOf(state.charactersByCell.values());
}

/** How many houses the held cells hold beyond what was sent. A screen showing most of a crowd says so. */
export function omittedInView(state: HousesState): number {
  let total = 0;
  for (const count of state.omitted.values()) {
    total += count;
  }
  return total;
}
