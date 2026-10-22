import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import type { ImageSource } from 'pixi.js';

import {
  GROUND_LATTICE,
  ROADSIDE_GROWTH_SCALE,
  alongU,
  alongV,
  cellOf,
  biomeAt,
  frameOf,
  readRoadKind,
  wallKey,
} from '@villages/world';
import type { ArtAtlasFile, RoadsMapFile, SpriteMap } from '@villages/world';

import { pixelsPerWorldUnit, standingLayer, tiltGround, toMercatorExact } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { note } from '../../log/log';
import { onStandsArrived, onStandsFollowed, standsVersion } from '../../net/stands';
import { readAtlas } from '../atlas';
import { roadsHeld, roadsMap } from '../ground/roads';
import type { HeldPiece } from '../ground/roads';
import { workedGroundStore } from '../ground/settings';
import { WORKED } from '../ground/worked';
import type { Worked } from '../ground/worked';
import { diamondKey } from '../ground/workedGround';
import type { Layer } from '../layer';
import { sceneryCellKey } from '../ground/growing';
import { spriteMap } from '../scenery/spriteMap';
import { viewCells } from '../scenery/viewCells';
import type { SettlementPictures } from '../settlements/settlementPictures';
import { createArrival } from '../arrival';
import { roadsideAlong } from './roadsideItems';
import type { RoadsideItem } from './roadsideItems';

/*
 * The roadside, drawn: the walls and growth `roadsideItems.ts` lays along the roads the page holds, each a sprite stood
 * on its foot as the scenery's are, the walls from the settlements' atlas and the growth from the scenery's own, nearer
 * ones over further ones. One layer between the roads and everything standing, from zoom 7.5 in: low enough that
 * drawing it under every tree is never wrong by more than its own height, and the trees are kept off the ground it
 * stands on. See docs/plans/houses-bridges-and-road-render.md.
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
/** The grid the road's bands are found by, for keeping the roadside off them, in world units. */
const CELL = 4;

