import { hash2 } from './painterly.ts';
import { ruinsIn } from './ruinLayout.ts';
import type { RuinPiece, RuinsGround } from './ruinLayout.ts';
import { CELL, scatterCell } from './scatter.ts';
import type { Ground, ScatteredPoint } from './scatter.ts';
import type { SpriteMap } from './spriteMap.ts';
import type { StandChunk } from './stands.ts';

/*
 * One cell of the world furnished: the trees the scatter grows there and the ruins of the towns of 1790 standing
 * there, the trees thinned where a town stood. What the page draws a cell from, and the scenery stills, so a still is
 * a plan of the map. See decision record 0104.
 *
 * The trees are thinned after they are scattered, by the ruins alone and never by the dial: no tree stands within a
 * piece's half width and `clear` of it, laid out at the full dial so that a thinner drawing clears the same ground;
 * inside a town's built radius only `core` of the trees are kept at its middle, rising to `built` at its outline, by
 * each tree's own roll; beyond it the land's own woods grow among the outer ruins. So a thinner drawing is still a
 * subset of a fuller one, and a cell with no town near it grows exactly what it grew.
 */

/** A cell's trees, and the pieces of ruins whose feet stand in it, each sorted by rank, the earliest first. */
export interface Furnished {
  readonly trees: ScatteredPoint[];
  readonly ruins: RuinPiece[];
}

/** The ruins as a cell reads them: the layout's ground and the records of the `ruins` layer, a tile at a time. */
export interface RuinsAround {
  readonly ground: RuinsGround;
  readonly standsOf: (tileX: number, tileY: number) => StandChunk;
}

const SEED_KEEP = 0x2b8d;

/** A tree's own roll, from where it stands, for whether a ruined town lets it grow. */
const rollAt = (point: ScatteredPoint): number =>
  hash2(Math.round(point.x * 64) | 0, Math.round(point.y * 64) | 0, SEED_KEEP);

export function furnishCell(
  cellX: number,
  cellY: number,
  dial: number,
  ground: Ground,
  map: SpriteMap,
  ruins: RuinsAround | null,
  spacing = 1,
): Furnished {
  const trees = scatterCell(cellX, cellY, dial, ground, map, spacing);
  if (ruins === null) {
    return { trees, ruins: [] };
  }
  const tileUnits = map.file.world.tileUnits;
  const chunkOf = (x: number, y: number) =>
    ruins.standsOf(Math.floor((x * CELL) / tileUnits), Math.floor((y * CELL) / tileUnits));
  const box = (x: number, y: number) => [x * CELL, y * CELL, (x + 1) * CELL, (y + 1) * CELL] as const;

  const own = chunkOf(cellX, cellY);
  const pieces = own.count === 0 ? [] : ruinsIn(...box(cellX, cellY), own, ruins.ground, dial);

  // Every piece near enough to the cell to clear a tree in it, from the cell and the eight around it, at the full dial.
  const { layout, pieces: specs } = ruins.ground.look;
  const widest = Math.max(...specs.map((spec) => spec.width)) / 2 + layout.trees.clear;
  const near: RuinPiece[] = [];
  for (let y = cellY - 1; y <= cellY + 1; y += 1) {
    for (let x = cellX - 1; x <= cellX + 1; x += 1) {
      const chunk = chunkOf(x, y);
      if (chunk.count === 0) continue;
      for (const piece of ruinsIn(...box(x, y), chunk, ruins.ground, 1)) {
        if (
          piece.x > cellX * CELL - widest &&
          piece.x < (cellX + 1) * CELL + widest &&
          piece.y > cellY * CELL - widest &&
          piece.y < (cellY + 1) * CELL + widest
        ) {
          near.push(piece);
        }
      }
    }
  }
  if (near.length === 0 && own.count === 0) {
    return { trees, ruins: pieces };
  }

  const ring = ruins.ground.look.ring;
  const kept = trees.filter((tree) => {
    for (const piece of near) {
      const clear = specs[piece.piece]!.width / 2 + layout.trees.clear;
      const dx = tree.x - piece.x;
      const dy = tree.y - piece.y;
      if (dx * dx + dy * dy < clear * clear) return false;
    }
    // How far inside the town it stands furthest inside, as a share of its built radius.
    let inside = Infinity;
    for (let at = 0; at < own.count; at += 1) {
      const built = own.reach[at]! / (1 + ring);
      const dx = tree.x - own.x[at]!;
      const dy = tree.y - own.y[at]!;
      inside = Math.min(inside, (dx * dx + dy * dy) / (built * built));
    }
    if (inside >= 1) return true;
    const share = layout.trees.core + (layout.trees.built - layout.trees.core) * Math.sqrt(inside);
    return rollAt(tree) < share;
  });
  return { trees: kept, ruins: pieces };
}
