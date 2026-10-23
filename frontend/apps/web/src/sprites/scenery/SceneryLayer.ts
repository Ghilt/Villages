import { Container, ImageSource, Matrix, Particle, ParticleContainer, Texture } from 'pixi.js';

import { note } from '../../log/log';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import * as camera from '../../geometry/cameraMath';
import { readAtlas } from '../atlas';
import { LONGEST_STEP_MS, PRESENCE_MS, easeTowards, midTrade } from '../twoForms';
import { biomeAt, cellOf, type ArtAtlasFile, type Kind, type ScatteredPoint } from '@villages/world';
import { sceneryCellKey } from '../ground/growing';
import { removeAll } from '../standing/leaving';
import { createStandingLayer } from '../standing/StandingLayer';
import type { SceneryShaders } from '../trees/TreesLayer';
import { currentPointsOf, noteDrawn, pointsOf, sceneryMap, sceneryTally } from './sceneryCells';
import { kindFrames } from './kindFrames';
import { sceneryReport } from './sceneryReport';
import { viewCells } from './viewCells';
import { createLateFades } from './lateFades';
import {
  BUILD_MS,
  MOST_CUT_AT_ONCE,
  arrivalWaits,
  groupCount,
  nearestFirst,
  splitByGroup,
  thresholdOf,
  wantedAt,
  worthBuilding,
} from './showing';

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
 * - **A particle exists only while the woods are built**, from half a zoom before they arrive
 *   (`BUILT_AHEAD`), and is made then whether or not its group has arrived, hidden at its group's fade of
 *   nought: the crossing only fades the woods in, where it used to build them a few cells a frame over half a
 *   second (decision record 0096, amended 2026-10-22). Pulled back past that, nothing is held: experiment
 *   0006's worst measurement was 42,087 particles held to draw 410, and a screenful of invisible furniture
 *   is still not built on the way out. The building takes `BUILD_MS` of a frame, the middle of the view first.
 * - **A tree is built once while its cell is held.** The worn ground and the fog only say whether it shows:
 *   one on a road, a yard or ground the house has not revealed is held at a fade of nought, and a change of
 *   either asks again only the trees of the cells it touched (decision record 0118).
 * - **The arrival is one fade over the whole wood**, the trees' slices' and the shadows' own alpha, since
 *   every kind arrives at the one zoom (0096): no tree's own fade is written while the woods come in or go.
 *   A tree carries a fade of its own only to be hidden on worn ground, or when its wood was built after the
 *   woods had arrived, which then fades in by a clock of its own (`lateFades.ts`); and the arrival waits,
 *   briefly, for every cell in view to be built, so the woods come in together (`HOLD_FOR_WHOLE_MS`).
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
  /** Particles in the container: every tree built, shown or held hidden. */
  particles: number;
  /** Their shadows: one each while shadows are drawn, none at all while they are not. */
  shadows: number;
  showing: number;
  cells: number;
  waiting: number;
  /** Groups part-way in or out right now. Nought means the screen has settled. */
  moving: number;
}

