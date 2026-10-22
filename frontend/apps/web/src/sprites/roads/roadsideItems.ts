import {
  BRIDGE_WAYS,
  GROUND_LATTICE,
  WALL_LENGTH,
  WAY_STEPS,
  frameOf,
  readRoadKind,
  roadsideOf,
} from '@villages/world';
import type { BridgeWay, RoadsMapFile, WallStyle } from '@villages/world';

import type { HeldPiece } from '../ground/roads';

/*
 * Where the roadside stands: along both sides of every piece of road, just past its band, stubs of dry-stone wall laid
 * end to end in runs where the biome builds walls, and the biome's own small growth between them, in clumps: a stretch
 * bare, a stretch full of it, a stretch of it in patches with gaps between (`growthChance`). Everything is worked
 * out from the piece and the place, by a seed of where it falls, so every page lays the same roadside and the fog
 * lifting never moves it. Only on ground the road keeps clear for it - never in a settlement, on water or on another
 * road - and only where the house has revealed the ground. See docs/plans/houses-bridges-and-road-render.md.
 */

/** A thing of the roadside: a wall's stub, by its style and way, or growth, by its kind of the scenery. */
export type RoadsideItem =
  | { readonly x: number; readonly y: number; readonly wall: WallStyle; readonly way: BridgeWay }
  | { readonly x: number; readonly y: number; readonly kind: string; readonly size: number };

/** How far past a road's band its roadside stands, in world units. */
const GAP = 0.32;
/** How far apart the growth may stand along a road. */
const GROWTH_STEP = 0.5;
/**
 * How long a stretch of the roadside's growth runs, in world units, and where the noise along it makes one bare, full
 * or spotty: under `BARE` none, over `FULL` nearly every place, and between, patches about `PATCH` units across.
 */
const STRETCH = 9;
const BARE = 0.42;
const FULL = 0.6;
const PATCH = 1.6;
const FULL_CHANCE = 0.9;
const PATCH_CHANCE = 0.8;
/** How much of a stub's length the next starts at, so stubs laid end to end leave no gap. */
const OVERLAP = 0.9;
/** How far a run of wall reaches, in world units: the scale of the noise that says where a road is walled. */
const RUN = 7;

const FRAME = frameOf(GROUND_LATTICE);
const WAYS = BRIDGE_WAYS.map((way) => {
  const [u, v] = WAY_STEPS[way];
  const length = Math.hypot(u, v);
  return { way, x: (u * FRAME.cos - v * FRAME.sin) / length, y: (u * FRAME.sin + v * FRAME.cos) / length };
});

/** The way of the eight nearest a direction. */
export function wayNearest(dx: number, dy: number): BridgeWay {
  let best = WAYS[0]!;
  let most = -1;
  for (const one of WAYS) {
    const along = Math.abs(one.x * dx + one.y * dy);
    if (along > most) {
      most = along;
      best = one;
    }
  }
  return best.way;
}

/** A number between nought and one for a place, the same on every page. */
export function seedAt(x: number, y: number, salt: number): number {
  let hash =
    Math.imul(Math.round(x * 8) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.round(y * 8) ^ salt, 0xc2b2ae35);
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  return ((hash ^ (hash >>> 12)) >>> 0) / 4294967296;
}

/** A smooth noise over the ground, nought to one, varying over `across` units, one of its own for each salt. */
function smoothAt(x: number, y: number, across: number, salt: number): number {
  const fx = x / across;
  const fy = y / across;
  const [x0, y0] = [Math.floor(fx), Math.floor(fy)];
  const [tx, ty] = [fx - x0, fy - y0];
  const [sx, sy] = [tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)];
  const corner = (cx: number, cy: number) => seedAt(cx, cy, salt);
  const top = corner(x0, y0) * (1 - sx) + corner(x0 + 1, y0) * sx;
  const bottom = corner(x0, y0 + 1) * (1 - sx) + corner(x0 + 1, y0 + 1) * sx;
  return top * (1 - sy) + bottom * sy;
}

