import { CELL } from '@villages/world';

import { classesOfTile, terrainPalette } from '../../geometry/terrainClasses';
import { FLAT_MAX_ZOOM, TILE } from '../../geometry/world';
import { visionAt } from '../../fog/fogField';
import type { FogField } from '../../fog/fogField';
import { currentPointsOf, sceneryMap } from '../scenery/sceneryCells';

import type { Cover, Ground } from './types';

/**
 * The ground the critters' clock asks about, as the page has it: the very trees and bushes the scenery drew, read from
 * the scenery's own cells; the terrain class of every world unit, a zoom 7 tile at a time, asked for as it is needed;
 * and what the house sees now, from the fog's field. Each answers that it does not know yet, rather than guessing,
 * while what it reads is still on its way, and asks for a frame when it comes.
 */

/** What the scenery is drawn with, so the critters come out of the same trees: as the renderer's scene says it. */
export interface SceneryHow {
  on: boolean;
  tilesRoot: string;
  dial: number;
  spacing: number;
}

/**
 * What the renderer knows that the critters need, read every frame: how the scenery is drawn, and what the house sees
 * now - undefined with the fog lifted, where everything is seen, and null for a house that sees nothing.
 */
export interface CritterSurroundings {
  scenery: SceneryHow;
  sight: FogField | null | undefined;
}

export function critterGround(around: () => CritterSurroundings, repaint: () => void): Ground {
  const scenery = () => around().scenery;
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

  return {
    coverIn(fromX, fromY, toX, toY) {
      const how = scenery();
      const map = sceneryMap();
      if (!how.on || map === null) return null;
      // Every one of the scenery's cells the square reaches, or nothing while any of them is not yet cut.
      const cover: Cover[] = [];
      for (let cellY = Math.floor(fromY / CELL); cellY <= Math.floor((toY - 1e-6) / CELL); cellY += 1) {
        for (let cellX = Math.floor(fromX / CELL); cellX <= Math.floor((toX - 1e-6) / CELL); cellX += 1) {
          const points = currentPointsOf(how.tilesRoot, cellX, cellY, how.dial, how.spacing, repaint);
          if (points === undefined) return null;
          for (const point of points) {
            if (point.x < fromX || point.x >= toX || point.y < fromY || point.y >= toY) continue;
            cover.push({
              x: point.x,
              y: point.y,
              kind: map.kinds[point.kind]?.name ?? '',
              height: point.height,
            });
          }
        }
      }
      return cover;
    },
    classAt,
    sees(x, y) {
      const sight = around().sight;
      return sight === undefined ? true : sight !== null && visionAt(sight, x, y);
    },
  };
}
