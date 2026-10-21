import { GROUND_LATTICE, alongU, alongV, frameOf, worldXOf, worldYOf } from './lattice.ts';
import type { Tier } from './ruins.ts';
import { TIERS } from './ruins.ts';
import { unitsOfKm } from './settlements.ts';
import type { SettlementType, SettlementsFile } from './settlements.ts';

/*
 * Where every settlement stands: chosen by the bake, `world:settlements`, from the ground as the zoom-7 tiles have it,
 * its height and its rivers, and the ruins of 1790. Two kinds of site, each with an id that outlives a repaint, so that
 * the settlement the opening raised on it is never raised again somewhere else (decision record 0114):
 *
 * - **beside a ruin**, `ruin:<town>:<k>`: past the edge of its overgrowth at a bearing worked out from the town's id,
 *   turned an eighth of a circle at a time until it stands on ground a settlement can stand on. It moves with its town.
 * - **in open country**, `site:<gx>:<gy>`: a candidate a grid of `grid` world units holds, kept where it scores well
 *   enough and nothing within the spacing scores better. A repaint moves only the sites near what was painted.
 *
 * Every place is a corner of the ground's lattice, the middle of the settlement's square of ground.
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

/** The level a site of a score stands at: a hamlet, a village or a large village. */
export function levelOf(file: SettlementsFile, score: number): 1 | 2 | 3 {
  return score >= file.levels[1] ? 3 : score >= file.levels[0] ? 2 : 1;
}

/** A number for a string, FNV-1a: what turns a town's id or a candidate's place into a bearing or a jitter. */
function hashOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let at = 0; at < text.length; at += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(at), 0x01000193);
  }
  return hash >>> 0;
}

/** The shortest way from one x to another across the world's edge, which longitude wraps. */
function across(from: number, to: number, width: number): number {
  const d = (((to - from) % width) + width) % width;
  return d > width / 2 ? d - width : d;
}

function apart(a: { x: number; y: number }, b: { x: number; y: number }, width: number): number {
  return Math.hypot(across(a.x, b.x, width), b.y - a.y);
}

/** Whether a point stands within any ruin's reach, and so not on ground a settlement may take. */
function inARuin(ruins: readonly RuinPlace[], x: number, y: number, width: number, margin: number): boolean {
  return ruins.some((ruin) => apart(ruin, { x, y }, width) < ruin.reach + margin);
}

/**
 * The sites beside the ruins of 1790: so many for each by its tier, the greatest towns first, each past the edge of
 * its town's overgrowth and half a hamlet's square, at a bearing worked out from the town's id and its count, turned
 * an eighth at a time until it stands on ground a settlement can, in no ruin's reach and no nearer another such site
 * than `apartKm`. A site with no such ground in eight turns is passed over. `side` is a hamlet's square.
 */
