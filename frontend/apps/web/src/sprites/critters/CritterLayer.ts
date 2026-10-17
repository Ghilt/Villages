import { Container, ImageSource, Rectangle, Sprite, Texture } from 'pixi.js';

import type { CritterAtlasFile } from '@villages/world';

import * as camera from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import { note } from '../../log/log';
import { towardsTheLight } from '../../map/light';
import { drawnAt, shadersStore } from '../../shaders/levels';
import type { Layer } from '../layer';

import { critterCellOf, eventsAt, lastsFor, posesOf, ringsOf } from './critterClock';
import { critterGround } from './critterGround';
import type { CritterSurroundings } from './critterGround';
import { critterStore, readCritters } from './critterMode';
import { critterSpawnStore, takeSpawns } from './critterSpawn';
import { critterTuningStore } from './critterTuning';
import { ringTexture, shadowTexture } from './drawnInCode';
import { CRITTERS_LOOK } from './look';
import { spawnedAt } from './spawned';
import type { CritterEvent, SpawnAsk } from './types';

/**
 * The critters, as two layers of the sprite canvas: one on the ground under the scenery, of the shadows, of what runs
 * there, a squirrel or a hare, and of a fish leaping out of the water with the rings it leaves, so a tree in front of
 * one hides it; and one in the air over the scenery and under every mark, of what flies. Both are in the
 * container the fog takes the colour out of, so they are hazed with the trees; and they come only where the house sees
 * now, so the land in sight is the living land and what is only remembered holds still.
 *
 * Every frame it asks the clock (`critterClock.ts`) what is in flight over the view - which reads the very trees and
 * bushes the scenery drew, the ground's class under them and the fog's sight, `critterGround.ts` - and places a sprite
 * for each, a frame of
 * its kind's strip from the atlas `world:critters` cuts, and a soft shadow under it, away from the light by its height;
 * one on the ground faces the way it is going across the screen, whichever way the map is turned, and a leaping fish
 * tips along its arc. A fish's rings are drawn in code (`drawnInCode.ts`), flattened as the ground is tipped.
 * While one is in flight it asks for frames at its level's rate, and a few a second otherwise, so the next is seen
 * leaving. One first seen already in flight, where the view has just moved to, fades up, so nothing pops. A player
 * who asked for less motion gets none. Its level, how many and how big are the Critters part of the Shaders
 * section's, and what is about is said inside that part. See decision record 0099.
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
  /** What is on the ground, every critter's shadow and what runs there, to go under the scenery. */
  ground: Container;
  /** What flies, to go over it. */
  flying: Container;
}

const ramp = (from: number, to: number, value: number): number =>
  Math.min(1, Math.max(0, (value - from) / (to - from)));