/** How likely a place beside a road is to have growth: none on a bare stretch, most on a full one, in patches between. */
export function growthChance(x: number, y: number): number {
  const stretch = smoothAt(x, y, STRETCH, 91);
  if (stretch < BARE) return 0;
  if (stretch > FULL) return FULL_CHANCE;
  return smoothAt(x, y, PATCH, 93) > 0.55 ? PATCH_CHANCE : 0;
}

/** The one of a biome's growth a roll picks, by its weights. */
function growthOf(growth: Readonly<Record<string, number>>, roll: number): string | null {
  const kinds = Object.entries(growth);
  const total = kinds.reduce((sum, [, weight]) => sum + weight, 0);
  let left = roll * total;
  for (const [kind, weight] of kinds) {
    left -= weight;
    if (left < 0) return kind;
  }
  return kinds[kinds.length - 1]?.[0] ?? null;
}

export interface RoadsideGround {
  /** The biome's name at a place, as `world/biomes.json` names it. */
  biome(x: number, y: number): string;
  /** Whether a place is ground a road keeps clear, on land and revealed: the only ground the roadside stands on. */
  clear(x: number, y: number): boolean;
  /** Whether a place is on a road's own band. */
  onRoad(x: number, y: number): boolean;
}

/** The roadside of every piece held, as wide as its grade is drawn times `scale`. */
export function roadsideAlong(
  pieces: readonly HeldPiece[],
  widths: RoadsMapFile['widths'],
  scale: number,
  ground: RoadsideGround,
): RoadsideItem[] {
  const items: RoadsideItem[] = [];
  for (const piece of pieces) {
    const kind = readRoadKind(piece.kind);
    if (kind === null || 'bridge' in kind) continue;
    const dx = piece.bx - piece.ax;
    const dy = piece.by - piece.ay;
    const long = Math.hypot(dx, dy);
    if (long === 0) continue;
    const [ux, uy] = [dx / long, dy / long];
    const offset = (widths[kind.road] / 2) * scale + GAP;
    const way = wayNearest(ux, uy);
    for (const side of [-1, 1]) {
      const [nx, ny] = [-uy * side, ux * side];
      // Stubs of wall end to end, where the noise along the road says it is walled.
      const walled: number[] = [];
      for (let along = WALL_LENGTH / 2; along < long; along += WALL_LENGTH * OVERLAP) {
        const x = piece.ax + ux * along + nx * offset;
        const y = piece.ay + uy * along + ny * offset;
        const look = roadsideOf(ground.biome(x, y));
        // Where a road runs walled: a noise over `RUN` units.
        if (look.wall === null || smoothAt(x, y, RUN, 77) >= look.walled) continue;
        if (!ground.clear(x, y) || ground.onRoad(x, y)) continue;
        items.push({ x, y, wall: look.wall, way });
        walled.push(along);
      }
      // The growth between, and in front of a wall now and then.
      for (let along = GROWTH_STEP / 2; along < long; along += GROWTH_STEP) {
        const at = piece.ax + ux * along;
        const atY = piece.ay + uy * along;
        if (seedAt(at, atY, 11 + side) >= growthChance(at, atY)) continue;
        const beside = walled.some((stub) => Math.abs(stub - along) < WALL_LENGTH / 2);
        const out = offset + (beside ? 0.28 : 0) + (seedAt(at, atY, 13 + side) - 0.5) * 0.3;
        const x = at + nx * out + ux * (seedAt(at, atY, 17) - 0.5) * 0.3;
        const y = atY + ny * out + uy * (seedAt(at, atY, 19) - 0.5) * 0.3;
        if (!ground.clear(x, y) || ground.onRoad(x, y)) continue;
        const grows = growthOf(roadsideOf(ground.biome(x, y)).growth, seedAt(x, y, 23));
        if (grows === null) continue;
        items.push({ x, y, kind: grows, size: 0.8 + 0.4 * seedAt(x, y, 29) });
      }
    }
  }
  return items;
}