export function sitesBesideRuins(
  file: SettlementsFile,
  ground: SiteGround,
  ruins: readonly RuinPlace[],
  width: number,
  side: number,
): Site[] {
  const ordered = [...ruins].sort(
    (a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const sites: Site[] = [];
  for (const ruin of ordered) {
    const count = file.beside.sites[ruin.tier];
    const first = hashOf(ruin.id) % 360;
    const away = ruin.reach + unitsOfKm(file.beside.gapKm, ruin.y, width) + side / 2;
    const apartUnits = unitsOfKm(file.beside.apartKm, ruin.y, width);
    for (let k = 0; k < count; k += 1) {
      for (let turn = 0; turn < 8; turn += 1) {
        const bearing = ((first + (k * 360) / count + turn * 45) * Math.PI) / 180;
        const x = (((ruin.x + away * Math.sin(bearing)) % width) + width) % width;
        const corner = cornerNear(x, ruin.y - away * Math.cos(bearing));
        const score = scoreAt(file, ground, corner.u, corner.v, side);
        if (
          score === null ||
          inARuin(ruins, corner.x, corner.y, width, side / 2) ||
          sites.some((site) => apart(site, corner, width) < apartUnits)
        ) {
          continue;
        }
        sites.push({
          id: `ruin:${ruin.id}:${k}`,
          type: score.fishing ? 'fishingVillage' : 'village',
          level: file.beside.level[ruin.tier] as 1 | 2 | 3,
          ...corner,
          by: ruin.id,
          score: score.score,
        });
        break;
      }
    }
  }
  return sites;
}

/** A candidate in open country, scored: its place on the grid, which is its id, its lattice corner and its score. */
export interface Candidate {
  readonly gx: number;
  readonly gy: number;
  readonly u: number;
  readonly v: number;
  readonly x: number;
  readonly y: number;
  readonly score: number;
  readonly fishing: boolean;
}

/**
 * The candidate the grid holds at `gx`, `gy`, scored, or null where none could stand: the middle of its square of the
 * grid, strayed by a jitter of its own so the sites do not stand in rows, on its nearest lattice corner.
 */
export function candidateAt(
  file: SettlementsFile,
  ground: SiteGround,
  gx: number,
  gy: number,
  side: number,
): Candidate | null {
  const hash = hashOf(`${gx}:${gy}`);
  const jitterX = ((hash & 0xffff) / 0xffff - 0.5) * 0.7;
  const jitterY = ((hash >>> 16) / 0xffff - 0.5) * 0.7;
  const corner = cornerNear((gx + 0.5 + jitterX) * file.grid, (gy + 0.5 + jitterY) * file.grid);
  const score = scoreAt(file, ground, corner.u, corner.v, side);
  return score === null || score.score < file.least ? null : { gx, gy, ...corner, ...score };
}

/** How much a candidate's own roll can add to its score, to decide between candidates of ground alike. */
const TIE = 0.04;

/**
 * The sites in open country, from the candidates that scored: a candidate is kept where nothing within the spacing
 * scores better, its own small roll deciding between ground alike, so they stand about twice the spacing apart, it stands in no ruin's reach with a gap and half a
 * hamlet's square, and no site beside a ruin is within the spacing of it. Each is decided by the candidates near it
 * alone, so ground painted in one place moves no site more than two spacings from it.
 */
export function sitesInOpenCountry(
  file: SettlementsFile,
  candidates: readonly Candidate[],
  ruins: readonly RuinPlace[],
  besideRuins: readonly Site[],
  width: number,
  side: number,
): Site[] {
  const byPlace = new Map<string, Candidate>();
  for (const candidate of candidates) {
    byPlace.set(`${candidate.gx}:${candidate.gy}`, candidate);
  }
  const columns = Math.round(width / file.grid);
  // Ground that scores alike everywhere, a country of farmland, is decided by a small roll of each candidate's own, so
  // the sites kept stand where the roll peaks rather than in a row from one corner.
  const standing = (one: Candidate): number =>
    one.score + TIE * (hashOf(`tie:${one.gx}:${one.gy}`) / 0x100000000);
  const better = (one: Candidate, other: Candidate): boolean =>
    standing(one) > standing(other) ||
    (standing(one) === standing(other) && (one.gy < other.gy || (one.gy === other.gy && one.gx < other.gx)));
  const sites: Site[] = [];
  for (const candidate of candidates) {
    const spacing = unitsOfKm(file.spacingKm, candidate.y, width);
    const cells = Math.ceil(spacing / file.grid) + 1;
    let beaten = false;
    for (let dy = -cells; dy <= cells && !beaten; dy += 1) {
      for (let dx = -cells; dx <= cells && !beaten; dx += 1) {
        const gx = (((candidate.gx + dx) % columns) + columns) % columns;
        const other = byPlace.get(`${gx}:${candidate.gy + dy}`);
        if (
          other !== undefined &&
          other !== candidate &&
          apart(other, candidate, width) < spacing &&
          better(other, candidate)
        ) {
          beaten = true;
        }
      }
    }
    if (
      beaten ||
      inARuin(
        ruins,
        candidate.x,
        candidate.y,
        width,
        unitsOfKm(file.beside.gapKm, candidate.y, width) + side / 2,
      ) ||
      besideRuins.some((site) => apart(site, candidate, width) < spacing)
    ) {
      continue;
    }
    sites.push({
      id: `site:${candidate.gx}:${candidate.gy}`,
      type: candidate.fishing ? 'fishingVillage' : 'village',
      level: levelOf(file, candidate.score),
      u: candidate.u,
      v: candidate.v,
      x: candidate.x,
      y: candidate.y,
      by: null,
      score: candidate.score,
    });
  }
  return sites;
}

/**
 * Every site over a stretch of the world, `fromX` to `toX` and `fromY` to `toY` in world units: those beside its ruins
 * and those in its open country, by their ids. The bake works through the whole world a tile at a time with the parts
 * above; this is the same, whole, for a stretch small enough to hold.
 */
export function settlementSites(
  file: SettlementsFile,
  ground: SiteGround,
  ruins: readonly RuinPlace[],
  box: { fromX: number; fromY: number; toX: number; toY: number },
  width: number,
  side: number,
): Site[] {
  const beside = sitesBesideRuins(file, ground, ruins, width, side);
  const candidates: Candidate[] = [];
  for (let gy = Math.floor(box.fromY / file.grid); gy * file.grid < box.toY; gy += 1) {
    for (let gx = Math.floor(box.fromX / file.grid); gx * file.grid < box.toX; gx += 1) {
      const candidate = candidateAt(file, ground, gx, gy, side);
      if (candidate !== null) {
        candidates.push(candidate);
      }
    }
  }
  return [...beside, ...sitesInOpenCountry(file, candidates, ruins, beside, width, side)].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}
