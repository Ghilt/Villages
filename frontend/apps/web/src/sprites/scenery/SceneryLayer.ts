import { Container, ImageSource, Matrix, Particle, ParticleContainer, Rectangle, Texture } from 'pixi.js';

import { note } from '../../log/log';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import * as camera from '../../geometry/cameraMath';
import { LONGEST_STEP_MS, PRESENCE_MS, easeTowards, midTrade } from '../twoForms';
import { biomeAt, cellOf, type ArtAtlasFile, type Kind, type ScatteredPoint } from '@villages/world';
import type { SceneryShaders } from '../trees/TreesLayer';
import { currentPointsOf, noteDrawn, pointsOf, sceneryMap, sceneryTally } from './sceneryCells';
import { MOST_CUT_AT_ONCE, groupCount, groupOf, thresholdOf, wantedAt, worthDrawing } from './showing';

/**
 * The world's furniture, drawn as particles under the marks.
 *
 * Every point is placed in **world units** and the whole layer is scaled and shifted once a frame, so a
 * pine grows with the ground exactly and not one of its twenty thousand positions is rewritten while the
 * camera pans or zooms. That is the shape Pixi wants: there is no per-particle scale attribute, only a
 * vertex buffer that carries the size, and touching it per particle per frame would re-upload the lot.
 * Only the colour is dynamic, because the fade lives in its alpha.
 *
 * **Tipped, the trees stand up.** Each foot is stored already turned and squashed by the camera's tilt,
 * so it lands on its tipped ground, and the layer itself is only ever scaled and shifted, so the picture
 * on the foot is never squashed with it. Turning or tipping the camera rewrites every foot, once; it is
 * the one thing that does, and it is rare. And they are drawn **farthest first**, the whole layer sorted
 * by where each foot lands on the screen, because the order the cells and the groups happened to arrive
 * in is no order at all. See `camera.standingLayer` in `cameraMath.ts` and experiment 0008.
 *
 * **A group is the unit of everything.** A group is one kind at one step of its arrival; the zoom says
 * whether a group belongs on the screen and time carries it there, which is the rule `twoForms.ts`
 * states and this used to break. Two things fall out of that, and the second is the reason the first was
 * worth doing:
 *
 * - **A particle exists only while its group does.** Experiment 0006's worst measurement was 42,087
 *   particles held to draw 410, and the follow-up it named was exactly this. A point whose group has not
 *   arrived is not a particle at all now, so pulling the camera back does not quietly build a screenful
 *   of invisible furniture on the way out.
 * - **A fade touches only the groups that are moving.** Standing still costs nothing, and a fade costs
 *   one group's particles rather than every particle on the screen.
 *
 * Cells come and go as the view moves over them, so panning across a boundary costs one cell and not a
 * screenful.
 *
 * **Every sprite casts a shadow, in a layer of their own under all of them.** A shadow is its sprite's
 * outline laid on the ground by the one light, cut into the atlas beside it, and it is a particle of its
 * own that comes, goes, fades and is placed with its sprite. The layer is drawn first, onto the cleared
 * canvas, **blended by the greater** rather than laid over: where two shadows overlap the ground is as
 * dark as the darker of them and no darker, and no shadow is ever drawn over a tree, because every tree
 * comes after every shadow. Baked into the sprites, a shadow would do both. See experiment 0013.
 */

/** How deep a ring of cells around the view to hold, so a pan finds them already cut. */
const RING = 1;

/**
 * Where the art is: the atlas `npm run world:art` cuts from `world/sprites/scenery/`, and its frames.
 * Generated and per-worktree, like the tiles, and served from the page's own origin. See decision 0059.
 */
const ART = '/art/scenery';

export interface SceneryDrawn {
  /** Particles in the container. Every one of them is showing, because the others are not made. */
  particles: number;
  /** Their shadows: one each while shadows are drawn, none at all while they are not. */
  shadows: number;
  showing: number;
  cells: number;
  waiting: number;
  /** Groups part-way in or out right now. Nought means the screen has settled. */
  moving: number;
}

/**
 * One cell's points - all of them, and those split by group that may grow where the fog allows - and
 * whichever of them are currently drawn, and their shadows.
 */
