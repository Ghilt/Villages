import { isInside } from '@villages/protocol';
import type { CharacterOnMapView, ServerFrame, StructureView } from '@villages/protocol';

import { landStructure, restamped, structuresOf } from './structures';
import type { StructuresByCell } from './structures';

/**
 * What the map should be drawing, as the gateway has told us cell by cell: the people standing in the held cells
 * and the structures in them. No houses: a house is not drawn on the map, its structures are, its seat among them,
 * and the player's own house arrives on its own.
 *
 * Kept per held cell rather than as one bag, because that is how it arrives and how it goes: a snapshot is the
 * whole of one cell, a delta lands in every held cell that contains what it is about, and letting a cell go takes
 * what it held with it. What is drawn is the union, each counted once. No reference counting, nothing to get out of
 * step. A character who moved is taken out of every held cell their new place is not in, and one who is gone out of
 * all of them (decision record 0055). A structure is replaced by its stamp, because it is sent the face the house
 * last saw and that may be older than the one held (`structures.ts`). Both are held and let go together, so there is
 * one set of cells and never two to keep in step.
 */
export interface OnTheMapState {
  /** Each held cell and the characters standing in it, by character id. A cell is held from the moment it is asked for. */
  readonly charactersByCell: ReadonlyMap<string, ReadonlyMap<string, CharacterOnMapView>>;
  /** How many more characters each cell held than its snapshot carried. */
  readonly omittedCharacters: ReadonlyMap<string, number>;
  /** Each held cell and the structures standing in it, by structure id. */
  readonly structuresByCell: StructuresByCell;
  /** How many more structures each cell held than its snapshot carried. */
  readonly omittedStructures: ReadonlyMap<string, number>;
}

export const NOTHING_ON_THE_MAP: OnTheMapState = {
  charactersByCell: new Map(),
  omittedCharacters: new Map(),
  structuresByCell: new Map(),
  omittedStructures: new Map(),
};

/** Starts holding cells, empty until their snapshots come, so a delta arriving first has somewhere to land. */
export function holdCells(state: OnTheMapState, cells: readonly string[]): OnTheMapState {
  const charactersByCell = new Map(state.charactersByCell);
  const structuresByCell = new Map(state.structuresByCell);
  for (const cell of cells) {
    if (!charactersByCell.has(cell)) {
      charactersByCell.set(cell, new Map());
    }
    if (!structuresByCell.has(cell)) {
      structuresByCell.set(cell, new Map());
    }
  }
  return { ...state, charactersByCell, structuresByCell };
}

/** Lets cells go, and everything drawn only because of them goes too. */
export function forgetCells(state: OnTheMapState, cells: readonly string[]): OnTheMapState {
  const charactersByCell = new Map(state.charactersByCell);
  const omittedCharacters = new Map(state.omittedCharacters);
  const structuresByCell = new Map(state.structuresByCell);
  const omittedStructures = new Map(state.omittedStructures);
  for (const cell of cells) {
    charactersByCell.delete(cell);
    omittedCharacters.delete(cell);
    structuresByCell.delete(cell);
    omittedStructures.delete(cell);
  }
  return { charactersByCell, omittedCharacters, structuresByCell, omittedStructures };
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
 * A snapshot is the whole of what the cell holds on the day being looked at, so it replaces the cell: someone it no
 * longer lists is gone, which is exactly how looking at an earlier day empties the map. The one thing kept from
 * before is a higher version of someone the snapshot does list, from a delta that overtook it; its structures are
 * replaced by their stamps.
 */
export function reduceOnTheMap(state: OnTheMapState, frame: ServerFrame): OnTheMapState {
  switch (frame.type) {
    case 'snapshot': {
      if (!state.charactersByCell.has(frame.cell)) {
        return state;
      }
      const charactersByCell = new Map(state.charactersByCell);
      charactersByCell.set(
        frame.cell,
        replaced(state.charactersByCell.get(frame.cell), frame.characters ?? []),
      );
      const omittedCharacters = new Map(state.omittedCharacters);
      omittedCharacters.set(frame.cell, frame.omittedCharacters ?? 0);
      const structuresByCell = new Map(state.structuresByCell);
      structuresByCell.set(
        frame.cell,
        restamped(state.structuresByCell.get(frame.cell), frame.structures ?? [], frame.structuresAsOf ?? 0),
      );
      const omittedStructures = new Map(state.omittedStructures);
      omittedStructures.set(frame.cell, frame.omittedStructures ?? 0);
      return { charactersByCell, omittedCharacters, structuresByCell, omittedStructures };
    }
    case 'batch': {
      let next = state;
      for (const delta of frame.deltas) {
        switch (delta.type) {
          case 'characterArrived':
          case 'characterChanged':
            next = standCharacter(next, delta.character);
            break;
          case 'characterGone':
            next = dropCharacter(next, delta.id, delta.version);
            break;
          case 'structureArrived':
          case 'structureChanged':
            next = raiseStructure(next, delta.structure);
            break;
        }
      }
      return next;
    }
    case 'resync': {
      // The gateway dropped what it owed us and let the cells go. They are asked for again by whoever
      // drives the connection; here they simply hold nothing until the fresh snapshots arrive.
      const charactersByCell = new Map(state.charactersByCell);
      const omittedCharacters = new Map(state.omittedCharacters);
      const structuresByCell = new Map(state.structuresByCell);
      const omittedStructures = new Map(state.omittedStructures);
      for (const cell of frame.cells) {
        if (charactersByCell.has(cell)) {
          charactersByCell.set(cell, new Map());
          omittedCharacters.delete(cell);
          structuresByCell.set(cell, new Map());
          omittedStructures.delete(cell);
        }
      }
      return { charactersByCell, omittedCharacters, structuresByCell, omittedStructures };
    }
    default:
      return state;
  }
}

/** A structure raised or changed lands in every held cell that contains it, by its stamp. See `structures.ts`. */
function raiseStructure(state: OnTheMapState, structure: StructureView): OnTheMapState {
  const structuresByCell = landStructure(state.structuresByCell, structure);
  return structuresByCell === null ? state : { ...state, structuresByCell };
}

/**
 * A character stands in every held cell their place is in, and in no other: one who moved is taken out
 * of the held cells they left.
 */
function standCharacter(state: OnTheMapState, character: CharacterOnMapView): OnTheMapState {
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
function dropCharacter(state: OnTheMapState, id: string, version: number): OnTheMapState {
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
export function cellsHeld(state: OnTheMapState): string[] {
  return [...state.charactersByCell.keys()];
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

/** Every character standing in the held cells, once each at their highest version, in a stable order. */
export function charactersInView(state: OnTheMapState): CharacterOnMapView[] {
  return unionOf(state.charactersByCell.values());
}

/** Every structure standing in the held cells, once each at its latest face, in a stable order. */
export function structuresInView(state: OnTheMapState): StructureView[] {
  return structuresOf(state.structuresByCell);
}
