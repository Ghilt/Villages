import { CULTURES, NO_STANDS, RUIN_PIECES, ruinFrameKey } from '@villages/world';
import type {
  Kind,
  RuinPiece,
  RuinsAround,
  RuinsMapFile,
  ScatteredPoint,
  SpriteMap,
  StandChunk,
  TerrainClass,
} from '@villages/world';

/**
 * The ruined towns of 1790 as the scenery draws them: the master's ruins map, fetched once, and the pieces of the
 * ruins as kinds of scenery after the sprite map's own, so one layer draws trees and ruins and sorts them in depth
 * together. Where a town is comes only from the stands the gateway sends of the `ruins` layer, as far as the fog lets
 * them through; this says how to lay one out. See decision records 0103 and 0104.
 */

const files = new Map<string, Promise<RuinsMapFile | null>>();

/** The ruins map of a master, or null where `world:ruins` has laid none: then no town is a ruin on its map. */
export function ruinsMap(tilesRoot: string): Promise<RuinsMapFile | null> {
  let already = files.get(tilesRoot);
  if (already === undefined) {
    already = fetch(`${tilesRoot}/sprites/ruins/map.json`, { cache: 'no-store' })
      .then((answer) => (answer.ok ? (answer.json() as Promise<RuinsMapFile>) : null))
      .catch(() => null);
    files.set(tilesRoot, already);
  }
  return already;
}

/** Everything read is thrown away, for a master laid in ruins again. */
export function forgetRuinsMap(): void {
  files.clear();
}

/**
 * Each piece in each culture as a kind of scenery, named as its frame in the scenery's atlas: as tall as the piece
 * stands, never swaying, and set apart by nothing, so the trees' own spacing is not touched by them.
 */
export function ruinKinds(file: RuinsMapFile): Kind[] {
  return RUIN_PIECES.flatMap((piece, at) =>
    CULTURES.map((culture) => {
      const spec = file.look.pieces[at]!;
      return {
        name: ruinFrameKey(piece, culture),
        groundHeight: spec.height,
        vary: spec.vary,
        order: 10,
        gather: 0,
        apart: 0,
        underCanopy: true,
      };
    }),
  );
}

/** The sprite map the scenery is drawn by: its own kinds, then every piece of the ruins in every culture. */
export function withRuins(map: SpriteMap, file: RuinsMapFile | null): SpriteMap {
  return file === null ? map : { ...map, kinds: [...map.kinds, ...ruinKinds(file)] };
}

/** A piece of the ruins as a point of scenery: its kind after the sprite map's own, and the rest as it stands. */
export function asScenery(map: SpriteMap, piece: RuinPiece): ScatteredPoint {
  return {
    x: piece.x,
    y: piece.y,
    kind: map.kinds.length + piece.piece * CULTURES.length + piece.culture,
    rank: piece.rank,
    height: piece.height,
  };
}

/** Where a cell keeps a tile of the ruins in its records and its waits, apart from the same tile's scenery. */
export const RUINS_TILE = 1 << 20;

/**
 * What a cell lays the ruins out with: how to read a record, the terrain under it and which classes are water, and the
 * ruins' stands it holds, by tile as `x/y`.
 */
export function ruinsAround(
  file: RuinsMapFile,
  classAt: (worldX: number, worldY: number) => number,
  classes: readonly TerrainClass[],
  held: ReadonlyMap<string, StandChunk>,
): RuinsAround {
  const water = new Set(classes.filter((one) => one.water === true).map((one) => one.id));
  return {
    ground: {
      look: { ...file.look, ring: file.ring },
      side: file.world.side,
      classAt,
      water: (terrain) => water.has(terrain),
    },
    standsOf: (tileX, tileY) => held.get(`${tileX}/${tileY}`) ?? NO_STANDS,
  };
}
