import { ImageSource, Matrix, Particle, ParticleContainer, Rectangle, Texture } from 'pixi.js';

import { note } from '../../debug/log';
import { WORLD_MASTER_WIDTH } from '../../map/worldStyle';
import { toMercatorExact, worldSize } from '../cameraMath';
import type { CameraView } from '../cameraMath';
import { LONGEST_STEP_MS, PRESENCE_MS, easeTowards, midTrade } from '../twoForms';
import { CELL, biomeAt, cellOf } from '@villages/world';
import type { ArtAtlasFile, Kind, ScatteredPoint } from '@villages/world';
import { noteDrawn, pointsOf, sceneryMap, sceneryTally } from './sceneryCells';
import { MOST_CUT_AT_ONCE, groupCount, groupOf, thresholdOf, wantedAt, worthDrawing } from './showing';

/**
 * The world's furniture, drawn as particles under the marks.
 *
 * Every point is placed in **world units** and the whole layer is scaled and shifted once a frame, so a
 * pine grows with the ground exactly and not one of its twenty thousand positions is ever rewritten.
 * That is the shape Pixi wants: there is no per-particle scale attribute, only a vertex buffer that
 * carries the size, and touching it per particle per frame would re-upload the lot. Only the colour is
 * dynamic, because the fade lives in its alpha.
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
 */

/** How deep a ring of cells around the view to hold, so a pan finds them already cut. */
const RING = 1;

/**
 * Where the art is: the atlas `npm run world:art` cuts from `world/sprites/scenery/`, and its frames.
 * Generated and per-worktree, like the tiles, and served from the page's own origin. See decision 0057.
 */
const ART = '/art/scenery';

export interface SceneryDrawn {
  /** Particles in the container. Every one of them is showing, because the others are not made. */
  particles: number;
  showing: number;
  cells: number;
  waiting: number;
  /** Groups part-way in or out right now. Nought means the screen has settled. */
  moving: number;
}

/** One cell's points, split by group, and whichever of them are currently drawn. */
interface Held {
  points: Map<number, ScatteredPoint[]>;
  made: Map<number, Particle[]>;
}