/** Whether a point is on any piece's band, by a grid of the pieces. */
function bandsOf(
  pieces: readonly HeldPiece[],
  widths: RoadsMapFile['widths'],
  scale: number,
): (x: number, y: number) => boolean {
  const grid = new Map<number, { piece: HeldPiece; half: number }[]>();
  const key = (cx: number, cy: number) => cy * 65536 + cx;
  for (const piece of pieces) {
    const kind = readRoadKind(piece.kind);
    if (kind === null) continue;
    const half = (('bridge' in kind ? widths.bridge : widths[kind.road]) / 2) * scale + 0.15;
    const [x0, x1] = [Math.min(piece.ax, piece.bx) - half, Math.max(piece.ax, piece.bx) + half];
    const [y0, y1] = [Math.min(piece.ay, piece.by) - half, Math.max(piece.ay, piece.by) + half];
    for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy += 1) {
      for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx += 1) {
        const held = grid.get(key(cx, cy));
        if (held === undefined) grid.set(key(cx, cy), [{ piece, half }]);
        else held.push({ piece, half });
      }
    }
  }
  return (x, y) =>
    (grid.get(key(Math.floor(x / CELL), Math.floor(y / CELL))) ?? []).some(({ piece, half }) => {
      const dx = piece.bx - piece.ax;
      const dy = piece.by - piece.ay;
      const long = dx * dx + dy * dy;
      const t = long === 0 ? 0 : Math.max(0, Math.min(1, ((x - piece.ax) * dx + (y - piece.ay) * dy) / long));
      return Math.hypot(x - (piece.ax + t * dx), y - (piece.ay + t * dy)) < half;
    });
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
  let items: RoadsideItem[] = [];
  let sprites: (Sprite | null)[] = [];
  /** Each item's index by the cell of the scenery it stands in, so a frame walks only the cells about the view. */
  let byCell = new Map<string, number[]>();
  /** The items drawn last frame, to put away the ones the view has left. */
  let drawn = new Set<number>();
  let stale = true;
  /** The version of the `roads` layer the roadside was laid out from: laid out again only when it moves. */
  let readVersion = -1;
  let said = -1;
  const dirty = () => {
    stale = true;
    repaint();
  };
  const stopArriving = onStandsArrived((_, __, layer) => layer === 'roads' && repaint());
  const stopFollowing = onStandsFollowed(repaint);
  const stopWatching = workedGroundStore.watch(dirty);

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
    dirty();
  }

  function rebuild(): void {
    for (const sprite of sprites) sprite?.destroy();
    sprites = [];
    items = [];
    byCell = new Map();
    drawn = new Set();
    container.removeChildren();
    if (widths === null || map === null) return;
    const pieces = roadsHeld();
    const scale = workedGroundStore.get().roadWidth;
    const of = map;
    items = roadsideAlong(pieces, widths, scale, {
      biome: (x, y) => of.names[biomeAt(of, x, y)] ?? 'none',
      clear: (x, y) =>
        worked.get(diamondKey(Math.floor(alongU(FRAME, x, y)), Math.floor(alongV(FRAME, x, y)))) ===
        WORKED.wayside,
      onRoad: bandsOf(pieces, widths, scale),
    });
    // Nearer the camera, further down the screen, drawn later.
    items.sort((one, other) => one.y - other.y || one.x - other.x);
    sprites = items.map(() => null);
    items.forEach((item, at) => {
      const key = sceneryCellKey(cellOf(item.x), cellOf(item.y));
      const here = byCell.get(key);
      if (here === undefined) byCell.set(key, [at]);
      else here.push(at);
    });
    if (items.length !== said) {
      said = items.length;
      note('roads', `${items.length} things along the roadside`);
    }
  }

  return {
    container,

    setWorked(next): void {
      if (next === worked) return;
      worked = next;
      dirty();
    },

    setTilesRoot(next: string): void {
      if (next === tilesRoot) return;
      tilesRoot = next;
      widths = null;
      map = null;
      void roadsMap(next).then((file) => {
        if (tilesRoot !== next) return;
        widths = file?.widths ?? null;
        dirty();
      });
      void spriteMap(next).then((read) => {
        if (tilesRoot !== next || read === null) return;
        map = read;
        if (growth === null) void readGrowth(read);
        dirty();
      });
    },

    report: () => ({ items: items.length }),

    draw(view: CameraView, _now: number, elapsed: number): number | null {
      const fade = arrival.step(view.zoom, elapsed);
      if (!workedGroundStore.get().on || fade === 0) {
        container.visible = false;
        return arrival.wants();
      }
      const version = standsVersion('roads');
      if (stale || version !== readVersion) {
        rebuild();
        stale = false;
        readVersion = version;
      }
      const { scale, x: left, y: top, tilt } = standingLayer(view);
      const perUnit = pixelsPerWorldUnit(view.zoom);
      container.visible = true;
      container.alpha = fade;
      // Only the cells about the view, two deep so a wall or a bush leaning in from beyond its edge is drawn.
      const { fromX, toX, fromY, toY } = viewCells(view, toMercatorExact(view.center), scale, tilt, 2);
      const now = new Set<number>();
      for (let cellY = fromY; cellY <= toY; cellY += 1) {
        for (let cellX = fromX; cellX <= toX; cellX += 1) {
          for (const at of byCell.get(sceneryCellKey(cellX, cellY)) ?? []) {
            const item = items[at]!;
            const foot = tiltGround(item.x, item.y, tilt);
            const x = foot.x * scale + left;
            const y = foot.y * scale + top;
            if (!(x > -64 && x < view.width + 64 && y > -16 && y < view.height + 96)) continue;
            let sprite = sprites[at] ?? null;
            if (sprite === null) {
              const made = spriteOf(item);
              if (made === null) continue;
              sprite = made;
              sprite.zIndex = at;
              sprites[at] = sprite;
              container.addChild(sprite);
            }
            sprite.visible = true;
            sprite.position.set(x, y);
            const tall =
              'wall' in item ? (pictures.of(wallKey(item.wall, item.way))?.tall ?? 0.3) : sizeOf(item);
            sprite.scale.set((tall * perUnit) / sprite.texture.height);
            now.add(at);
          }
        }
      }
      for (const at of drawn) {
        if (!now.has(at)) {
          const sprite = sprites[at];
          if (sprite) sprite.visible = false;
        }
      }
      drawn = now;
      return arrival.wants();
    },

    destroy(): void {
      stopArriving();
      stopFollowing();
      stopWatching();
      for (const sprite of sprites) sprite?.destroy();
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
