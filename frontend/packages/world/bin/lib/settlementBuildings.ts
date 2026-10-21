import { GROUND_LATTICE, alongU, alongV, frameOf, worldXOf, worldYOf } from '../../src/lattice.ts';
import { SETTLEMENT_SIDES, settlementIn } from '../../src/settlementLayout.ts';
import type { DiamondFooting, SettlementBuilding } from '../../src/settlementLayout.ts';
import type { SettlementType } from '../../src/settlements.ts';
import type { Culture } from '../../src/structures.ts';

/*
 * A settlement site laid out for `world:settlements`, as the page lays it out (`settlementLayout.ts`), on the same
 * zoom-7 tiles: the lattice corner of its middle, and the foot of every building of it, which the opening raises as a
 * structure each (decision record 0117).
 */

const FRAME = frameOf(GROUND_LATTICE);
/** The classes a building keeps off, and the one it keeps back from, by their names in `world/palette.json`. */
const OPEN_WATER = new Set(['ocean', 'shallow-sea', 'lake']);
const RIVER = 'river';

interface Tiles {
  prepare(fromX: number, fromY: number, toX: number, toY: number): Promise<void>;
  classAt(x: number, y: number): string;
}

/** A building laid out: its type, its level and where its foot is, in world units. */
export interface LaidBuilding {
  readonly type: SettlementBuilding;
  readonly level: number;
  readonly x: number;
  readonly y: number;
}

/** A site laid out: its middle, a corner of the lattice, in world units, and its buildings. */
export interface LaidSite {
  readonly x: number;
  readonly y: number;
  readonly buildings: readonly LaidBuilding[];
}

export async function laySite(
  site: {
    readonly id: string;
    readonly type: SettlementType;
    readonly level: number;
    readonly x: number;
    readonly y: number;
  },
  culture: Culture,
  tiles: Tiles,
): Promise<LaidSite> {
  const u = Math.round(alongU(FRAME, site.x, site.y));
  const v = Math.round(alongV(FRAME, site.x, site.y));
  const reach = SETTLEMENT_SIDES[Math.max(0, Math.min(2, site.level - 1))]! + 8;
  await tiles.prepare(site.x - reach, site.y - reach, site.x + reach, site.y + reach);
  const footing = (du: number, dv: number): DiamondFooting => {
    const name = tiles.classAt(worldXOf(FRAME, du + 0.5, dv + 0.5), worldYOf(FRAME, du + 0.5, dv + 0.5));
    return OPEN_WATER.has(name) ? 'water' : name === RIVER ? 'river' : 'land';
  };
  const laid = settlementIn(site.id, site.type, site.level, culture, u, v, footing);
  const buildings =
    laid === 'unknown'
      ? []
      : laid.buildings.map((one) => ({
          type: one.type,
          level: 1,
          x: worldXOf(FRAME, one.u, one.v),
          y: worldYOf(FRAME, one.u, one.v),
        }));
  return { x: worldXOf(FRAME, u, v), y: worldYOf(FRAME, u, v), buildings };
}
