import { Container, ImageSource, Rectangle, Sprite, Texture } from 'pixi.js';

import { CELL } from '@villages/world';
import type { CritterAtlasFile } from '@villages/world';

import * as camera from '../../geometry/cameraMath';
import { classesOfTile, terrainPalette } from '../../geometry/terrainClasses';
import { FLAT_MAX_ZOOM, TILE, WORLD_MASTER_WIDTH } from '../../geometry/world';
import { note } from '../../log/log';
import { visionAt } from '../../fog/fogField';
import type { FogField } from '../../fog/fogField';
import { SHADE_COLOUR, towardsTheLight } from '../../map/light';
import { drawnAt } from '../../shaders/levels';
import type { Layer } from '../layer';
import { currentPointsOf, sceneryMap } from '../scenery/sceneryCells';

import { critterCellOf, eventsAt, posesOf } from './critterClock';
import type { Ground } from './critterClock';
import { CRITTERS_LOOK } from './look';

/**
 * The critters, as two layers of the sprite canvas: their shadows on the ground under the scenery, so a tree in front
 * of one hides it, and the critters themselves in the air over the scenery and under every mark. Both are in the
 * container the fog takes the colour out of, so they are hazed with the trees; and they come only where the house sees
 * now, so the land in sight is the living land and what is only remembered holds still.
 *
 * Every frame it asks the clock (`critterClock.ts`) what is in flight over the view - which reads the very trees and
 * bushes the scenery drew, the ground's class under them and the fog's sight - and places a sprite for each, a frame of
 * its kind's strip from the atlas `world:critters` cuts, and a soft shadow under it, away from the light by its height.
 * While one is in flight it asks for frames at its level's rate, and a few a second otherwise, so the next is seen
 * leaving. One first seen already in flight, where the view has just moved to, fades up, so nothing pops. A player
 * who asked for less motion gets none. See docs/plans/living-world.md.
 */

const L = CRITTERS_LOOK;
const ART = '/art/critters';
/** What the dev server says when it has cut the critters again, `vite/crittersArtApi.ts`. */
const CRITTERS_CUT = 'villages:critters-cut';
/** How soon to look again when nothing is in flight, so the next to leave is caught as it does. */
const WATCHING_MS = 250;
/** How long one first seen in flight takes to fade up. */
const ARRIVING_MS = 250;
/** How far below a bird its shadow falls, away from the light, as a share of its height, and how dark it is. */
const SHADOW_REACH = 0.5;
const SHADOW_ALPHA = 0.5;

export interface CritterLayer extends Layer {
  /** The critters' shadows, to go under the scenery. */
  shadows: Container;
  /** The critters themselves, to go over it. */
  flying: Container;
}

/** What the scenery is drawn with, so the critters come out of the same trees: as the renderer's scene says it. */
export interface SceneryHow {
  on: boolean;
  tilesRoot: string;
  dial: number;
  spacing: number;
}

const ramp = (from: number, to: number, value: number): number =>
  Math.min(1, Math.max(0, (value - from) / (to - from)));

/** A soft dark oval, the shadow every critter casts, drawn once. */
function shadowTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 16;
  const paint = canvas.getContext('2d')!;
  const [r, g, b] = SHADE_COLOUR.map((one) => Math.round(one * 255));
  const fall = paint.createRadialGradient(16, 8, 0, 16, 8, 8);
  fall.addColorStop(0, `rgba(${r},${g},${b},1)`);
  fall.addColorStop(1, `rgba(${r},${g},${b},0)`);
  paint.setTransform(2, 0, 0, 1, 0, 0);
  paint.fillStyle = fall;
  paint.fillRect(0, 0, 16, 16);
  return Texture.from(canvas);
}

/**
 * What the renderer knows that the critters need, read every frame: how the scenery is drawn, and what the house sees
 * now - undefined with the fog lifted, where everything is seen, and null for a house that sees nothing.
 */
export interface CritterSurroundings {
  scenery: SceneryHow;
  sight: FogField | null | undefined;
}