export function createSceneryLayer() {
  const container = new ParticleContainer({
    // Only the colour moves. The positions and the sizes are in world units and never change, so the
    // vertex buffer is written once a group rather than once a frame.
    dynamicProperties: { position: false, vertex: false, rotation: false, uvs: false, color: true },
  });
  const shown = new Map<string, Held>();
  let frames: Texture[] = [];
  /** Where each kind stands in its own frame, as a fraction of it: the anchor. */
  let feet: { x: number; y: number }[] = [];
  let atlas: ImageSource | null = null;
  let artFile: ArtAtlasFile | null = null;
  /** Asked for and not yet here, so it is asked for once. */
  let loadingArt = false;
  /** Asked for and not there, so the layer draws nothing rather than asking every frame. */
  let noArt = false;

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
        return { texture: Texture.EMPTY, foot: { x: 0.5, y: 1 } };
      }
      return {
        texture: new Texture({ source, frame: new Rectangle(frame.x, frame.y, frame.width, frame.height) }),
        foot: { x: frame.footX / frame.width, y: frame.footY / frame.height },
      };
    });
    frames = cut.map((one) => one.texture);
    feet = cut.map((one) => one.foot);
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
      const foot = feet[point.kind] ?? { x: 0.5, y: 1 };
      // The art carries its own colour, so nothing tints it; only the fade's alpha moves after this.
      const particle = new Particle({ texture });
      particle.x = point.x;
      particle.y = point.y;
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
  }

  function dropGroup(cell: Held, group: number): void {
    const made = cell.made.get(group);
    if (made === undefined) {
      return;
    }
    for (const particle of made) {
      container.removeParticle(particle);
    }
    cell.made.delete(group);
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
    get container() {
      return container;
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
      view: CameraView,
      tilesRoot: string,
      dial: number,
      laterBy: number,
      askForAFrame: () => void,
    ): SceneryDrawn {
      // The kinds come from the master's sprite map, so nothing can be drawn until it is in hand. One
      // cell is asked for to set that fetch going, and the first frame after it lands builds the atlas.
      const map = sceneryMap();
      if (map === null) {
        pointsOf(
          tilesRoot,
          cellOf(toMercatorExact(view.center).x * WORLD_MASTER_WIDTH),
          0,
          dial,
          askForAFrame,
        );
        return { particles: 0, showing: 0, cells: 0, waiting: sceneryTally().waiting, moving: 0 };
      }
      if (atlas === null || artFile === null) {
        if (!loadingArt && !noArt) {
          void loadArt(askForAFrame);
        }
        return { particles: 0, showing: 0, cells: 0, waiting: sceneryTally().waiting, moving: 0 };
      }
      if (frames.length === 0) {
        frameKinds(map.kinds, artFile, atlas);
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

      const size = worldSize(view.zoom);
      const centre = toMercatorExact(view.center);
      const perUnit = size / WORLD_MASTER_WIDTH;

      // The whole layer is placed by one matrix, which is what makes twenty thousand pines cost one
      // multiply rather than twenty thousand. Turning and tilting the camera does not change that: an
      // orthographic camera is affine, so the turn and the squash fold into the same matrix and the
      // particles' own buffer is still never touched. See decision record 0052 and experiment 0008.
      //
      // What it does not buy is a tree that stands up. The matrix squashes every particle along with the
      // ground it stands on, so tilted the scatter lies down. Standing it up needs a per-particle scale,
      // which is the one thing the static vertex buffer exists to avoid.
      const turn = ((view.bearing ?? 0) * Math.PI) / 180;
      const lean = Math.cos(((view.pitch ?? 0) * Math.PI) / 180);
      const sin = Math.sin(turn);
      const cos = Math.cos(turn);
      container.setFromMatrix(
        new Matrix(
          perUnit * cos,
          -perUnit * sin * lean,
          perUnit * sin,
          perUnit * cos * lean,
          view.width / 2 - (centre.x * cos + centre.y * sin) * size,
          view.height / 2 + (centre.x * sin - centre.y * cos) * size * lean,
        ),
      );
      // Which biome the camera is over, for the panel. One array read a frame, and it is the one reading
      // that turns "the world looks different over there" into a name Adam can argue with.
      noteDrawn({
        biome: map.names[biomeAt(map, centre.x * WORLD_MASTER_WIDTH, centre.y * WORLD_MASTER_WIDTH)] ?? '',
      });

      // Which cells the view stands on, in world units, with a ring so a pan finds them cut.
      //
      // Tilted, the ground under the window is a turned rectangle stretched along the lean, so the
      // axis-aligned box that used to be the window's own corners would leave the far corners bare.
      // These are the same four corners carried back through the projection above, which is exact at
      // any angle and is the old arithmetic exactly when the camera is flat and north-up.
      const halfWide = view.width / 2;
      const halfHigh = view.height / 2 / (lean === 0 ? 1 : lean);
      const eastsAndSouths = [
        [-halfWide, -halfHigh],
        [halfWide, -halfHigh],
        [-halfWide, halfHigh],
        [halfWide, halfHigh],
      ].map(([sx = 0, sy = 0]) => [sx * cos - sy * sin, sx * sin + sy * cos] as const);
      const centreUnitX = (centre.x * size) / perUnit;
      const centreUnitY = (centre.y * size) / perUnit;
      const eastUnits = eastsAndSouths.map(([east]) => centreUnitX + east / perUnit);
      const southUnits = eastsAndSouths.map(([, south]) => centreUnitY + south / perUnit);
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
        return { particles: 0, showing: 0, cells: 0, waiting: sceneryTally().waiting, moving: 0 };
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
            const points = pointsOf(tilesRoot, cellX, cellY, dial, askForAFrame);
            if (points === null) {
              continue;
            }
            cutting += 1;
            cell = { points: splitByGroup(points), made: new Map() };
            shown.set(key, cell);
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
        }
      }

      let particles = 0;
      for (const cell of shown.values()) {
        for (const made of cell.made.values()) {
          particles += made.length;
        }
      }
      return { particles, showing: particles, cells: shown.size, waiting: sceneryTally().waiting, moving };
    },

    /** Everything drawn is taken out, for a change that makes every cell wrong. */
    clear(): void {
      takeEverythingOut();
    },

    destroy(): void {
      container.destroy();
      atlas?.destroy();
      atlas = null;
      frames = [];
    },
  };
}

export { CELL };
