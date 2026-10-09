import type { WaterKind } from '@villages/protocol';

import { revealedAt } from '../fog/fogField';
import type { FogField } from '../fog/fogField';
import { FLAT_MAX_ZOOM, TILE, WORLD_MASTER_WIDTH } from '../geometry/world';
import { classesOfTile, terrainPalette } from '../geometry/terrainClasses';
import type { LngLat, Open } from './waterReach';

/**
 * The ground a click named water on, as the ripple reads it: the zoom 7 tiles about it, read once,
 * which are the master's own pixels, and which of them are water of the kind named on ground the page may show -
 * every one with the fog lifted, which is no field; only what the field reveals with it on; none where the house has
 * revealed nothing, which is a null field. The page's own tiles, so nothing of it is the server's.
 */

/** Which terrain classes are the water of each kind. */
const CLASSES: Readonly<Record<WaterKind, readonly string[]>> = {
  river: ['river'],
  lake: ['lake'],
  sea: ['ocean', 'shallow-sea'],
};

/** How many screen pixels across MapLibre draws the whole world at zoom nought, whatever the tiles are cut at. */
const WORLD_PX = 512;

/** Screen pixels a world unit is across at a zoom, on a master this many units wide. */
export function pixelsAt(zoom: number, width: number): number {
  return (WORLD_PX * 2 ** zoom) / width;
}

/** How many world units the master is across: what a grid is as wide as. */
export async function masterWidth(): Promise<number> {
  return (await terrainPalette()).masterWidth;
}

/** Where a place is in world space, in world units from the north-west corner. */
export function worldOf(place: LngLat, width: number): [number, number] {
  const sinLat = Math.sin((place.lat * Math.PI) / 180);
  return [
    ((place.lng + 180) / 360) * width,
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * width,
  ];
}

/**
 * Which pixels are open, read from the tiles within `span` world units of every place `around` - or, `whole`, every
 * tile of the box they and that span make, which is what a lake's shores need for the water inside them.
 */
export async function waterGround(
  kind: WaterKind,
  worldRoot: string,
  field: FogField | null | undefined,
  around: readonly LngLat[],
  span: number,
  whole = false,
): Promise<Open> {
  const palette = await terrainPalette();
  const width = palette.masterWidth;
  const ids = new Set(palette.classes.filter((one) => CLASSES[kind].includes(one.name)).map((one) => one.id));

  const perPixel = width / (TILE * 2 ** FLAT_MAX_ZOOM);
  const across = 2 ** FLAT_MAX_ZOOM;
  const keyOf = (tileX: number, tileY: number) => tileY * across + (((tileX % across) + across) % across);
  const tileOf = (at: number) => Math.floor(at / perPixel / TILE);
  const places = around.map((place) => worldOf(place, width));
  const boxes = whole
    ? [
        [
          Math.min(...places.map(([x]) => x)) - span,
          Math.min(...places.map(([, y]) => y)) - span,
          Math.max(...places.map(([x]) => x)) + span,
          Math.max(...places.map(([, y]) => y)) + span,
        ],
      ]
    : places.map(([x, y]) => [x - span, y - span, x + span, y + span]);
  const tiles = new Map<number, Uint8Array | null>();
  const wanted: Promise<void>[] = [];
  for (const [left, top, right, bottom] of boxes) {
    for (let tileY = tileOf(top!); tileY <= tileOf(bottom!); tileY += 1) {
      for (let tileX = tileOf(left!); tileX <= tileOf(right!); tileX += 1) {
        const key = keyOf(tileX, tileY);
        if (!tiles.has(key)) {
          tiles.set(key, null);
          wanted.push(
            classesOfTile(worldRoot, FLAT_MAX_ZOOM, tileX, tileY, palette).then((classes) => {
              tiles.set(key, classes);
            }),
          );
        }
      }
    }
  }
  await Promise.all(wanted);

  const toFog = WORLD_MASTER_WIDTH / width;
  return (atX, atY) => {
    const column = Math.floor(atX / perPixel);
    const row = Math.floor(atY / perPixel);
    const tileX = Math.floor(column / TILE);
    const tileY = Math.floor(row / TILE);
    const id = tiles.get(keyOf(tileX, tileY))?.[(row - tileY * TILE) * TILE + (column - tileX * TILE)];
    if (id === undefined || !ids.has(id)) {
      return false;
    }
    return field === undefined || (field !== null && revealedAt(field, atX * toFog, atY * toFog));
  };
}
