import { GROUND_LATTICE, alongU, alongV, frameOf } from '@villages/world';

import { toMercator } from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import type { MapSprite } from '../SpriteRenderer';
import { WORKED } from './worked';
import type { Worked } from './worked';

/*
 * Worked ground: the ground people have worn bare, a yard under every building and later the paths between them, a
 * diamond of the ground's lattice at a time. Worked out on the page from the structures it holds and nothing else, so
 * it keeps to the fog as the buildings do: the gateway sends a building in the face it last had in sight, or not at
 * all, and a yard has no other source. Never stored and never sent, and the same on every page that holds the same
 * buildings, because every choice in it is seeded by a structure's id and a diamond. See docs/plans/worked-ground.md.
 */

/**
 * A building's yard as the lattice has it: the corner its foot stands on, how many diamonds its base covers along a
 * side, running back from that corner, and whether it is a ruin.
 */
export interface Yard {
  id: string;
  u: number;
  v: number;
  side: number;
  ruin: boolean;
}

/** How far out round a footprint a yard's ring reaches, in diamonds. */
export const RING = 3;
/** How much of a ruin's footprint is still worn, and how much of its ring, beside a building's that stands. */
const RUIN_KEPT = 0.7;
const RUIN_RING = 0.5;

const FRAME = frameOf(GROUND_LATTICE);

/** The yard of a structure on the map, or null for anything else and for one the catalogue gives no footprint yet. */
export function yardOf(sprite: MapSprite): Yard | null {
  const side = sprite.structure?.footprint;
  if (sprite.kind !== 'structure' || side === undefined) {
    return null;
  }
  const at = toMercator(sprite.at);
  const x = at.x * WORLD_MASTER_WIDTH;
  const y = at.y * WORLD_MASTER_WIDTH;
  return {
    id: sprite.id,
    u: Math.round(alongU(FRAME, x, y)),
    v: Math.round(alongV(FRAME, x, y)),
    side,
    ruin: sprite.structure?.ruin === true,
  };
}

// A diamond's key in the map of worked ground: its two whole numbers in one, every diamond of the world kept apart.
const OFFSET = 65536;
const SPAN = 262144;

export function diamondKey(u: number, v: number): number {
  return (u + OFFSET) * SPAN + (v + OFFSET);
}

export function diamondOf(key: number): { u: number; v: number } {
  return { u: Math.floor(key / SPAN) - OFFSET, v: (key % SPAN) - OFFSET };
}

/** A number for a structure's id, the seed of every choice its yard makes. FNV-1a. */
function seedOf(id: string): number {
  let hash = 0x811c9dc5;
  for (let at = 0; at < id.length; at += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(at), 0x01000193);
  }
  return hash >>> 0;
}

/** A roll between nought and one for a diamond of one yard, the same on every page. */
function roll(seed: number, u: number, v: number): number {
  let hash = seed ^ Math.imul(u, 0x27d4eb2d) ^ Math.imul(v, 0x165667b1);
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  hash = Math.imul(hash ^ (hash >>> 12), 0x297a2d39);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 4294967296;
}

/**
 * How likely a diamond is to be worn whose middle lies this many diamonds outside a footprint: one against a wall
 * nearly always, three out seldom, so a corner is rounded off and the edge is ragged.
 */
function keptAt(away: number): number {
  return Math.max(0, 1.15 - 0.42 * away);
}

/**
 * Every diamond the yards wear, by `diamondKey`, and what it is. A footprint is worn whole, a ruin's mostly; round it
 * the ring, its diamonds kept by a roll of the structure's own. Built by taking the stronger wherever two yards meet,
 * so the order the buildings come in changes nothing.
 */
export function workedGround(yards: readonly Yard[]): Map<number, Worked> {
  const worked = new Map<number, Worked>();
  const wear = (u: number, v: number, kind: Worked) => {
    const key = diamondKey(u, v);
    if (kind > (worked.get(key) ?? 0)) {
      worked.set(key, kind);
    }
  };
  for (const yard of yards) {
    const seed = seedOf(yard.id);
    const u0 = yard.u - yard.side;
    const v0 = yard.v - yard.side;
    for (let u = u0 - RING; u < yard.u + RING; u += 1) {
      for (let v = v0 - RING; v < yard.v + RING; v += 1) {
        const outU = Math.max(u0 - (u + 0.5), 0, u + 0.5 - yard.u);
        const outV = Math.max(v0 - (v + 0.5), 0, v + 0.5 - yard.v);
        const chance = roll(seed, u, v);
        if (outU === 0 && outV === 0) {
          if (!yard.ruin) {
            wear(u, v, WORKED.footprint);
          } else if (chance < RUIN_KEPT) {
            wear(u, v, WORKED.ruinFootprint);
          }
        } else if (chance < keptAt(Math.hypot(outU, outV)) * (yard.ruin ? RUIN_RING : 1)) {
          wear(u, v, yard.ruin ? WORKED.ruinRing : WORKED.ring);
        }
      }
    }
  }
  return worked;
}
