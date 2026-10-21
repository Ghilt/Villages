import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import type { ImageSource } from 'pixi.js';

import {
  GROUND_LATTICE,
  ROADSIDE_GROWTH_SCALE,
  alongU,
  alongV,
  biomeAt,
  frameOf,
  readRoadKind,
  wallKey,
} from '@villages/world';
import type { ArtAtlasFile, RoadsMapFile, SpriteMap } from '@villages/world';

import { pixelsPerWorldUnit, standingLayer, tiltGround } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { note } from '../../log/log';
import { heldStandsOf, onStandsArrived, onStandsFollowed } from '../../net/stands';
import { readAtlas } from '../atlas';
import { piecesHeld, roadsMap } from '../ground/roads';
import type { HeldPiece } from '../ground/roads';
import { workedGroundStore } from '../ground/settings';
import { WORKED } from '../ground/worked';
import type { Worked } from '../ground/worked';
import { diamondKey } from '../ground/workedGround';
import type { Layer } from '../layer';
import { spriteMap } from '../scenery/spriteMap';
import type { SettlementPictures } from '../settlements/settlementPictures';
import { BECOMES_A_MARK_AT } from '../twoForms';
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

const smoothstep = (from: number, to: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

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
  let stale = true;
  let said = -1;
  const dirty = () => {
    stale = true;
    repaint();
  };
  const stopArriving = onStandsArrived((_, __, layer) => layer === 'roads' && dirty());
  const stopFollowing = onStandsFollowed(dirty);
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
    container.removeChildren();
    if (widths === null || map === null) return;
    const pieces = piecesHeld(
      [...heldStandsOf('roads')].flatMap((tile) => (tile.roads === undefined ? [] : [tile.roads])),
    );
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

    draw(view: CameraView): number | null {
      const fade = smoothstep(BECOMES_A_MARK_AT, BECOMES_A_MARK_AT + 0.5, view.zoom);
      if (!workedGroundStore.get().on || fade === 0) {
        container.visible = false;
        return null;
      }
      if (stale) {
        rebuild();
        stale = false;
      }
      const { scale, x: left, y: top, tilt } = standingLayer(view);
      const perUnit = pixelsPerWorldUnit(view.zoom);
      container.visible = true;
      container.alpha = fade;
      items.forEach((item, at) => {
        const foot = tiltGround(item.x, item.y, tilt);
        const x = foot.x * scale + left;
        const y = foot.y * scale + top;
        const near = x > -64 && x < view.width + 64 && y > -16 && y < view.height + 96;
        let sprite = sprites[at] ?? null;
        if (!near) {
          if (sprite !== null) sprite.visible = false;
          return;
        }
        if (sprite === null) {
          const made = spriteOf(item);
          if (made === null) return;
          sprite = made;
          sprite.zIndex = at;
          sprites[at] = sprite;
          container.addChild(sprite);
        }
        sprite.visible = true;
        sprite.position.set(x, y);
        const tall = 'wall' in item ? (pictures.of(wallKey(item.wall, item.way))?.tall ?? 0.3) : sizeOf(item);
        sprite.scale.set((tall * perUnit) / sprite.texture.height);
      });
      return null;
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
