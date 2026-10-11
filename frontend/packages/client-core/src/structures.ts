import { isInside } from '@villages/protocol';
import type { StructureView } from '@villages/protocol';

/**
 * The structures standing in the held cells, kept beside the houses and the characters in `houses.ts` and held and
 * let go with them, so there is still one set of cells.
 *
 * **A copy is replaced by its stamp, not kept by its version.** A house's snapshot keeps a held copy at a higher
 * version, because a house only ever moves forward. A structure's face does not: looking at an earlier day, or at
 * ground the house no longer sees, is sent an older face on purpose, the one it last saw. So a snapshot replaces
 * every copy stamped no later than it was read, older face or not, and keeps only a copy stamped after, which came
 * from a change the snapshot had not seen. See docs/plans/structures.md and decision record 0061.
 */
export type StructuresByCell = ReadonlyMap<string, ReadonlyMap<string, StructureView>>;

/**
 * What one held cell holds after its snapshot: everything it lists, as listed, and of what was held before only a
 * copy stamped later than `asOf`, whether the snapshot lists it or not.
 */
export function restamped(
  previous: ReadonlyMap<string, StructureView> | undefined,
  arrived: readonly StructureView[],
  asOf: number,
): Map<string, StructureView> {
  const fresh = new Map<string, StructureView>();
  for (const one of arrived) {
    fresh.set(one.id, one);
  }
  for (const [id, held] of previous ?? []) {
    if (held.stamp > asOf) {
      fresh.set(id, held);
    }
  }
  return fresh;
}

/**
 * A structure raised, or changed, lands in every held cell that contains it, unless the copy there is stamped as
 * late. Null when it changed nothing, so the state is left as it was.
 */
export function landStructure(byCell: StructuresByCell, structure: StructureView): StructuresByCell | null {
  let landed: Map<string, ReadonlyMap<string, StructureView>> | null = null;
  for (const [cell, held] of byCell) {
    if (!isInside(structure.cell, cell)) {
      continue;
    }
    const known = held.get(structure.id);
    if (known !== undefined && known.stamp >= structure.stamp) {
      continue;
    }
    landed ??= new Map(byCell);
    const updated = new Map(held);
    updated.set(structure.id, structure);
    landed.set(cell, updated);
  }
  return landed;
}

/** Every structure the held cells hold, once each at its latest stamp, in a stable order. */
export function structuresOf(byCell: StructuresByCell): StructureView[] {
  const latest = new Map<string, StructureView>();
  for (const held of byCell.values()) {
    for (const one of held.values()) {
      const known = latest.get(one.id);
      if (known === undefined || one.stamp > known.stamp) {
        latest.set(one.id, one);
      }
    }
  }
  return [...latest.values()].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}
