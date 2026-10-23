import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import type { ImageSource } from 'pixi.js';

import { STAND_TILES } from '@villages/protocol';
import {
  GROUND_LATTICE,
  ROADSIDE_GROWTH_SCALE,
  alongU,
  alongV,
  biomeAt,
  cellOf,
  frameOf,
  wallKey,
} from '@villages/world';
import type { ArtAtlasFile, RoadsMapFile, SpriteMap } from '@villages/world';

import { pixelsPerWorldUnit, standingLayer, tiltGround, toMercatorExact } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { TILE, WORLD_MASTER_WIDTH } from '../../geometry/world';
import { note } from '../../log/log';
import { onStandsArrived, onStandsFollowed, standsVersion, tileKey } from '../../net/stands';
import { readAtlas } from '../atlas';
import { sceneryCellKey } from '../ground/growing';
import { roadsHeld, roadsMap } from '../ground/roads';
import type { HeldPiece } from '../ground/roads';
import { workedGroundStore } from '../ground/settings';
import { WORKED } from '../ground/worked';
import type { Worked } from '../ground/worked';
import { diamondKey } from '../ground/workedGround';
import type { Layer } from '../layer';
import { soonest } from '../layer';
import { spriteMap } from '../scenery/spriteMap';
import { viewCells } from '../scenery/viewCells';
import type { SettlementPictures } from '../settlements/settlementPictures';
import { createArrival } from '../arrival';
import type { RoadsideItem } from './roadsideItems';
import { piecesByOwner, roadsideOfTile, signaturesOf, tilesChanged, tilesOfWayside } from './roadsideTiles';

/*
 * The roadside, drawn: the walls and growth `roadsideItems.ts` lays along the roads the page holds, each a sprite stood
 * on its foot as the scenery's are, the walls from the settlements' atlas and the growth from the scenery's own, nearer
 * ones over further ones. One layer between the roads and everything standing, from zoom 7.5 in: low enough that
 * drawing it under every tree is never wrong by more than its own height, and the trees are kept off the ground it
 * stands on. See docs/plans/houses-bridges-and-road-render.md.
 *
 * Laid out a tile of the stands at a time (`roadsideTiles.ts`): a tile is laid out again when its pieces, or those of
 * a tile about it, come, change or go, or the wayside under it changes, and never otherwise; a few milliseconds of a
 * frame at a time, the tiles nearest the view first, from the moment they arrive rather than at the crossing into the
 * real world (decision record 0119).
 */

export interface RoadsideLayer extends Layer {
  container: Container;
  /** The worked ground, whose wayside is the only ground the roadside stands on. */
  setWorked(worked: ReadonlyMap<number, Worked>): void;
  setTilesRoot(tilesRoot: string): void;
  report(): { items: number };
}

const FRAME = frameOf(GROUND_LATTICE);
/** The scenery's atlas, which the growth is drawn from. */
const SCENERY_ART = '/art/scenery';
/** How many milliseconds of a frame the roadside may spend being laid out, a tile at a time, at least one a frame. */
const LAY_OUT_MS = 3;
/** How many of the scenery's cells a tile of the stands is across. */
const CELLS_A_TILE = TILE / 32;

/** One tile's roadside: its things, the nearer later, their sprites once made, and each thing's index by its cell. */
interface Laid {
  items: RoadsideItem[];
  sprites: (Sprite | null)[];
  byCell: Map<string, number[]>;
}

