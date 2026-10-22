import type { Particle, ParticleContainer } from 'pixi.js';

import type { ArtAtlasFile } from '@villages/world';

import * as camera from '../../geometry/cameraMath';
import type { TreeParticles } from '../standing/StandingLayer';

/** What the scenery layer holds, as much of it as its report reads. */
export interface SceneryHeld {
  cells: Iterable<{ made: ReadonlyMap<number, readonly Particle[]> }>;
  artFile: ArtAtlasFile | null;
  frames: number;
  alphaOf: Float32Array;
  standing: TreeParticles;
  shadowLayer: ParticleContainer;
  tiltKey: string;
  shadows: { drawn: boolean; strength: number; frames: number };
}

/**
 * What the scenery layer actually has, from a console: `window.villagesScenery()`.
 *
 * The counters in the panel say how many particles there are; this says whether they could possibly be drawn - the
 * atlas they point at, which groups are in, and where the first one stands. The difference between "none were made"
 * and "they were made and are invisible" is otherwise a guess.
 */
export function sceneryReport(held: SceneryHeld) {
  const cells = [...held.cells];
  const firstMade = cells[0] === undefined ? undefined : [...cells[0].made.values()][0]?.[0];
  const { artFile, alphaOf, standing, shadowLayer } = held;
  return {
    atlas:
      artFile === null ? null : { width: artFile.width, height: artFile.height, version: artFile.version },
    frames: held.frames,
    groups: {
      of: alphaOf.length,
      in: [...alphaOf].filter((a) => a > 0).length,
      // Part-way in or out. Nought means the screen has settled, which it always does: the fade is
      // a function of the clock and not of the zoom, so there is nowhere to rest half-drawn.
      moving: [...alphaOf].filter((a) => a > 0 && a < 1).length,
      part: [...alphaOf].filter((a) => a > 0 && a < 1).map((a) => Number(a.toFixed(3))),
    },
    particles: cells.reduce(
      (sum, cell) => sum + [...cell.made.values()].reduce((n, made) => n + made.length, 0),
      0,
    ),
    // Whether the layer is drawn farthest first, which is the thing an eye catches as a tree standing
    // in front of one it should be behind, and cannot tell from a single wrong frame.
    ordered: standing.particleChildren.every(
      (particle, index, all) => index === 0 || camera.fartherFirst(all[index - 1]!, particle) <= 0,
    ),
    tilt: held.tiltKey,
    shadows: {
      ...held.shadows,
      particles: shadowLayer.particleChildren.length,
      blend: shadowLayer.blendMode,
    },
    first:
      firstMade === undefined
        ? null
        : { x: firstMade.x, y: firstMade.y, alpha: firstMade.alpha, scaleY: firstMade.scaleY },
    container: standing.report(),
  };
}
