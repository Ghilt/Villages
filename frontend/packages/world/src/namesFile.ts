import type { NameKind, WorldName } from './names.ts';
import type { EarthRegion, RegionGrid, RegionKind, RegionLabel } from './regions.ts';

/**
 * A master's names as they are filed, for whatever reads them: `names.json`, every name carried into the world
 * and every named region, and `regions.bin` beside it, which region every square of the origin map is in and by.
 * The page reads the copy beside the tiles and the game server the one beside the ground map, and the two are
 * the same bytes. A contract between this package and the server: `contracts/fixtures/names.json` holds one,
 * written by this, and both ends are tested against it. See decision record 0087.
 */

/** A named region as filed: what it is, and where its name goes and how many squares it covers, for one that has any. */
export type FiledRegion = Omit<EarthRegion, 'polygons'> & Partial<RegionLabel>;

export interface NamesFile {
  readonly $comment: string;
  readonly master: string;
  /** Today's names, unless a name says otherwise: each name's own `form` is the one to read. */
  readonly form: 'today';
  /** How many of each kind are in the world: the names, and the regions given to any square. */
  readonly counts: Readonly<Record<NameKind | RegionKind, number>>;
  /** The origin map's squares across and down, a row at a time from the north-west: what `regions.bin` numbers. */
  readonly columns: number;
  readonly rows: number;
  readonly names: readonly WorldName[];
  /** What `regions.bin` counts from one: its first layer the land each square is in, its second the sea it is by. */
  readonly regions: readonly FiledRegion[];
}

/** The regions as worked out for a master: the list, which of them each square has, and where each one's name goes. */
export interface GivenRegions {
  readonly list: readonly EarthRegion[];
  readonly given: RegionGrid;
  readonly labels: readonly (RegionLabel | null)[];
}

/**
 * The file, and the regions' two layers as bytes, or none where the regions were not worked out. Each layer is a
 * little-endian sixteen-bit number a square, nought for none, the land layer first.
 */
export function fileNames(
  master: string,
  names: readonly WorldName[],
  regions: GivenRegions | null,
  columns: number,
  rows: number,
): { file: NamesFile; bytes: Uint8Array | null } {
  const counts = { river: 0, lake: 0, peak: 0, town: 0, sea: 0, land: 0 };
  for (const one of names) counts[one.kind] += 1;
  let bytes: Uint8Array | null = null;
  if (regions !== null) {
    const { land, sea } = regions.given;
    for (const k of new Set([...land, ...sea])) if (k > 0) counts[regions.list[k - 1]!.kind] += 1;
    const view = new DataView(new ArrayBuffer((land.length + sea.length) * 2));
    land.forEach((k, at) => view.setUint16(at * 2, k, true));
    sea.forEach((k, at) => view.setUint16((land.length + at) * 2, k, true));
    bytes = new Uint8Array(view.buffer);
  }
  const file: NamesFile = {
    $comment:
      'Written by npm run world:names or world:origin. Output: carried again from the origin map. See 0087.',
    master,
    form: 'today',
    counts,
    columns,
    rows,
    names,
    regions: (regions?.list ?? []).map(({ id, kind, name, also, form, feature, rank, from }, index) => ({
      ...{ id, kind, name },
      ...(also === undefined ? {} : { also }),
      ...(form === undefined ? {} : { form }),
      feature,
      ...(rank === undefined ? {} : { rank }),
      ...(from === undefined ? {} : { from }),
      ...regions?.labels[index],
    })),
  };
  return { file, bytes };
}
