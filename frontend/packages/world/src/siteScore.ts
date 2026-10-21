import { GROUND_LATTICE, alongU, alongV, frameOf, worldXOf, worldYOf } from './lattice.ts';
import type { Tier } from './ruins.ts';
import type { SettlementType, SettlementsFile } from './settlements.ts';

/*
 * The ground a settlement site is chosen on, and what a site is: how a place scores to live on, whether water makes
 * it a fishing village, the lattice corner it stands on, and the small sums the choosing shares. The choosing is
 * `settlementSites.ts`. See decision record 0114.
 */

const FRAME = frameOf(GROUND_LATTICE);
const OPEN_WATER = new Set(['ocean', 'shallow-sea', 'lake']);
const RIVER = 'river';

/** The ground a site is chosen on, a point of world space at a time. */
export interface SiteGround {
  /** The class's name at a point, as the zoom-7 tiles have it. */
  classAt(x: number, y: number): string;
  /** The height in metres at a point; the sea's is nought. */
  heightAt(x: number, y: number): number;
  /** How big the river at a point is, nought for none to one for the greatest, by `world:flow`. */
  riverAt(x: number, y: number): number;
}

/** A town of 1790 as the sites beside it need it: its middle, how far its ruins reach, in world units, and its tier. */
export interface RuinPlace {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly reach: number;
  readonly tier: Tier;
}

/** One settlement site: its id, its type and level, the lattice corner its middle stands on, and its place. */
export interface Site {
  readonly id: string;
  readonly type: SettlementType;
  readonly level: 1 | 2 | 3;
  readonly u: number;
  readonly v: number;
  readonly x: number;
  readonly y: number;
  /** The town of 1790 it stands beside, by its id, or null in open country. */
  readonly by: string | null;
  readonly score: number;
}

/** How a place scores: nought to one, and whether the water by it makes it a fishing village. Null where none can stand. */
export interface Score {
  readonly score: number;
  readonly fishing: boolean;
}

/** The lattice corner nearest a point of world space, and where it is. */
export function cornerNear(x: number, y: number): { u: number; v: number; x: number; y: number } {
  const u = Math.round(alongU(FRAME, x, y));
  const v = Math.round(alongV(FRAME, x, y));
  return { u, v, x: worldXOf(FRAME, u, v), y: worldYOf(FRAME, u, v) };
}

/**
 * How a settlement whose middle is the lattice corner `u`, `v` would score, on a square of ground `side` diamonds
 * across and a diamond more each way: the mean of how good its ground is to live on, the open water left out, a little
 * more where a small river runs through it. None where its middle or a diamond about it is water or ground nobody
 * lives on, where its ground climbs further than the file allows, or where water takes more than a fishing village's
 * share of it; a fishing village where water takes a fishing village's share.
 */
export function scoreAt(
  file: SettlementsFile,
  ground: SiteGround,
  u: number,
  v: number,
  side: number,
): Score | null {
  const at = (du: number, dv: number): { x: number; y: number } => ({
    x: worldXOf(FRAME, u + du, v + dv),
    y: worldYOf(FRAME, u + du, v + dv),
  });
  // The four diamonds about the middle and the ring round them, each read at its own middle.
  for (let du = -1.5; du <= 1.5; du += 1) {
    for (let dv = -1.5; dv <= 1.5; dv += 1) {
      const { x, y } = at(du, dv);
      const terrain = ground.classAt(x, y);
      if (OPEN_WATER.has(terrain) || terrain === RIVER || (file.ground[terrain] ?? 0) === 0) {
        return null;
      }
    }
  }
  const reach = Math.floor(side / 2) + 1;
  let land = 0;
  let water = 0;
  let worth = 0;
  let river = false;
  let lowest = Infinity;
  let highest = -Infinity;
  for (let du = -reach; du <= reach; du += 1.5) {
    for (let dv = -reach; dv <= reach; dv += 1.5) {
      const { x, y } = at(du, dv);
      const terrain = ground.classAt(x, y);
      const isRiver = terrain === RIVER;
      if (OPEN_WATER.has(terrain) || (isRiver && ground.riverAt(x, y) >= file.fishing.river)) {
        water += 1;
        continue;
      }
      if (isRiver) {
        river = true;
        continue;
      }
      land += 1;
      worth += file.ground[terrain] ?? 0;
      const height = ground.heightAt(x, y);
      lowest = Math.min(lowest, height);
      highest = Math.max(highest, height);
    }
  }
  const wet = water / (water + land);
  if (land === 0 || highest - lowest > file.reliefMetres || wet > file.fishing.water[1]) {
    return null;
  }
  return {
    score: Math.min(1, worth / land + (river ? file.riverBonus : 0)),
    fishing: wet >= file.fishing.water[0],
  };
}

/**
 * The level a site in open country stands at, a hamlet, a village or a large village, by a roll of its own, nought to
 * one, against the file's shares, which its score narrows: on the best ground so many are villages, on poorer fewer.
 */
export function levelOf(file: SettlementsFile, score: number, roll: number): 1 | 2 | 3 {
  return roll < file.levels.large * score ? 3 : roll < file.levels.village * score ? 2 : 1;
}

/** A number for a string, FNV-1a: what turns a town's id or a candidate's place into a bearing or a jitter. */
export function hashOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let at = 0; at < text.length; at += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(at), 0x01000193);
  }
  return hash >>> 0;
}

/** The shortest way from one x to another across the world's edge, which longitude wraps. */
export function across(from: number, to: number, width: number): number {
  const d = (((to - from) % width) + width) % width;
  return d > width / 2 ? d - width : d;
}

export function apart(a: { x: number; y: number }, b: { x: number; y: number }, width: number): number {
  return Math.hypot(across(a.x, b.x, width), b.y - a.y);
}
