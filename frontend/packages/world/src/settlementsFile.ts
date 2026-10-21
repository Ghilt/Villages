import type { SettlementBuilding } from './settlementLayout.ts';
import type { SettlementType } from './settlements.ts';

/*
 * Every settlement site of a master as it is filed for the game server, `world/ground/<master>/settlements.json`:
 * its buildings, which the opening raises a structure each of where the world lacks them, and its radius, within which
 * every structure is part of it (decision records 0114 and 0117). A contract between this
 * package and the server: `contracts/fixtures/settlements.json` holds one, written by this, and both ends are tested
 * against it, as the names are (0087).
 */

/** A building of a site as filed: its type of the catalogue, its level, and where its foot stands. */
export interface FiledBuilding {
  readonly type: SettlementBuilding;
  readonly level: number;
  /** `[longitude, latitude]` in the world's own, to seven places. */
  readonly at: readonly [number, number];
}

/** One site as filed: its id, which outlives a repaint, its type and level, its name, its place and its town. */
export interface FiledSite {
  readonly id: string;
  readonly type: SettlementType;
  readonly level: 1 | 2 | 3;
  readonly name: string;
  /** Where its middle stands, `[longitude, latitude]` in the world's own, to seven places. */
  readonly at: readonly [number, number];
  /** The town of 1790 it stands beside, by its Wikidata id, or null in open country. */
  readonly by: string | null;
  /** How far from its middle a structure is part of it, in world units. */
  readonly radius: number;
  /** Its buildings, the lowest-ranked lot first. */
  readonly buildings: readonly FiledBuilding[];
}

export interface SettlementsFiled {
  readonly $comment: string;
  readonly master: string;
  readonly at: string;
  readonly sites: readonly FiledSite[];
}

/** A master's sites as the server reads them, in the order of their ids, each place to seven decimal places. */
export function fileSettlements(
  master: string,
  at: string,
  sites: readonly (Omit<FiledSite, 'at'> & { readonly lng: number; readonly lat: number })[],
): SettlementsFiled {
  return {
    $comment:
      'Written by npm run world:settlements: every settlement site, its radius and its buildings, which the game server raises a structure each of at the opening (decision records 0114 and 0117). Worked out again from world/settlements.json, the tiles, the names and the ruins, never edited.',
    master,
    at,
    sites: [...sites]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map(({ id, type, level, name, lng, lat, by, radius, buildings }) => ({
        id,
        type,
        level,
        name,
        at: [Number(lng.toFixed(7)), Number(lat.toFixed(7))] as const,
        by,
        radius,
        buildings: buildings.map((one) => ({
          type: one.type,
          level: one.level,
          at: [Number(one.at[0].toFixed(7)), Number(one.at[1].toFixed(7))] as const,
        })),
      })),
  };
}