export function createCritterLayer(repaint: () => void, around: () => CritterSurroundings): CritterLayer {
  const ripples = new Container();
  const shadows = new Container();
  const running = new Container();
  const ground = new Container();
  ground.addChild(ripples, shadows, running);
  const flying = new Container();
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A level or a slider moved shows on the next frame even where nothing else is moving the map.
  const stopWatching = [critterStore, critterTuningStore, shadersStore, critterSpawnStore].map((store) =>
    store.watch(repaint),
  );
  const shade = shadowTexture();
  const ripple = ringTexture();
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

  const world = critterGround(around, repaint);
  /** Critters put where a click asked, while they last, and the clicks whose ground is not known yet. */
  let spawned: CritterEvent[] = [];
  let waiting: SpawnAsk[] = [];

  /** Every click taken since the last frame made up into a critter beginning now, or said why not. */
  function spawnFor(seconds: number): void {
    const asks = [...waiting, ...takeSpawns()];
    waiting = [];
    for (const ask of asks) {
      const made = spawnedAt(ask, seconds, world);
      if (made === null && seconds - ask.at < 3) waiting.push(ask);
      else if (made === null) note('critters', `no ${ask.kind}: the ground there is not known yet`);
      else if (typeof made === 'string') note('critters', `no ${ask.kind} there: ${made}`);
      else spawned.push(made);
    }
    spawned = spawned.filter((event) => seconds < event.startsAt + lastsFor(event));
  }

  /** When each critter on the screen was first seen, so one first seen in flight fades up. */
  const firstSeen = new Map<string, number>();
  const sprites: Sprite[] = [];
  const runners: Sprite[] = [];
  const shapes: Sprite[] = [];
  const rings: Sprite[] = [];
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
    ground,
    flying,

    draw(view: camera.CameraView): number | null {
      const level = drawnAt(critterStore.get().level);
      const tuning = critterTuningStore.get();
      const fade = ramp(L.fromZoom, L.wholeAt, view.zoom);
      let drawn = 0;
      let ran = 0;
      let rippled = 0;
      let wanted: number | null = null;
      const counted: Record<string, number> = {};
      // What a click asked for comes even where the clock would bring none.
      const asked = critterSpawnStore.get().asked.length + waiting.length + spawned.length > 0;
      if (level !== 'off' && !still && fade > 0 && !noArt && (tuning.density > 0 || asked)) {
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
          spawnFor(now / 1000);
          const events = [...eventsAt(cells, now / 1000, tuning.density * tuning.often, world), ...spawned];
          const light = towardsTheLight();
          // How far the ground is flattened up the screen as it tips: a ring on it is that much wider than tall.
          const [across, up] = [camera.tiltGround(1, 0, layer.tilt), camera.tiltGround(0, 1, layer.tilt)];
          const squash = Math.abs(across.x * up.y - across.y * up.x);
          const live = new Set<string>();
          const placed: { sprite: Sprite; y: number }[] = [];
          const onFoot: { sprite: Sprite; y: number }[] = [];
          for (const event of events) {
            const strip = frames.get(event.kind);
            const own = L.kinds[event.kind]?.size;
            if (strip === undefined || strip.length === 0 || own === undefined) continue;
            const size = own * tuning.size;
            live.add(event.key);
            const since = firstSeen.get(event.key) ?? now;
            firstSeen.set(event.key, since);
            // Seen from its start, its own fade brings it out of its cover; seen first in flight, it fades up.
            const arriving = since - event.startsAt * 1000 > 200 ? ramp(since, since + ARRIVING_MS, now) : 1;
            const foot = feet.get(event.kind) ?? { x: 0.5, y: 1 };
            // What is on the ground faces the way it goes across the screen; the pictures face right.
            const onGround = event.behaviour !== 'flush';
            const heading = event.animals[0]?.heading ?? 0;
            const facing = onGround
              ? Math.sign(camera.tiltGround(Math.cos(heading), Math.sin(heading), layer.tilt).x) || 1
              : 1;
            for (const pose of posesOf(event, now / 1000, strip.length, size)) {
              const alpha = pose.alpha * fade * arriving;
              if (alpha <= 0) continue;
              const texture = strip[pose.frame]!;
              const tall = size * layer.scale;
              const at = camera.tiltGround(pose.x, pose.y, layer.tilt);
              const x = layer.x + at.x * layer.scale;
              const y = layer.y + at.y * layer.scale;
              const bird = onGround
                ? spriteAt(runners, running, ran, texture)
                : spriteAt(sprites, flying, drawn - ran, texture);
              bird.anchor.set(foot.x, foot.y);
              // Its scale set whole each frame, so a sprite turned one way keeps no sign of it the next.
              const scale = tall / texture.height;
              bird.scale.set(scale * facing, scale);
              bird.position.set(x, y - pose.height * layer.scale);
              // A leaping fish tips its nose up and then down, the same way round whichever way it faces.
              bird.rotation = -(pose.tilt ?? 0) * facing;
              bird.alpha = alpha;
              (onGround ? onFoot : placed).push({ sprite: bird, y });
              if (onGround) ran += 1;
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
              counted[event.kind] = (counted[event.kind] ?? 0) + 1;
              drawn += 1;
            }
            for (const ring of ringsOf(event, now / 1000)) {
              const at = camera.tiltGround(ring.x, ring.y, layer.tilt);
              const wide = ring.radius * 2 * layer.scale;
              const sprite = spriteAt(rings, ripples, rippled, ripple);
              sprite.anchor.set(0.5, 0.5);
              sprite.width = wide;
              sprite.height = wide * squash;
              sprite.position.set(layer.x + at.x * layer.scale, layer.y + at.y * layer.scale);
              sprite.alpha = ring.alpha * fade * arriving;
              rippled += 1;
            }
          }
          for (const key of firstSeen.keys()) if (!live.has(key)) firstSeen.delete(key);
          // Farthest first, as the scenery is drawn.
          for (const [all, into] of [
            [placed, flying],
            [onFoot, running],
          ] as const) {
            all
              .sort((one, other) => one.y - other.y)
              .forEach((one, index) => into.setChildIndex(one.sprite, index));
          }
          const rate = 1000 / L.levels[level].framesPerSecond;
          wanted = drawn + rippled > 0 ? rate : WATCHING_MS;
        }
      }
      for (let at = drawn - ran; at < sprites.length; at += 1) sprites[at]!.visible = false;
      for (let at = ran; at < runners.length; at += 1) runners[at]!.visible = false;
      for (let at = drawn; at < shapes.length; at += 1) shapes[at]!.visible = false;
      for (let at = rippled; at < rings.length; at += 1) rings[at]!.visible = false;
      readCritters(
        counted,
        level === 'off'
          ? 'off'
          : still
            ? 'none for less motion'
            : fade <= 0
              ? 'from zoom 9 in'
              : noArt
                ? 'none cut'
                : tuning.density <= 0
                  ? 'none at this density'
                  : null,
      );
      return wanted;
    },

    destroy(): void {
      for (const stop of stopWatching) stop();
      import.meta.hot?.off(CRITTERS_CUT, cutAgain);
      ground.destroy({ children: true });
      flying.destroy({ children: true });
      shade.destroy(true);
      ripple.destroy(true);
      atlas?.destroy();
    },
  };
}
