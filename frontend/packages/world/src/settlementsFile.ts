import type { SettlementType } from './settlements.ts';

/*
 * Every settlement site of a master as it is filed for the game server, `world/ground/<master>/settlements.json`:
 * what the opening raises a settlement on, one a site the world lacks (decision record 0114). A contract between this
 * package and the server: `contracts/fixtures/settlements.json` holds one, written by this, and both ends are tested
 * against it, as the names are (0087).
 */

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
      'Written by npm run world:settlements: every settlement site, which the game server raises a settlement on at the opening (decision record 0114). Worked out again from world/settlements.json, the tiles, the names and the ruins, never edited.',
    master,
    at,
    sites: [...sites]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map(({ id, type, level, name, lng, lat, by }) => ({
        id,
        type,
        level,
        name,
        at: [Number(lng.toFixed(7)), Number(lat.toFixed(7))] as const,
        by,
      })),
  };
}
