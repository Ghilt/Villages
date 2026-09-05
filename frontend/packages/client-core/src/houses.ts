import { isInside } from '@villages/protocol';
import type { HouseView, ServerFrame } from '@villages/protocol';

/**
 * What the map should be drawing, as the gateway has told us cell by cell.
 *
 * Kept per held cell rather than as one bag of houses, because that is how it arrives and how it goes:
 * a snapshot is the whole of one cell, a delta lands in every held cell that contains the house, and
 * letting a cell go takes its houses with it. What is drawn is the union, a house counted once at its
 * highest version. No reference counting, nothing to get out of step.
 */
export interface HousesState {
  /** Each held cell and what it holds, by house id. A cell is held from the moment it is asked for. */
  readonly byCell: ReadonlyMap<string, ReadonlyMap<string, HouseView>>;
  /** How many more each cell held than its snapshot carried, so the count on screen is never a lie. */
  readonly omitted: ReadonlyMap<string, number>;
}

export const NO_HOUSES: HousesState = { byCell: new Map(), omitted: new Map() };

/** Starts holding cells, empty until their snapshots come, so a delta arriving first has somewhere to land. */
export function holdCells(state: HousesState, cells: readonly string[]): HousesState {
  const byCell = new Map(state.byCell);
  for (const cell of cells) {
    if (!byCell.has(cell)) {
      byCell.set(cell, new Map());
    }
  }
  return { ...state, byCell };
}

/** Lets cells go, and everything drawn only because of them goes too. */
export function forgetCells(state: HousesState, cells: readonly string[]): HousesState {
  const byCell = new Map(state.byCell);
  const omitted = new Map(state.omitted);
  for (const cell of cells) {
    byCell.delete(cell);
    omitted.delete(cell);
  }
  return { byCell, omitted };
}

/**
 * Folds one frame from the gateway in. Anything that is not about houses leaves the state untouched.
 *
 * A snapshot is what the cell held when it was read; a delta that arrived before it, from a change made
 * after that reading, is newer and is kept. So a snapshot replaces a cell except where the cell already
 * holds a higher version of the same house.
 */
export function reduceHouses(state: HousesState, frame: ServerFrame): HousesState {
  switch (frame.type) {
    case 'snapshot': {
      const previous = state.byCell.get(frame.cell);
      if (previous === undefined) {
        return state;
      }
      const fresh = new Map<string, HouseView>();
      for (const house of frame.houses) {
        fresh.set(house.id, house);
      }
      for (const [id, held] of previous) {
        const arrived = fresh.get(id);
        if (arrived === undefined || held.version > arrived.version) {
          fresh.set(id, held);
        }
      }
      const byCell = new Map(state.byCell);
      byCell.set(frame.cell, fresh);
      const omitted = new Map(state.omitted);
      omitted.set(frame.cell, frame.omitted ?? 0);
      return { byCell, omitted };
    }
    case 'batch': {
      let byCell: Map<string, ReadonlyMap<string, HouseView>> | null = null;
      for (const delta of frame.deltas) {
        const house = delta.house;
        for (const [cell, held] of state.byCell) {
          if (!isInside(house.cell, cell)) {
            continue;
          }
          const known = (byCell ?? state.byCell).get(cell)?.get(house.id);
          if (known !== undefined && known.version >= house.version) {
            continue;
          }
          byCell ??= new Map(state.byCell);
          const updated = new Map(byCell.get(cell) ?? held);
          updated.set(house.id, house);
          byCell.set(cell, updated);
        }
      }
      return byCell === null ? state : { ...state, byCell };
    }
    case 'resync': {
      // The gateway dropped what it owed us and let the cells go. They are asked for again by whoever
      // drives the connection; here they simply hold nothing until the fresh snapshots arrive.
      const byCell = new Map(state.byCell);
      const omitted = new Map(state.omitted);
      for (const cell of frame.cells) {
        if (byCell.has(cell)) {
          byCell.set(cell, new Map());
          omitted.delete(cell);
        }
      }
      return { byCell, omitted };
    }
    default:
      return state;
  }
}

/** The cells being held, in the order they were asked for. */
export function cellsHeld(state: HousesState): string[] {
  return [...state.byCell.keys()];
}

/** Every house to draw, once each at its highest version, in a stable order. */
export function housesInView(state: HousesState): HouseView[] {
  const best = new Map<string, HouseView>();
  for (const held of state.byCell.values()) {
    for (const house of held.values()) {
      const known = best.get(house.id);
      if (known === undefined || house.version > known.version) {
        best.set(house.id, house);
      }
    }
  }
  return [...best.values()].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

/** How many houses the held cells hold beyond what was sent. A screen showing most of a crowd says so. */
export function omittedInView(state: HousesState): number {
  let total = 0;
  for (const count of state.omitted.values()) {
    total += count;
  }
  return total;
}