/** One cell's points - all of them, and split by group - and the trees and the shadows built for them. */
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
  // The trees in slices, with whatever stands among them drawn between, as the scenery's own switch says.
  const container = createStandingLayer({ dynamicProperties, shader: sway.standing }, () => layers.visible);
  // The shadows, under every sprite and blended by the greater, so that two overlapping are no darker
  // than one. Drawn first onto the cleared canvas, which is what makes the greater safe: there is
  // nothing under it but the transparency the map shows through.
  const shadowLayer = new ParticleContainer({ dynamicProperties, shader: sway.shadows });
  shadowLayer.blendMode = 'max';
  shadowLayer.visible = false;
  const layers = new Container();
  layers.addChild(shadowLayer);
  const shown = new Map<string, Held>();
  /**
   * The trees and the shadows dropped since they were last let go: taken out of their layers together, in one pass
   * over each (`leaving.ts`), before anything reads the layers again.
   */
  const goingTrees = new Set<Particle>();
  const goingShades = new Set<Particle>();
  /** The trees and shadows built on ground they may not grow on, worn or not revealed: held at a fade of nought. */
  const bare = new Set<Particle>();
  /** Whether the woods are built now: from `BUILT_AHEAD` before they arrive, a little sticky either way. */
  let built = false;
  /** The woods built after the woods had arrived, each fading in on its own. */
  const late = createLateFades<Held>();
  /** How far the woods have arrived, nought to one: the one fade over every tree and shadow. */
  let arrival = 0;
  /** Whether every cell in view was built by the end of the last frame, and since when the arrival has waited. */
  let viewBuilt = false;
  let waitingSince: number | null = null;
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
  const growsAt = (point: ScatteredPoint) => grows === null || grows(point.x, point.y);

  /**
   * A tree or a shadow at its own fade: whole, or part-way in for a wood built late, and nought on ground it may not
   * grow on. The arrival is laid over it by its layer.
   */
  function lay(particle: Particle, hidden: boolean, fade: number): void {
    if (hidden) bare.add(particle);
    else bare.delete(particle);
    particle.alpha = hidden ? 0 : fade;
  }

  /** How much of each group is on the screen, nought to one, moved by the clock and not by the zoom. */
  let alphaOf = new Float32Array(0);
  let drawnLaterBy = Number.NaN;
  let lastAt = 0;

  /**
   * The art, fetched once: the frames first, then the atlas they point into, by its version.
   *
   * One texture for every kind, because a particle layer draws from one texture. Nothing is drawn until
   * it is here, and nothing at all if it was never cut: a master without a sprite map draws no scenery
   * either, and this is the same rule.
   */
  async function loadArt(askForAFrame: () => void): Promise<void> {
    loadingArt = true;
    try {
      const read = await readAtlas<ArtAtlasFile>(ART, "the scenery's pictures");
      if (read === null) {
        noArt = true;
        note('scenery', 'no art has been cut, so nothing grows. Run npm run world:art --prefix frontend');
        return;
      }
      atlas?.destroy();
      atlas = read.source;
      artFile = read.file;
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

  /** A frame and a foot for each of the sprite map's kinds, and their shadows, from the atlas (`kindFrames.ts`). */
  function frameKinds(kinds: readonly Kind[], file: ArtAtlasFile, source: ImageSource): void {
    const cut = kindFrames(kinds, file, source, sway.tintOf);
    ({ frames, feet, shadowFrames, shadowFeet } = cut);
    if (shadowFrames.length > 0) shadowLayer.texture = shadowFrames[0]!;
    if (cut.missing.length > 0) {
      note(
        'scenery',
        `the art has no picture for ${cut.missing.join(', ')}; run npm run world:art --prefix frontend`,
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

  const report = () =>
    sceneryReport({
      cells: shown.values(),
      artFile,
      frames: frames.length,
      alphaOf,
      standing: container,
      shadowLayer,
      tiltKey,
      shadows: { drawn: shadowsDrawn, strength: shadowStrength, frames: shadowFrames.length },
    });
  if (import.meta.env.DEV) {
    (window as unknown as { villagesScenery?: typeof report }).villagesScenery = report;
  }

  const keyOf = sceneryCellKey;

  /** A cell's group built: fading in by a clock of its own when the woods are already showing and it is not `inPlace`. */
  function makeGroup(cell: Held, group: number, inPlace = false): void {
    const points = cell.points.get(group);
    if (points === undefined || points.length === 0) {
      return;
    }
    if (arrival > 0 && !inPlace) late.start(cell, group);
    const fade = late.of(cell, group);
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
      lay(particle, !growsAt(point), fade);
      return particle;
    });
    cell.made.set(group, made);
    container.addParticle(...made);
    unsorted = true;
    if (shadowsDrawn) {
      makeShadows(cell, group);
    }
  }

  /**
   * A group's shadows: one a sprite, on the same foot and at the same size, since the shadow was cut from
   * the sprite at the sprite's own pixels, and as dark as the lever says times as far in as the group is.
   */
  function makeShadows(cell: Held, group: number): void {
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
      lay(particle, !growsAt(point), late.of(cell, group));
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
      goingShades.add(particle);
      bare.delete(particle);
    }
    cell.shade.delete(group);
    unsorted = true;
  }

  /** Every tree and shadow dropped since the last time, out of the layers at once. */
  function letGo(): void {
    if (goingTrees.size > 0) {
      container.removeParticles(goingTrees);
      goingTrees.clear();
    }
    if (goingShades.size > 0) {
      removeAll(shadowLayer.particleChildren, goingShades);
      shadowLayer.update();
      goingShades.clear();
    }
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
      goingTrees.add(particle);
      bare.delete(particle);
    }
    cell.made.delete(group);
    late.forget(cell, group);
  }

  /** Every tree and shadow of a cell shown or hidden by where the scenery grows now, at its own fade. */
  function showWhereItGrows(cell: Held): void {
    for (const [group, made] of cell.made) {
      const points = cell.points.get(group)!;
      const fade = late.of(cell, group);
      made.forEach((particle, index) => lay(particle, !growsAt(points[index]!), fade));
      cell.shade.get(group)?.forEach((particle, index) => lay(particle, !growsAt(points[index]!), fade));
    }
  }

  /** A late group's trees and shadows at the fade it has come to, the bare ones still hidden. */
  function fadeTo(cell: Held, group: number, fade: number): void {
    for (const particle of cell.made.get(group) ?? []) particle.alpha = bare.has(particle) ? 0 : fade;
    for (const particle of cell.shade.get(group) ?? []) particle.alpha = bare.has(particle) ? 0 : fade;
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
            makeShadows(cell, group);
          } else {
            dropShadows(cell, group);
          }
        }
      }
      letGo();
    }
    shadowLayer.visible = shadowsDrawn;
  }

  function takeEverythingOut(): void {
    for (const cell of shown.values()) {
      for (const group of [...cell.made.keys()]) {
        dropGroup(cell, group);
      }
    }
    letGo();
    shown.clear();
    late.clear();
    alphaOf.fill(0);
    arrival = 0;
  }

  return {
    /** The shadows, under the trees and everything standing among them. */
    get container() {
      return layers;
    },

    /** The trees, and everything standing among them, over the shadows. */
    standing: container,

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

      // Which cells the view stands on, with a ring so a pan finds them cut (`viewCells.ts`).
      const { fromX, toX, fromY, toY } = viewCells(view, centre, layer.scale, tilt, RING);

      // Nothing is built until the camera is close enough that something is about to show, and the view is
      // small enough to be worth walking. Pulled right back a cell is eight pixels across and the view
      // holds twenty thousand of them; without this the page hangs before the map has drawn.
      const cellsInView = (toX - fromX + 1) * (toY - fromY + 1);
      built = worthBuilding(map.kinds, view.zoom, cellsInView, built, laterBy);
      if (!built) {
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
      // The arrival waits a moment for the view's woods to be built, so they come in together.
      const wantedOf = (group: number) =>
        wantedAt(thresholdOf(map.kinds, group, laterBy), view.zoom, alphaOf[group]! > 0);
      const wanting = Array.from(alphaOf, (_, group) => wantedOf(group)).some(Boolean);
      const begun = arrival > 0;
      waitingSince = wanting && !begun ? (waitingSince ?? now) : null;
      const waits = arrivalWaits(wanting, begun, viewBuilt, now - (waitingSince ?? now), sway.ready);
      if (waits) askForAFrame();
      let moving = 0;
      arrival = 0;
      for (let group = 0; group < alphaOf.length; group += 1) {
        const want = !waits && wantedOf(group) ? 1 : 0;
        const next = easeTowards(alphaOf[group]!, want, elapsed, PRESENCE_MS);
        alphaOf[group] = next;
        arrival = Math.max(arrival, next);
        if (midTrade(next)) {
          moving += 1;
        }
      }
      if (moving > 0) {
        askForAFrame();
      }

      // Pass two: the cells, the middle first, each cut and its trees built while the frame's budget lasts.
      const wanted = new Set<string>();
      const until = performance.now() + BUILD_MS;
      let cutting = 0;
      let unbuilt = 0;
      for (const { x: cellX, y: cellY } of nearestFirst(fromX, toX, fromY, toY)) {
        const key = keyOf(cellX, cellY);
        wanted.add(key);
        let cell = shown.get(key);
        // The view itself, without the ring about it, is what the arrival waits for.
        const inView = cellX > fromX && cellX < toX && cellY > fromY && cellY < toY;
        if (cell === undefined) {
          if (inView) unbuilt += 1;
          // Only so many new cells a frame. Cutting one is finished after the frame's budget is reckoned, so
          // they are counted rather than timed.
          if (cutting >= MOST_CUT_AT_ONCE) {
            askForAFrame();
            continue;
          }
          const points = pointsOf(tilesRoot, cellX, cellY, dial, spacing, askForAFrame);
          if (points === null) {
            continue;
          }
          cutting += 1;
          cell = { all: points, points: splitByGroup(points), made: new Map(), shade: new Map() };
          shown.set(key, cell);
        } else {
          // The fog moved and the gateway sent this cell's stands again, so it has been cut again: its new
          // points take the old ones' place at the fade they were at, in this frame whatever the budget, so
          // nothing blinks. On ground already revealed they are the same points. See decision record 0067.
          const now = currentPointsOf(tilesRoot, cellX, cellY, dial, spacing, askForAFrame);
          if (now !== undefined && now !== cell.all) {
            for (const group of [...cell.made.keys()]) {
              dropGroup(cell, group);
            }
            cell.all = now;
            cell.points = splitByGroup(now);
            for (const group of cell.points.keys()) makeGroup(cell, group, true);
          }
        }
        // Built whether or not the group has arrived: hidden by the arrival until it does.
        for (const group of cell.points.keys()) {
          if (cell.made.has(group)) continue;
          if (performance.now() > until) {
            askForAFrame();
            if (inView) unbuilt += 1;
            break;
          }
          makeGroup(cell, group);
        }
      }
      viewBuilt = unbuilt === 0;
      if (late.step(elapsed, fadeTo)) askForAFrame();

      for (const [key, cell] of shown) {
        if (wanted.has(key)) {
          continue;
        }
        for (const group of [...cell.made.keys()]) {
          dropGroup(cell, group);
        }
        late.forget(cell);
        shown.delete(key);
      }

      // Pass three: the arrival, laid over every tree and shadow by their layers.
      container.setAlpha(arrival);
      shadowLayer.alpha = arrival * shadowStrength;

      letGo();
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

      // Built ahead and hidden until the woods have begun to arrive, and not drawn at all till then.
      if (arrival === 0) {
        layers.visible = false;
      }

      let particles = 0;
      let showing = 0;
      let shade = 0;
      for (const cell of shown.values()) {
        for (const [group, made] of cell.made) {
          particles += made.length;
          if ((alphaOf[group] ?? 0) > 0) showing += made.length;
        }
        for (const cast of cell.shade.values()) {
          shade += cast.length;
        }
      }
      return {
        particles,
        shadows: shade,
        showing,
        cells: shown.size,
        waiting: sceneryTally().waiting,
        moving,
      };
    },

    /**
     * Where the scenery may grow from now on: everywhere, with null, or only where this says. The trees of the cells
     * `touched` names (`cellsTouched`), or of every cell held when it names none, are shown or hidden by it in this
     * same call, so no tree is left on ground a road or a yard has just worn and what the house has newly seen stands
     * as the haze over it lifts. Nothing is built for it: a tree is built once (decision record 0118).
     */
    setGround(next: ((x: number, y: number) => boolean) | null, touched?: ReadonlySet<string>): void {
      grows = next;
      for (const [key, cell] of shown) {
        if (touched === undefined || touched.has(key)) showWhereItGrows(cell);
      }
    },

    /** Everything drawn is taken out, for a change that makes every cell wrong. */
    clear(): void {
      takeEverythingOut();
    },

    destroy(): void {
      container.destroy();
      layers.destroy({ children: true });
      atlas?.destroy();
      atlas = null;
      frames = [];
    },
  };
}