export function createCritterLayer(repaint: () => void, around: () => CritterSurroundings): CritterLayer {
  const scenery = () => around().scenery;
  const shadows = new Container();
  const flying = new Container();
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shade = shadowTexture();
  let frames = new Map<string, Texture[]>();
  let feet = new Map<string, { x: number; y: number }>();
  let atlas: ImageSource | null = null;
  let loading = false;
  let noArt = false;

  /** The atlas, fetched once and again whenever the dev server cuts it again. */
  async function loadArt(): Promise<void> {
    loading = true;
    try {
      const listed = await fetch(`${ART}.json`, { cache: 'no-store' });
      if (!listed.ok) {
        noArt = true;
        note(
          'critters',
          'no critters have been cut, so none fly. Run npm run world:critters --prefix frontend',
        );
        return;
      }
      const file = (await listed.json()) as CritterAtlasFile;
      const picture = await fetch(`${ART}.webp?v=${file.version}`);
      const bitmap = await createImageBitmap(await picture.blob(), { premultiplyAlpha: 'premultiply' });
      const source = new ImageSource({
        resource: bitmap,
        alphaMode: 'premultiplied-alpha',
        autoGenerateMipmaps: true,
        scaleMode: 'linear',
      });
      frames = new Map(
        Object.entries(file.kinds).map(([kind, cut]) => [
          kind,
          cut.frames.map((key) => {
            const at = file.frames[key]!;
            return new Texture({ source, frame: new Rectangle(at.x, at.y, at.width, at.height) });
          }),
        ]),
      );
      feet = new Map(
        Object.entries(file.kinds).map(([kind, cut]) => {
          const first = file.frames[cut.frames[0]!]!;
          return [kind, { x: cut.footX / first.width, y: cut.footY / first.height }];
        }),
      );
      atlas?.destroy();
      atlas = source;
      noArt = false;
      repaint();
    } catch (cause) {
      noArt = true;
      note('critters', `the critters could not be read: ${(cause as Error).message}`);
    } finally {
      loading = false;
    }
  }
  const cutAgain = () => void loadArt();
  import.meta.hot?.on(CRITTERS_CUT, cutAgain);

  // The terrain class of every world unit under the view, a zoom 7 tile at a time, asked for as it is needed.
  let names: string[] | null = null;
  let askedForNames = false;
  const classes = new Map<string, Uint8Array | null | 'asking'>();
  function classAt(x: number, y: number): string | null {
    const root = scenery().tilesRoot;
    if (names === null) {
      if (!askedForNames) {
        askedForNames = true;
        void terrainPalette().then((palette) => {
          names = [];
          for (const one of palette.classes) names[one.id] = one.name;
          repaint();
        });
      }
      return null;
    }
    const tileX = Math.floor(x / TILE);
    const tileY = Math.floor(y / TILE);
    const key = `${root}/${tileX}/${tileY}`;
    const held = classes.get(key);
    if (held === undefined) {
      classes.set(key, 'asking');
      void terrainPalette()
        .then((palette) => classesOfTile(root, FLAT_MAX_ZOOM, tileX, tileY, palette))
        .then((tile) => {
          classes.set(key, tile);
          repaint();
        });
      return null;
    }
    if (held === null || held === 'asking') return null;
    return names[held[(Math.floor(y) - tileY * TILE) * TILE + (Math.floor(x) - tileX * TILE)]!] ?? null;
  }

  const ground: Ground = {
    coverIn(fromX, fromY, toX, toY) {
      const how = scenery();
      const map = sceneryMap();
      if (!how.on || map === null) return null;
      const points = currentPointsOf(
        how.tilesRoot,
        Math.floor(fromX / CELL),
        Math.floor(fromY / CELL),
        how.dial,
        how.spacing,
        repaint,
      );
      if (points === undefined) return null;
      return points
        .filter((point) => point.x >= fromX && point.x < toX && point.y >= fromY && point.y < toY)
        .map((point) => ({
          x: point.x,
          y: point.y,
          kind: map.kinds[point.kind]?.name ?? '',
          height: point.height,
        }));
    },
    classAt,
    sees(x, y) {
      const sight = around().sight;
      return sight === undefined ? true : sight !== null && visionAt(sight, x, y);
    },
  };

  /** When each critter on the screen was first seen, so one first seen in flight fades up. */
  const firstSeen = new Map<string, number>();
  const sprites: Sprite[] = [];
  const shapes: Sprite[] = [];
  const spriteAt = (pool: Sprite[], into: Container, at: number, texture: Texture): Sprite => {
    let sprite = pool[at];
    if (sprite === undefined) {
      sprite = new Sprite(texture);
      pool.push(sprite);
      into.addChild(sprite);
    }
    sprite.texture = texture;
    sprite.visible = true;
    return sprite;
  };

  return {
    shadows,
    flying,

    draw(view: camera.CameraView): number | null {
      const level = drawnAt('low');
      const fade = ramp(L.fromZoom, L.wholeAt, view.zoom);
      let drawn = 0;
      let wanted: number | null = null;
      if (level !== 'off' && !still && fade > 0 && !noArt) {
        if (atlas === null && !loading) void loadArt();
        if (atlas !== null) {
          const layer = camera.standingLayer(view);
          const centre = camera.toMercatorExact(view.center);
          const corners = [
            [0, 0],
            [view.width, 0],
            [0, view.height],
            [view.width, view.height],
          ].map(([x = 0, y = 0]) => camera.untiltGround(x - view.width / 2, y - view.height / 2, layer.tilt));
          const east = corners.map((one) => centre.x * WORLD_MASTER_WIDTH + one.east / layer.scale);
          const south = corners.map((one) => centre.y * WORLD_MASTER_WIDTH + one.south / layer.scale);
          // A ring of cells past the edges, so a bird flying in from just off the screen is there as it arrives.
          const cells = {
            fromX: critterCellOf(Math.min(...east)) - 1,
            toX: critterCellOf(Math.max(...east)) + 1,
            fromY: critterCellOf(Math.min(...south)) - 1,
            toY: critterCellOf(Math.max(...south)) + 1,
          };
          const now = Date.now();
          const events = eventsAt(cells, now / 1000, L.density, ground);
          const light = towardsTheLight();
          const live = new Set<string>();
          const placed: { sprite: Sprite; y: number }[] = [];
          for (const event of events) {
            const strip = frames.get(event.kind);
            const size = L.kinds[event.kind]?.size;
            if (strip === undefined || strip.length === 0 || size === undefined) continue;
            live.add(event.key);
            const since = firstSeen.get(event.key) ?? now;
            firstSeen.set(event.key, since);
            // Seen from its start, its own fade brings it out of its cover; seen first in flight, it fades up.
            const arriving = since - event.startsAt * 1000 > 200 ? ramp(since, since + ARRIVING_MS, now) : 1;
            const foot = feet.get(event.kind) ?? { x: 0.5, y: 1 };
            for (const pose of posesOf(event, now / 1000, strip.length)) {
              const alpha = pose.alpha * fade * arriving;
              if (alpha <= 0) continue;
              const texture = strip[pose.frame]!;
              const tall = size * layer.scale;
              const at = camera.tiltGround(pose.x, pose.y, layer.tilt);
              const x = layer.x + at.x * layer.scale;
              const y = layer.y + at.y * layer.scale;
              const bird = spriteAt(sprites, flying, drawn, texture);
              bird.anchor.set(foot.x, foot.y);
              bird.height = tall;
              bird.width = (texture.width / texture.height) * tall;
              bird.position.set(x, y - pose.height * layer.scale);
              bird.alpha = alpha;
              placed.push({ sprite: bird, y });
              // Its shadow on the ground under it, away from the light by its height, fainter the higher it is.
              const below = camera.tiltGround(
                pose.x - light.east * pose.height * SHADOW_REACH,
                pose.y - light.south * pose.height * SHADOW_REACH,
                layer.tilt,
              );
              const shadow = spriteAt(shapes, shadows, drawn, shade);
              shadow.anchor.set(0.5, 0.5);
              shadow.width = tall * 1.1;
              shadow.height = tall * 0.45;
              shadow.position.set(layer.x + below.x * layer.scale, layer.y + below.y * layer.scale);
              shadow.alpha = (alpha * SHADOW_ALPHA) / (1 + pose.height / 6);
              drawn += 1;
            }
          }
          for (const key of firstSeen.keys()) if (!live.has(key)) firstSeen.delete(key);
          // Farthest first, as the scenery is drawn.
          placed
            .sort((one, other) => one.y - other.y)
            .forEach((one, index) => flying.setChildIndex(one.sprite, index));
          const rate = 1000 / L.levels[level].framesPerSecond;
          wanted = drawn > 0 ? rate : WATCHING_MS;
        }
      }
      for (let at = drawn; at < sprites.length; at += 1) sprites[at]!.visible = false;
      for (let at = drawn; at < shapes.length; at += 1) shapes[at]!.visible = false;
      return wanted;
    },

    destroy(): void {
      import.meta.hot?.off(CRITTERS_CUT, cutAgain);
      shadows.destroy({ children: true });
      flying.destroy({ children: true });
      shade.destroy(true);
      atlas?.destroy();
    },
  };
}
