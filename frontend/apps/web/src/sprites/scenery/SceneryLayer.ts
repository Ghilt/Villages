import { Graphics, Matrix, Particle, ParticleContainer, Rectangle, RenderTexture, Texture } from 'pixi.js';
import type { Renderer } from 'pixi.js';

import { WORLD_MASTER_WIDTH } from '../../map/worldStyle';
import { toMercatorExact, worldSize } from '../cameraMath';
import type { CameraView } from '../cameraMath';
import { KINDS } from './kinds';
import { CELL, cellOf } from './scatter';
import { pointsOf, sceneryTally } from './sceneryCells';
import type { ScatteredPoint } from './scatter';
import { MOST_CUT_AT_ONCE, alphaAt, worthDrawing } from './showing';

/**
 * **This is experiment 0006, not a finished part of the game.** It was built to answer one question -
 * how much scenery the browser will draw before it lags - and it answers it. What it is *not* is a
 * world worth looking at: three kinds of the ten Adam named, drawn as a triangle, an ellipse and three
 * blades, scattered by one weight table nobody has tuned. Do not build on the look of it, and do not
 * take the numbers in it for settled. What replaces it is the **world-generator**, in
 * `docs/plans/world-generator.md`.
 */

/**
 * The world's furniture, drawn as particles under the marks.
 *
 * Every point is placed in **world units** and the whole layer is scaled and shifted once a frame, so
 * a pine grows with the ground exactly and not one of its twenty thousand positions is ever rewritten.
 * That is the shape Pixi wants: there is no per-particle scale attribute, only a vertex buffer that
 * carries the size, and touching it per particle per frame would re-upload the lot. Only the colour is
 * dynamic, because the fade lives in its alpha.
 *
 * Particles come and go a cell at a time rather than all at once, so panning across a cell boundary
 * costs one cell of work and not a screenful.
 */

/** How deep a ring of cells around the view to hold, so a pan finds them already cut. */
const RING = 1;

/** What each kind is drawn in. Bigger than it is shown, and padded so neighbours cannot bleed. */
const SLOT = { width: 64, height: 72, pad: 8 } as const;

export interface SceneryDrawn {
  /** Particles in the container, whatever their alpha. */
  particles: number;
  /** Particles with anything of them showing, which is what the eye is actually being given. */
  showing: number;
  cells: number;
  waiting: number;
}