interface Held {
  all: readonly ScatteredPoint[];
  points: Map<number, ScatteredPoint[]>;
  made: Map<number, Particle[]>;
  shade: Map<number, Particle[]>;
}

export function createSceneryLayer(sway: SceneryShaders) {
  // Only the colour moves: positions and sizes are in world units and never change, so the vertex buffer
  // is written once a group, not once a frame. The trees' shaders bend the sprites in the wind as they draw.
  const dynamicProperties = { position: false, vertex: false, rotation: false, uvs: false, color: true };
  const container = new ParticleContainer({ dynamicProperties, shader: sway.standing });
  // The shadows, under every sprite and blended by the greater, so that two overlapping are no darker
  // than one. Drawn first onto the cleared canvas, which is what makes the greater safe: there is
  // nothing under it but the transparency the map shows through.
  const shadowLayer = new ParticleContainer({ dynamicProperties, shader: sway.shadows });
  shadowLayer.blendMode = 'max';
  shadowLayer.visible = false;
  const layers = new Container();
  layers.addChild(shadowLayer, container);
  const shown = new Map<string, Held>();
  let frames: Texture[] = [];
  /** Where each kind stands in its own frame, as a fraction of it, and its tint: how it bends in the wind. */
  let feet: { x: number; y: number; tint: number }[] = [];
  /** Each kind's shadow, and where the kind's foot falls in it. Empty for an atlas cut without them. */
  let shadowFrames: Texture[] = [];
  let shadowFeet: { x: number; y: number }[] = [];
  /** How dark the shadows are drawn, nought to one, and whether they are made at all. */
  let shadowStrength = 0;
  let shadowsDrawn = false;
  let atlas: ImageSource | null = null;
  let artFile: ArtAtlasFile | null = null;
  /** Asked for and not yet here, so it is asked for once. */
  let loadingArt = false;
  /** Asked for and not there, so the layer draws nothing rather than asking every frame. */
  let noArt = false;

  /** The camera's turn and tip every foot was placed for, and a key that says when they are stale. */
  let tilt: camera.GroundTilt = { cos: 1, sin: 0, lean: 1 };
  let tiltKey = '0/0';
  /** Particles were added or moved, so the layer is sorted again before it is drawn. */
  let unsorted = false;

  /**
   * Where the scenery may grow: everywhere, or only where this says, which is the ground the house has
   * revealed. The haze has no wood standing in it; step 5 of the fog of war.
   */
  let grows: ((x: number, y: number) => boolean) | null = null;
  const growing = (points: readonly ScatteredPoint[]): readonly ScatteredPoint[] =>
    grows === null ? points : points.filter((point) => grows!(point.x, point.y));

  /** How much of each group is on the screen, nought to one, moved by the clock and not by the zoom. */
  let alphaOf = new Float32Array(0);
  let drawnLaterBy = Number.NaN;
  let lastAt = 0;

  /**
   * The art, fetched once: the frames first, then the atlas they point into, by its version.
   *
   * One texture for every kind, because a particle layer draws from one texture. The browser builds the
   * mipmaps itself, which is what lets one picture 160 pixels tall be drawn at twenty without sparkling.
   * Nothing is drawn until it is here, and nothing at all if it was never cut: a master without a
   * sprite map draws no scenery either, and this is the same rule.
   */
  async function loadArt(askForAFrame: () => void): Promise<void> {
    loadingArt = true;
    try {
      const listed = await fetch(`${ART}.json`, { cache: 'no-store' });
      if (!listed.ok) {
        noArt = true;
        note('scenery', 'no art has been cut, so nothing grows. Run npm run world:art --prefix frontend');
        return;
      }
      const file = (await listed.json()) as ArtAtlasFile;
      const picture = await fetch(`${ART}.webp?v=${file.version}`);
      // Premultiplied by the browser as it decodes, and said to be, so that nothing multiplies it twice
      // or not at all. Left straight, the see-through pixels keep a colour, and a colour blended as if it
      // were premultiplied draws every sprite on a faint box of whatever its transparent pixels held.
      const bitmap = await createImageBitmap(await picture.blob(), { premultiplyAlpha: 'premultiply' });
      atlas?.destroy();
      atlas = new ImageSource({
        resource: bitmap,
        alphaMode: 'premultiplied-alpha',
        autoGenerateMipmaps: true,
        scaleMode: 'linear',
      });
      artFile = file;
      frames = [];
      noArt = false;
      askForAFrame();
    } catch (cause) {
      noArt = true;
      note('scenery', `the art could not be read: ${(cause as Error).message}`);
    } finally {
      loadingArt = false;
    }
  }

  /**
   * A frame and a foot for each of the sprite map's kinds, in its order.
   *
   * A kind the atlas has no frame for - one added to world/biomes.json since the art was last cut - is
   * drawn as the first frame and said once, which is visibly wrong rather than silently missing.
   */
  function frameKinds(kinds: readonly Kind[], file: ArtAtlasFile, source: ImageSource): void {
    const missing: string[] = [];
    const cut = kinds.map((kind) => {
      const own = file.frames[kind.name];
      if (own === undefined) {
        missing.push(kind.name);
      }
      const frame = own ?? Object.values(file.frames)[0];
      if (frame === undefined) {
        return { texture: Texture.EMPTY, foot: { x: 0.5, y: 1, tint: sway.tintOf(kind.name) } };
      }
      return {
        texture: new Texture({ source, frame: new Rectangle(frame.x, frame.y, frame.width, frame.height) }),
        foot: { x: frame.footX / frame.width, y: frame.footY / frame.height, tint: sway.tintOf(kind.name) },
      };
    });
    frames = cut.map((one) => one.texture);
    feet = cut.map((one) => one.foot);
    // The shadows, in the same order and from the same atlas, when it was cut with them.
    const shadows = file.shadows;
    const shade = shadows === undefined ? [] : kinds.map((kind) => shadows[kind.name]);
    if (shade.length > 0 && shade.every((frame) => frame !== undefined)) {
      shadowFrames = shade.map(
        (frame) =>
          new Texture({ source, frame: new Rectangle(frame!.x, frame!.y, frame!.width, frame!.height) }),
      );
      shadowFeet = shade.map((frame) => ({
        x: frame!.footX / frame!.width,
        y: frame!.footY / frame!.height,
      }));
      shadowLayer.texture = shadowFrames[0]!;
    } else {
      shadowFrames = [];
      shadowFeet = [];
    }
    if (missing.length > 0) {
      note(
        'scenery',
        `the art has no picture for ${missing.join(', ')}; run npm run world:art --prefix frontend`,
      );
    }
    // Named rather than left to be latched from the first particle: the container takes its texture
    // from children[0] once and never looks again, so a container told nothing would keep whichever
    // kind happened to be added first even after that one was taken away.
    const first = frames[0];
    if (first !== undefined) {
      container.texture = first;
    }
  }

  /**
   * What the layer actually has, from a console. `window.villagesScenery()`.
   *
   * The counters in the panel say how many particles there are; this says whether they could possibly be
   * drawn - the atlas they point at, which groups are in, and where the first one stands. The difference
   * between "none were made" and "they were made and are invisible" is otherwise a guess.
   */
  function report() {
    const first = [...shown.values()][0];
    const firstMade = first === undefined ? undefined : [...first.made.values()][0]?.[0];
    return {
      atlas:
        artFile === null ? null : { width: artFile.width, height: artFile.height, version: artFile.version },
      frames: frames.length,
      groups: {
        of: alphaOf.length,
        in: [...alphaOf].filter((a) => a > 0).length,
        // Part-way in or out. Nought means the screen has settled, which it always does: the fade is
        // a function of the clock and not of the zoom, so there is nowhere to rest half-drawn.
        moving: [...alphaOf].filter((a) => a > 0 && a < 1).length,
        part: [...alphaOf].filter((a) => a > 0 && a < 1).map((a) => Number(a.toFixed(3))),
      },
      particles: [...shown.values()].reduce(
        (sum, cell) => sum + [...cell.made.values()].reduce((n, made) => n + made.length, 0),
        0,
      ),
      // Whether the layer is drawn farthest first, which is the thing an eye catches as a tree standing
      // in front of one it should be behind, and cannot tell from a single wrong frame.
      ordered: container.particleChildren.every(
        (particle, index, all) => index === 0 || camera.fartherFirst(all[index - 1]!, particle) <= 0,
      ),
      tilt: tiltKey,
      shadows: {
        drawn: shadowsDrawn,
        strength: shadowStrength,
        frames: shadowFrames.length,
        particles: shadowLayer.particleChildren.length,
        blend: shadowLayer.blendMode,
      },
      first:
        firstMade === undefined
          ? null
          : { x: firstMade.x, y: firstMade.y, alpha: firstMade.alpha, scaleY: firstMade.scaleY },
      container: { visible: container.visible, scale: container.scale.x, x: container.x, y: container.y },
    };
  }
  if (import.meta.env.DEV) {
    (window as unknown as { villagesScenery?: typeof report }).villagesScenery = report;
  }

  function keyOf(cellX: number, cellY: number): string {
    return `${cellX}/${cellY}`;
  }

  /** The points of a cell, split by group once, because the group is what comes and goes. */
  function splitByGroup(points: readonly ScatteredPoint[]): Map<number, ScatteredPoint[]> {
    const by = new Map<number, ScatteredPoint[]>();
    for (const point of points) {
      const group = groupOf(point.kind, point.rank);
      const already = by.get(group);
      if (already === undefined) {
        by.set(group, [point]);
      } else {
        already.push(point);
      }
    }
    return by;
  }

  function makeGroup(cell: Held, group: number, alpha: number): void {
    const points = cell.points.get(group);
    if (points === undefined || points.length === 0) {
      return;
    }
    const made = points.map((point) => {
      const texture = frames[point.kind] ?? frames[0]!;
      const foot = feet[point.kind] ?? { x: 0.5, y: 1, tint: sway.tintOf('') };
      // The art carries its own colour: the tint is how its kind bends, which only the trees' shaders read.
      const particle = new Particle({ texture, tint: foot.tint });
      place(particle, point);
      // The foot stands on the place, the same anchor a castle's forms share, and it is where the
      // picture itself stands - measured when the art was cut - rather than the middle of its box.
      particle.anchorX = foot.x;
      particle.anchorY = foot.y;
      // Sized in world units, so the container's one transform turns it into pixels.
      particle.scaleY = point.height / texture.height;
      particle.scaleX = particle.scaleY;
      particle.alpha = alpha;
      return particle;
    });
    cell.made.set(group, made);
    container.addParticle(...made);
    unsorted = true;
    if (shadowsDrawn) {
      makeShadows(cell, group, alpha);
    }
  }

  /**
   * A group's shadows: one a sprite, on the same foot and at the same size, since the shadow was cut from
   * the sprite at the sprite's own pixels, and as dark as the lever says times as far in as the group is.
   */
  function makeShadows(cell: Held, group: number, alpha: number): void {
    const points = cell.points.get(group);
    if (points === undefined || points.length === 0 || cell.shade.has(group)) {
      return;
    }
    const shade = points.map((point) => {
      const texture = shadowFrames[point.kind] ?? shadowFrames[0]!;
      const foot = shadowFeet[point.kind] ?? { x: 0.5, y: 0 };
      const standing = frames[point.kind] ?? frames[0]!;
      const particle = new Particle({ texture, tint: feet[point.kind]?.tint ?? sway.tintOf('') });
      place(particle, point);
      particle.anchorX = foot.x;
      particle.anchorY = foot.y;
      particle.scaleY = point.height / standing.height;
      particle.scaleX = particle.scaleY;
      particle.alpha = alpha * shadowStrength;
      return particle;
    });
    cell.shade.set(group, shade);
    shadowLayer.addParticle(...shade);
    unsorted = true;
  }

  function dropShadows(cell: Held, group: number): void {
    const shade = cell.shade.get(group);
    if (shade === undefined) {
      return;
    }
    for (const particle of shade) {
      shadowLayer.removeParticle(particle);
    }
    cell.shade.delete(group);
    unsorted = true;
  }

  /**
   * Where a particle's foot is stored: its place on the ground, turned and squashed by the camera, in
   * world units. The one place that is worked out, for a new particle and for every particle when the
   * camera turns, so there is never a second formula to drift from the first.
   */
  function place(particle: Particle, point: ScatteredPoint): void {
    const at = camera.tiltGround(point.x, point.y, tilt);
    particle.x = at.x;
    particle.y = at.y;
  }

  /** The camera turned or tipped, so every foot is placed again for it. */
  function placeEverythingAgain(): void {
    for (const cell of shown.values()) {
      for (const [group, made] of cell.made) {
        const points = cell.points.get(group)!;
        made.forEach((particle, index) => place(particle, points[index]!));
      }
      for (const [group, shade] of cell.shade) {
        const points = cell.points.get(group)!;
        shade.forEach((particle, index) => place(particle, points[index]!));
      }
    }
    unsorted = true;
  }

  function dropGroup(cell: Held, group: number): void {
    dropShadows(cell, group);
    const made = cell.made.get(group);
    if (made === undefined) {
      return;
    }
    for (const particle of made) {
      container.removeParticle(particle);
    }
    cell.made.delete(group);
  }

  /**
   * The lever moved: shadows made for every group that is in, or taken away from all of them, or only
   * made darker or lighter. The sprites are not touched, so turning shadows on and off never makes the
   * wood fade out and in again.
   */
  function shadeTo(strength: number): void {
    const want = strength > 0 && shadowFrames.length > 0;
    shadowStrength = strength;
    if (want !== shadowsDrawn) {
      shadowsDrawn = want;
      for (const cell of shown.values()) {
        for (const group of [...cell.made.keys()]) {
          if (want) {
            makeShadows(cell, group, alphaOf[group] ?? 0);
          } else {
            dropShadows(cell, group);
          }
        }
      }
    } else if (want) {
      for (const cell of shown.values()) {
        for (const [group, shade] of cell.shade) {
          const alpha = (alphaOf[group] ?? 0) * strength;
          for (const particle of shade) {
            particle.alpha = alpha;
          }
        }
      }
    }
    shadowLayer.visible = shadowsDrawn;
  }

  function takeEverythingOut(): void {
    for (const cell of shown.values()) {
      for (const group of [...cell.made.keys()]) {
        dropGroup(cell, group);
      }
    }
    shown.clear();
    alphaOf.fill(0);
  }

  return {
    /** The shadows and the sprites over them, placed as one. */
    get container() {
      return layers;
    },

    ready(): boolean {
      return frames.length > 0;
    },

    /**
     * The art was cut again while the page was open. Everything drawn is let go of and gathers again
     * from the new atlas, so a picture saved over a placeholder is on the map without a reload.
     */
    artChanged(askForAFrame: () => void): void {
      if (loadingArt) {
        return;
      }
      takeEverythingOut();
      void loadArt(askForAFrame);
    },

    /**
     * Draws the furniture for this view.
     *
     * Three passes, and each one is small. The groups are advanced by the clock; the cells in view are
     * made to hold exactly the groups that are in; and the groups that moved this frame have their alpha
     * written. Nothing walks every particle unless every group is moving, which only happens on the one
     * frame a master changes.
     */
    update(
      view: camera.CameraView,
      tilesRoot: string,
      dial: number,
      spacing: number,
      laterBy: number,
      shadows: number,
      askForAFrame: () => void,
    ): SceneryDrawn {
      // The kinds come from the master's sprite map, so nothing can be drawn until it is in hand. One
      // cell is asked for to set that fetch going, and the first frame after it lands builds the atlas.
      const map = sceneryMap();
      if (map === null) {
        pointsOf(
          tilesRoot,
          cellOf(camera.toMercatorExact(view.center).x * WORLD_MASTER_WIDTH),
          0,
          dial,
          spacing,
          askForAFrame,
        );
        return { particles: 0, shadows: 0, showing: 0, cells: 0, waiting: sceneryTally().waiting, moving: 0 };
      }
      if (atlas === null || artFile === null) {
        if (!loadingArt && !noArt) {
          void loadArt(askForAFrame);
        }
        return { particles: 0, shadows: 0, showing: 0, cells: 0, waiting: sceneryTally().waiting, moving: 0 };
      }
      if (frames.length === 0) {
        frameKinds(map.kinds, artFile, atlas);
      }
      if (shadows !== shadowStrength || (shadows > 0 && shadowFrames.length > 0) !== shadowsDrawn) {
        shadeTo(shadows);
      }
      if (alphaOf.length !== groupCount(map.kinds)) {
        alphaOf = new Float32Array(groupCount(map.kinds));
      }
      // A change to how far in things arrive moves every threshold at once, so everything is let go of
      // and gathers again rather than half of it sitting at a stale alpha.
      if (laterBy !== drawnLaterBy) {
        drawnLaterBy = laterBy;
        takeEverythingOut();
      }

      const centre = camera.toMercatorExact(view.center);
      const layer = camera.standingLayer(view);
      const key = `${view.pitch ?? 0}/${view.bearing ?? 0}`;
      if (key !== tiltKey) {
        tiltKey = key;
        tilt = layer.tilt;
        placeEverythingAgain();
      }
      // The whole layer is placed by one matrix, which is what makes twenty thousand pines cost one
      // multiply rather than twenty thousand. It only scales and shifts: the turn and the tip are already
      // in every foot, and leaving them out of here is what keeps the pictures upright. See 0052 and 0008.
      const placed = new Matrix(layer.scale, 0, 0, layer.scale, layer.x, layer.y);
      container.setFromMatrix(placed);
      shadowLayer.setFromMatrix(placed);
      // Which biome the camera is over, for the panel. One array read a frame, and it is the one reading
      // that turns "the world looks different over there" into a name Adam can argue with.
      noteDrawn({
        biome: map.names[biomeAt(map, centre.x * WORLD_MASTER_WIDTH, centre.y * WORLD_MASTER_WIDTH)] ?? '',
      });

      // Which cells the view stands on, in world units, with a ring so a pan finds them cut.
      //
      // Tilted, the ground under the window is a turned rectangle stretched along the lean, so the
      // window's four corners are carried back onto the ground through the same tilt that placed the feet,
      // which is exact at any angle and the old arithmetic exactly when the camera is flat and north-up.
      const halfWide = view.width / 2 / layer.scale;
      const halfHigh = view.height / 2 / layer.scale;
      const corners = [
        [-halfWide, -halfHigh],
        [halfWide, -halfHigh],
        [-halfWide, halfHigh],
        [halfWide, halfHigh],
      ].map(([x = 0, y = 0]) => camera.untiltGround(x, y, tilt));
      const eastUnits = corners.map(({ east }) => centre.x * WORLD_MASTER_WIDTH + east);
      const southUnits = corners.map(({ south }) => centre.y * WORLD_MASTER_WIDTH + south);
      const fromX = cellOf(Math.min(...eastUnits)) - RING;
      const toX = cellOf(Math.max(...eastUnits)) + RING;
      const fromY = cellOf(Math.min(...southUnits)) - RING;
      const toY = cellOf(Math.max(...southUnits)) + RING;

      // Nothing is drawn until the camera is close enough that something would show, and the view is
      // small enough to be worth walking. Pulled right back a cell is eight pixels across and the view
      // holds twenty thousand of them; without this the page hangs before the map has drawn.
      const cellsInView = (toX - fromX + 1) * (toY - fromY + 1);
      if (!worthDrawing(map.kinds, view.zoom, cellsInView, laterBy)) {
        if (shown.size > 0) {
          takeEverythingOut();
        }
        return { particles: 0, shadows: 0, showing: 0, cells: 0, waiting: sceneryTally().waiting, moving: 0 };
      }

      // Pass one: the clock. A frame is never allowed to be a long step, or a fade that begins after a
      // pause would be handed the whole of itself at once and pop, which is the thing a fade is for.
      const now = performance.now();
      const elapsed = Math.min(LONGEST_STEP_MS, lastAt === 0 ? LONGEST_STEP_MS : now - lastAt);
      lastAt = now;
      const moved: number[] = [];
      let moving = 0;
      for (let group = 0; group < alphaOf.length; group += 1) {
        const was = alphaOf[group]!;
        const want = wantedAt(thresholdOf(map.kinds, group, laterBy), view.zoom, was > 0) ? 1 : 0;
        const next = easeTowards(was, want, elapsed, PRESENCE_MS);
        if (next !== was) {
          alphaOf[group] = next;
          moved.push(group);
        }
        if (midTrade(next)) {
          moving += 1;
        }
      }
      if (moving > 0) {
        askForAFrame();
      }

      // Pass two: the cells, holding exactly the groups that are in.
      const wanted = new Set<string>();
      let cutting = 0;
      for (let cellY = fromY; cellY <= toY; cellY += 1) {
        for (let cellX = fromX; cellX <= toX; cellX += 1) {
          const key = keyOf(cellX, cellY);
          wanted.add(key);
          let cell = shown.get(key);
          if (cell === undefined) {
            // Only so many new cells a frame. Arriving somewhere new otherwise cuts a screenful at
            // once, which is one long frame exactly when the camera is moving.
            if (cutting >= MOST_CUT_AT_ONCE) {
              askForAFrame();
              continue;
            }
            const points = pointsOf(tilesRoot, cellX, cellY, dial, spacing, askForAFrame);
            if (points === null) {
              continue;
            }
            cutting += 1;
            cell = { all: points, points: splitByGroup(growing(points)), made: new Map(), shade: new Map() };
            shown.set(key, cell);
          } else {
            // The fog moved and the gateway sent this cell's stands again, so it has been cut again: its new
            // points take the old ones' place at the fade they were at, in this frame, so nothing blinks. On
            // ground already revealed they are the same points. See decision record 0067.
            const now = currentPointsOf(tilesRoot, cellX, cellY, dial, spacing, askForAFrame);
            if (now !== undefined && now !== cell.all) {
              for (const group of [...cell.made.keys()]) {
                dropGroup(cell, group);
              }
              cell.all = now;
              cell.points = splitByGroup(growing(now));
              unsorted = true;
            }
          }
          for (const group of cell.points.keys()) {
            const alpha = alphaOf[group]!;
            const has = cell.made.has(group);
            if (alpha > 0 && !has) {
              makeGroup(cell, group, alpha);
            } else if (alpha === 0 && has) {
              dropGroup(cell, group);
            }
          }
        }
      }

      for (const [key, cell] of shown) {
        if (wanted.has(key)) {
          continue;
        }
        for (const group of [...cell.made.keys()]) {
          dropGroup(cell, group);
        }
        shown.delete(key);
      }

      // Pass three: the fade, over the groups that moved and nothing else.
      for (const group of moved) {
        const alpha = alphaOf[group]!;
        for (const cell of shown.values()) {
          const made = cell.made.get(group);
          if (made === undefined) {
            continue;
          }
          for (const particle of made) {
            particle.alpha = alpha;
          }
          for (const particle of cell.shade.get(group) ?? []) {
            particle.alpha = alpha * shadowStrength;
          }
        }
      }

      // Farthest first, over the whole layer rather than a cell at a time: a cell that arrives later is
      // not nearer. Sorted in place and handed back once, which is one upload and only on a frame that
      // added a particle or turned the camera.
      if (unsorted) {
        container.particleChildren.sort(camera.fartherFirst);
        container.update();
        // The shadows are never sorted: the greater of two is the same whichever comes first.
        shadowLayer.update();
        unsorted = false;
      }

      let particles = 0;
      let shade = 0;
      for (const cell of shown.values()) {
        for (const made of cell.made.values()) {
          particles += made.length;
        }
        for (const cast of cell.shade.values()) {
          shade += cast.length;
        }
      }
      return {
        particles,
        shadows: shade,
        showing: particles,
        cells: shown.size,
        waiting: sceneryTally().waiting,
        moving,
      };
    },

    /**
     * Where the scenery may grow from now on: everywhere, with null, or only where this says. Every cell in
     * view is sorted again at once and its groups are made afresh on the next frame at the fade they were
     * at, so what stays does not flicker and what the house has newly seen stands as the haze over it lifts.
     */
    setGround(next: ((x: number, y: number) => boolean) | null): void {
      grows = next;
      for (const cell of shown.values()) {
        for (const group of [...cell.made.keys()]) {
          dropGroup(cell, group);
        }
        cell.points = splitByGroup(growing(cell.all));
      }
      unsorted = true;
    },

    /** Everything drawn is taken out, for a change that makes every cell wrong. */
    clear(): void {
      takeEverythingOut();
    },

    destroy(): void {
      layers.destroy({ children: true });
      atlas?.destroy();
      atlas = null;
      frames = [];
    },
  };
}