export function createRoadsideLayer(pictures: SettlementPictures, repaint: () => void): RoadsideLayer {
  const arrival = createArrival();
  const container = new Container();
  container.visible = false;
  // Nearer the camera drawn later, whichever order the sprites first came on screen in.
  container.sortableChildren = true;
  let worked: ReadonlyMap<number, Worked> = new Map();
  let tilesRoot: string | null = null;
  let widths: RoadsMapFile['widths'] | null = null;
  let map: SpriteMap | null = null;
  let growth: Map<string, { texture: Texture; footX: number; footY: number; tall: number }> | null = null;
  let atlas: ImageSource | null = null;
  /** Each tile laid out, by `tileKey`, and the tiles still to lay out again. */
  const laid = new Map<number, Laid>();
  const dirty = new Set<number>();
  /** The pieces held by the tile each belongs to, and a number for each tile's pieces, as of `readVersion`. */
  let owners = new Map<number, HeldPiece[]>();
  let signatures = new Map<number, number>();
  let readVersion = -1;
  /** The road width the tiles were laid out at, and whether every tile is to be laid out again. */
  let laidScale = Number.NaN;
  let everything = true;
  /** The sprites drawn last frame, to put away the ones the view has left. */
  let drawn = new Set<Sprite>();
  let said = -1;
  const stopArriving = onStandsArrived((_, __, layer) => layer === 'roads' && repaint());
  const stopFollowing = onStandsFollowed(repaint);
  const stopWatching = workedGroundStore.watch(repaint);
  const again = () => {
    everything = true;
    repaint();
  };

  /** The growth's pictures, from the scenery's atlas, each kind as tall as it grows by the sprite map. */
  async function readGrowth(of: SpriteMap): Promise<void> {
    const read = await readAtlas<ArtAtlasFile>(SCENERY_ART, "the roadside's growth");
    if (read === null) return;
    atlas?.destroy();
    atlas = read.source;
    growth = new Map();
    for (const kind of of.kinds) {
      const frame = read.file.frames[kind.name];
      if (frame === undefined) continue;
      growth.set(kind.name, {
        texture: new Texture({
          source: read.source,
          frame: new Rectangle(frame.x, frame.y, frame.width, frame.height),
        }),
        footX: frame.footX / frame.width,
        footY: frame.footY / frame.height,
        tall: kind.groundHeight,
      });
    }
    repaint();
  }

  /** The roads held now, and the tiles whose pieces changed since they were last read. */
  function readRoads(): void {
    const version = standsVersion('roads');
    if (version === readVersion) return;
    readVersion = version;
    owners = piecesByOwner(roadsHeld());
    const now = signaturesOf(owners);
    for (const tile of tilesChanged(signatures, now)) dirty.add(tile);
    signatures = now;
  }

  /** A tile's sprites taken away, and the tile laid out again from the pieces about it. */
  function layOut(tile: number, scale: number, of: SpriteMap, drawnWidths: RoadsMapFile['widths']): void {
    const was = laid.get(tile);
    for (const sprite of was?.sprites ?? []) {
      if (sprite === null) continue;
      drawn.delete(sprite);
      sprite.destroy();
    }
    const items = roadsideOfTile(tile, owners, drawnWidths, scale, {
      biome: (x, y) => of.names[biomeAt(of, x, y)] ?? 'none',
      clear: (x, y) =>
        worked.get(diamondKey(Math.floor(alongU(FRAME, x, y)), Math.floor(alongV(FRAME, x, y)))) ===
        WORKED.wayside,
    });
    if (items.length === 0) {
      laid.delete(tile);
      return;
    }
    const byCell = new Map<string, number[]>();
    items.forEach((item, at) => {
      const key = sceneryCellKey(cellOf(item.x), cellOf(item.y));
      const here = byCell.get(key);
      if (here === undefined) byCell.set(key, [at]);
      else here.push(at);
    });
    laid.set(tile, { items, sprites: items.map(() => null), byCell });
  }

  /** As many tiles laid out as the frame's budget allows, the nearest the view first; whether any are left. */
  function layOutSome(view: CameraView): boolean {
    if (widths === null || map === null) return false;
    const scale = workedGroundStore.get().roadWidth;
    if (scale !== laidScale) {
      laidScale = scale;
      everything = true;
    }
    if (everything) {
      everything = false;
      for (const tile of [...laid.keys(), ...owners.keys()]) dirty.add(tile);
    }
    if (dirty.size === 0) return false;
    const centre = toMercatorExact(view.center);
    const [atX, atY] = [(centre.x * WORLD_MASTER_WIDTH) / TILE, (centre.y * WORLD_MASTER_WIDTH) / TILE];
    const away = (tile: number) =>
      ((tile % STAND_TILES) - atX) ** 2 + (Math.floor(tile / STAND_TILES) - atY) ** 2;
    const until = performance.now() + LAY_OUT_MS;
    for (const tile of [...dirty].sort((one, other) => away(one) - away(other))) {
      layOut(tile, scale, map, widths);
      dirty.delete(tile);
      if (performance.now() > until) break;
    }
    let items = 0;
    for (const one of laid.values()) items += one.items.length;
    if (dirty.size === 0 && items !== said) {
      said = items;
      note('roads', `${items} things along the roadside, laid out a tile at a time`);
    }
    return dirty.size > 0;
  }

  return {
    container,

    setWorked(next): void {
      if (next === worked) return;
      for (const tile of tilesOfWayside(worked, next)) dirty.add(tile);
      worked = next;
      repaint();
    },

    setTilesRoot(next: string): void {
      if (next === tilesRoot) return;
      tilesRoot = next;
      widths = null;
      map = null;
      void roadsMap(next).then((file) => {
        if (tilesRoot !== next) return;
        widths = file?.widths ?? null;
        again();
      });
      void spriteMap(next).then((read) => {
        if (tilesRoot !== next || read === null) return;
        map = read;
        if (growth === null) void readGrowth(read);
        again();
      });
    },

    report: () => ({ items: [...laid.values()].reduce((sum, one) => sum + one.items.length, 0) }),

    draw(view: CameraView, _now: number, elapsed: number): number | null {
      readRoads();
      const more = layOutSome(view) ? 0 : null;
      const fade = arrival.step(view.zoom, elapsed);
      if (!workedGroundStore.get().on || fade === 0) {
        container.visible = false;
        return soonest(more, arrival.wants());
      }
      const { scale, x: left, y: top, tilt } = standingLayer(view);
      const perUnit = pixelsPerWorldUnit(view.zoom);
      container.visible = true;
      container.alpha = fade;
      // Only the cells about the view, two deep so a wall or a bush leaning in from beyond its edge is drawn.
      const { fromX, toX, fromY, toY } = viewCells(view, toMercatorExact(view.center), scale, tilt, 2);
      const now = new Set<Sprite>();
      for (let cellY = fromY; cellY <= toY; cellY += 1) {
        for (let cellX = fromX; cellX <= toX; cellX += 1) {
          const tile = laid.get(tileKey(Math.floor(cellX / CELLS_A_TILE), Math.floor(cellY / CELLS_A_TILE)));
          for (const at of tile?.byCell.get(sceneryCellKey(cellX, cellY)) ?? []) {
            const item = tile!.items[at]!;
            const foot = tiltGround(item.x, item.y, tilt);
            const x = foot.x * scale + left;
            const y = foot.y * scale + top;
            if (!(x > -64 && x < view.width + 64 && y > -16 && y < view.height + 96)) continue;
            let sprite = tile!.sprites[at] ?? null;
            if (sprite === null) {
              const made = spriteOf(item);
              if (made === null) continue;
              sprite = made;
              // Nearer the camera, further down the screen, drawn later, across every tile.
              sprite.zIndex = item.y + item.x * 1e-6;
              tile!.sprites[at] = sprite;
              container.addChild(sprite);
            }
            sprite.visible = true;
            sprite.position.set(x, y);
            const tall =
              'wall' in item ? (pictures.of(wallKey(item.wall, item.way))?.tall ?? 0.3) : sizeOf(item);
            sprite.scale.set((tall * perUnit) / sprite.texture.height);
            now.add(sprite);
          }
        }
      }
      for (const sprite of drawn) if (!now.has(sprite)) sprite.visible = false;
      drawn = now;
      return soonest(more, arrival.wants());
    },

    destroy(): void {
      stopArriving();
      stopFollowing();
      stopWatching();
      for (const one of laid.values()) for (const sprite of one.sprites) sprite?.destroy();
      container.destroy();
      atlas?.destroy();
    },
  };

  /** A roadside thing's sprite, stood on its foot; null until its picture is read. */
  function spriteOf(item: RoadsideItem): Sprite | null {
    if ('wall' in item) {
      const picture = pictures.of(wallKey(item.wall, item.way));
      if (picture === null) return null;
      const sprite = new Sprite(picture.texture);
      sprite.anchor.set(picture.foot.x, picture.foot.y);
      return sprite;
    }
    const grows = growth?.get(item.kind);
    if (grows === undefined) return null;
    const sprite = new Sprite(grows.texture);
    sprite.anchor.set(grows.footX, grows.footY);
    return sprite;
  }

  /** How tall a thing of growth is drawn, in world units: smaller than it grows in the open. */
  function sizeOf(item: Extract<RoadsideItem, { kind: string }>): number {
    return (growth?.get(item.kind)?.tall ?? 1) * ROADSIDE_GROWTH_SCALE * item.size;
  }
}