export function createSceneryLayer(renderer: Renderer) {
  const container = new ParticleContainer({
    // Only the colour moves. The positions and the sizes are in world units and never change, so the
    // vertex buffer is written once a cell rather than once a frame.
    dynamicProperties: { position: false, vertex: false, rotation: false, uvs: false, color: true },
  });
  /**
   * What each cell put in the container: the particles, and the points they were made from.
   *
   * The points are kept beside the particles rather than asked for again when the fade is rewritten.
   * Asking again would reach the cache, and a cell the cache had let go of would be cut afresh - so
   * every zoom step over a big view would set off a storm of fetches for ground already on screen.
   */
  const shown = new Map<string, { particles: Particle[]; points: ScatteredPoint[] }>();
  let frames: Texture[] = [];
  let atlas: RenderTexture | null = null;
  let drawnAtZoom = Number.NaN;
  let drawnLaterBy = Number.NaN;
  let showing = 0;

  function buildAtlas(): void {
    const { width: w, height: h, pad } = SLOT;
    const across = KINDS.length;
    atlas = RenderTexture.create({
      width: across * (w + pad * 2),
      height: h + pad * 2,
      antialias: true,
      resolution: 1,
    });

    // A pine: three tiers of needles over a short trunk. A spire, because at twenty pixels the thing
    // that reads is the outline and nothing else.
    const pine = new Graphics()
      .rect(w * 0.44, h * 0.78, w * 0.12, h * 0.22)
      .fill(0x6b5a44)
      .moveTo(w * 0.5, h * 0.02)
      .lineTo(w * 0.78, h * 0.42)
      .lineTo(w * 0.62, h * 0.42)
      .lineTo(w * 0.86, h * 0.8)
      .lineTo(w * 0.14, h * 0.8)
      .lineTo(w * 0.38, h * 0.42)
      .lineTo(w * 0.22, h * 0.42)
      .closePath()
      .fill(0xffffff)
      .stroke({ width: 3, color: 0x3d4a33, alpha: 0.85 });

    // An oak: a round crown on a trunk, wider than it is tall, so it tells against the pine at a
    // glance rather than needing to be looked at.
    const oak = new Graphics()
      .rect(w * 0.45, h * 0.66, w * 0.1, h * 0.34)
      .fill(0x6b5a44)
      .ellipse(w * 0.5, h * 0.4, w * 0.42, h * 0.36)
      .fill(0xffffff)
      .stroke({ width: 3, color: 0x3d4a33, alpha: 0.85 });

    // A tuft: three blades from one root. Small, and drawn to survive being small.
    const tuft = new Graphics()
      .moveTo(w * 0.5, h)
      .lineTo(w * 0.18, h * 0.3)
      .lineTo(w * 0.36, h * 0.34)
      .lineTo(w * 0.5, h * 0.08)
      .lineTo(w * 0.64, h * 0.34)
      .lineTo(w * 0.82, h * 0.3)
      .closePath()
      .fill(0xffffff)
      .stroke({ width: 3, color: 0x4a5237, alpha: 0.85 });

    const shapes = [pine, oak, tuft];
    const move = new Matrix();
    frames = shapes.map((shape, index) => {
      const x = index * (w + pad * 2) + pad;
      renderer.render({
        container: shape,
        target: atlas as RenderTexture,
        transform: move.identity().translate(x, pad),
        clear: index === 0,
      });
      shape.destroy();
      return new Texture({
        source: (atlas as RenderTexture).source,
        frame: new Rectangle(x, pad, w, h),
      });
    });
    // Named rather than left to be latched from the first particle: the container takes its texture
    // from children[0] once and never looks again, so a container told nothing would keep whichever
    // kind happened to be added first even after that one was taken away.
    const first = frames[0];
    if (first !== undefined) {
      container.texture = first;
    }
  }

  function keyOf(cellX: number, cellY: number): string {
    return `${cellX}/${cellY}`;
  }

  function takeEverythingOut(): void {
    for (const cell of shown.values()) {
      for (const particle of cell.particles) {
        container.removeParticle(particle);
      }
    }
    shown.clear();
    drawnAtZoom = Number.NaN;
    showing = 0;
  }

  return {
    get container() {
      return container;
    },

    ready(): boolean {
      return atlas !== null;
    },

    /**
     * Draws the furniture for this view.
     *
     * Cells are added and taken away as the view moves over them; alphas are rewritten only when the
     * zoom has actually changed, because a point's share of the fade is a function of the zoom and its
     * own rank and of nothing else.
     */
    update(
      view: CameraView,
      tilesRoot: string,
      spacing: number,
      laterBy: number,
      askForAFrame: () => void,
    ): SceneryDrawn {
      if (atlas === null) {
        buildAtlas();
      }

      const size = worldSize(view.zoom);
      const centre = toMercatorExact(view.center);
      const perUnit = size / WORLD_MASTER_WIDTH;
      container.scale.set(perUnit);
      container.x = view.width / 2 - centre.x * size;
      container.y = view.height / 2 - centre.y * size;

      // Which cells the view stands on, in world units, with a ring so a pan finds them cut.
      const leftUnit = (centre.x * size - view.width / 2) / perUnit;
      const topUnit = (centre.y * size - view.height / 2) / perUnit;
      const fromX = cellOf(leftUnit) - RING;
      const toX = cellOf(leftUnit + view.width / perUnit) + RING;
      const fromY = cellOf(topUnit) - RING;
      const toY = cellOf(topUnit + view.height / perUnit) + RING;

      // Nothing is drawn until the camera is close enough that something would show, and the view is
      // small enough to be worth walking. Pulled right back a cell is eight pixels across and the
      // view holds twenty thousand of them; without this the page hangs before the map has drawn.
      const cellsInView = (toX - fromX + 1) * (toY - fromY + 1);
      if (!worthDrawing(view.zoom, cellsInView, laterBy)) {
        if (shown.size > 0) {
          takeEverythingOut();
        }
        return { particles: 0, showing: 0, cells: 0, waiting: sceneryTally().waiting };
      }

      const wanted = new Set<string>();
      let cutting = 0;
      for (let cellY = fromY; cellY <= toY; cellY += 1) {
        for (let cellX = fromX; cellX <= toX; cellX += 1) {
          const key = keyOf(cellX, cellY);
          wanted.add(key);
          if (shown.has(key)) {
            continue;
          }
          // Only so many new cells a frame. Arriving somewhere new otherwise cuts a screenful at
          // once, which is one long frame exactly when the camera is moving.
          if (cutting >= MOST_CUT_AT_ONCE) {
            askForAFrame();
            continue;
          }
          const points = pointsOf(tilesRoot, cellX, cellY, spacing, askForAFrame);
          if (points === null) {
            continue;
          }
          cutting += 1;
          const made = points.map((point) => {
            const texture = frames[point.kind] ?? frames[0]!;
            const particle = new Particle({ texture });
            particle.x = point.x;
            particle.y = point.y;
            // The foot stands on the place, the same anchor a castle's forms share.
            particle.anchorX = 0.5;
            particle.anchorY = 1;
            // Sized in world units, so the container's one transform turns it into pixels.
            particle.scaleY = point.height / texture.height;
            particle.scaleX = particle.scaleY;
            particle.alpha = 0;
            return particle;
          });
          shown.set(key, { particles: made, points });
          if (made.length > 0) {
            container.addParticle(...made);
          }
          drawnAtZoom = Number.NaN;
        }
      }

      for (const [key, cell] of shown) {
        if (wanted.has(key)) {
          continue;
        }
        for (const particle of cell.particles) {
          container.removeParticle(particle);
        }
        shown.delete(key);
        drawnAtZoom = Number.NaN;
      }

      // The fade is a function of the zoom and each point's own rank, so it is rewritten when the
      // zoom moves and not otherwise. Standing still costs nothing at all.
      if (view.zoom !== drawnAtZoom || laterBy !== drawnLaterBy) {
        drawnAtZoom = view.zoom;
        drawnLaterBy = laterBy;
        showing = 0;
        for (const cell of shown.values()) {
          for (let index = 0; index < cell.particles.length; index += 1) {
            const point = cell.points[index];
            const particle = cell.particles[index];
            if (point === undefined || particle === undefined) {
              continue;
            }
            const alpha = alphaAt(view.zoom, point.height, point.rank, laterBy);
            particle.alpha = alpha;
            if (alpha > 0) {
              showing += 1;
            }
          }
        }
      }

      const tally = sceneryTally();
      let particles = 0;
      for (const cell of shown.values()) {
        particles += cell.particles.length;
      }
      return { particles, showing, cells: shown.size, waiting: tally.waiting };
    },

    /** Everything drawn is taken out, for a change that makes every cell wrong. */
    clear(): void {
      takeEverythingOut();
    },

    destroy(): void {
      container.destroy();
      atlas?.destroy(true);
      atlas = null;
      frames = [];
    },
  };
}

export { CELL };
