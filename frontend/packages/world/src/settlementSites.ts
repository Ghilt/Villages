import { TIERS } from './ruins.ts';
import { unitsOfKm } from './settlements.ts';
import type { SettlementsFile } from './settlements.ts';
import { apart, cornerNear, hashOf, levelOf, scoreAt } from './siteScore.ts';
import type { RuinPlace, Site, SiteGround } from './siteScore.ts';

export type { RuinPlace, Site, SiteGround } from './siteScore.ts';

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

/**
 * Things with a place, kept in squares of the world so that what stands near a point is found without asking every
 * one of them. Longitude wraps, as the world does.
 */
export class Near<T extends { readonly x: number; readonly y: number }> {
  private readonly squares = new Map<number, T[]>();
  private readonly columns: number;
  private readonly square: number;

  constructor(width: number, square = 64) {
    this.square = square;
    this.columns = Math.ceil(width / square);
  }

  add(one: T): void {
    const key = this.keyOf(Math.floor(one.x / this.square), Math.floor(one.y / this.square));
    const here = this.squares.get(key);
    if (here === undefined) this.squares.set(key, [one]);
    else here.push(one);
  }

  /** Whether anything in the squares within `radius` of the point makes `hit` true. */
  some(x: number, y: number, radius: number, hit: (one: T) => boolean): boolean {
    const reach = Math.ceil(radius / this.square);
    const column = Math.floor(x / this.square);
    const row = Math.floor(y / this.square);
    for (let dy = -reach; dy <= reach; dy += 1) {
      for (let dx = -reach; dx <= reach; dx += 1) {
        for (const one of this.squares.get(this.keyOf(column + dx, row + dy)) ?? []) {
          if (hit(one)) return true;
        }
      }
    }
    return false;
  }

  private keyOf(column: number, row: number): number {
    return row * this.columns + (((column % this.columns) + this.columns) % this.columns);
  }
}

/** The ruins of 1790 kept by where they stand, and how far the furthest reaches, to ask what a point stands in. */
export class RuinsNear {
  private readonly near: Near<RuinPlace>;
  private readonly most: number;
  private readonly width: number;

  constructor(ruins: readonly RuinPlace[], width: number) {
    this.width = width;
    this.near = new Near(width);
    for (const ruin of ruins) this.near.add(ruin);
    this.most = ruins.reduce((most, ruin) => Math.max(most, ruin.reach), 0);
  }

  /** Whether a point stands within any ruin's reach and `margin` more, and so not on ground a settlement may take. */
  holds(x: number, y: number, margin: number): boolean {
    return this.near.some(
      x,
      y,
      this.most + margin,
      (ruin) => apart(ruin, { x, y }, this.width) < ruin.reach + margin,
    );
  }
}

/** The order the ruins are given their sites in: the greatest towns first, and then by their ids, each town once. */
export function ruinsInOrder(ruins: readonly RuinPlace[]): RuinPlace[] {
  // A town carried onto the master twice, where land was copied from one place on Earth to two, is given its sites
  // once, at its copy furthest north and then west, as its house bot is (0108): its sites' ids are its own.
  const once = new Map<string, RuinPlace>();
  for (const ruin of ruins) {
    const kept = once.get(ruin.id);
    if (kept === undefined || ruin.y < kept.y || (ruin.y === kept.y && ruin.x < kept.x))
      once.set(ruin.id, ruin);
  }
  return [...once.values()].sort(
    (a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Where the sites beside the ruins are kept as they are placed, so that each is placed apart from the ones before. */
export interface SitesSoFar {
  readonly sites: Site[];
  readonly near: Near<Site>;
}

export function sitesSoFar(width: number): SitesSoFar {
  return { sites: [], near: new Near(width) };
}

/** How far from a ruin's middle the ground its sites are chosen on reaches, in world units. */
export function besideReach(file: SettlementsFile, ruin: RuinPlace, width: number, side: number): number {
  return ruin.reach + unitsOfKm(file.beside.gapKm, ruin.y, width) + side;
}

/**
 * The sites beside one ruin of 1790, given the sites already beside the ones before it in `ruinsInOrder`: so many
 * by its tier, each past the edge of its town's overgrowth and half a hamlet's square, at a bearing worked out from
 * the town's id and its count, turned an eighth at a time until it stands on ground a settlement can, in no ruin's
 * reach and no nearer another such site than `apartKm`. A site with no such ground in eight turns is passed over.
 * `side` is a hamlet's square; the ground is read no further from the town than `besideReach`.
 */
export function sitesBeside(
  file: SettlementsFile,
  ground: SiteGround,
  ruin: RuinPlace,
  ruins: RuinsNear,
  before: SitesSoFar,
  width: number,
  side: number,
): Site[] {
  const count = file.beside.sites[ruin.tier];
  const first = hashOf(ruin.id) % 360;
  const away = besideReach(file, ruin, width, side) - side / 2;
  const apartUnits = unitsOfKm(file.beside.apartKm, ruin.y, width);
  const placed: Site[] = [];
  for (let k = 0; k < count; k += 1) {
    for (let turn = 0; turn < 8; turn += 1) {
      const bearing = ((first + (k * 360) / count + turn * 45) * Math.PI) / 180;
      const x = (((ruin.x + away * Math.sin(bearing)) % width) + width) % width;
      const corner = cornerNear(x, ruin.y - away * Math.cos(bearing));
      const score = scoreAt(file, ground, corner.u, corner.v, side);
      if (
        score === null ||
        ruins.holds(corner.x, corner.y, side / 2) ||
        before.near.some(corner.x, corner.y, apartUnits, (site) => apart(site, corner, width) < apartUnits)
      ) {
        continue;
      }
      const site: Site = {
        id: `ruin:${ruin.id}:${k}`,
        type: score.fishing ? 'fishingVillage' : 'village',
        level: file.beside.level[ruin.tier] as 1 | 2 | 3,
        ...corner,
        by: ruin.id,
        score: score.score,
      };
      placed.push(site);
      before.sites.push(site);
      before.near.add(site);
      break;
    }
  }
  return placed;
}

/** The sites beside every ruin of 1790, in `ruinsInOrder`, as `sitesBeside` places each one's. */
export function sitesBesideRuins(
  file: SettlementsFile,
  ground: SiteGround,
  ruins: readonly RuinPlace[],
  width: number,
  side: number,
): Site[] {
  const near = new RuinsNear(ruins, width);
  const before = sitesSoFar(width);
  for (const ruin of ruinsInOrder(ruins)) {
    sitesBeside(file, ground, ruin, near, before, width, side);
  }
  return before.sites;
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
 * scores better - its own small roll deciding between ground alike, so they stand about twice the spacing apart - it
 * stands in no ruin's reach with a gap and half a hamlet's square, and no site beside a ruin is within the spacing of
 * it. Each is decided by the candidates near it
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
  const columns = Math.round(width / file.grid);
  const keyOf = (gx: number, gy: number): number => gy * columns + (((gx % columns) + columns) % columns);
  const byPlace = new Map<number, Candidate>();
  for (const candidate of candidates) {
    byPlace.set(keyOf(candidate.gx, candidate.gy), candidate);
  }
  const inRuins = new RuinsNear(ruins, width);
  const beside = new Near<Site>(width);
  for (const site of besideRuins) beside.add(site);
  // Ground that scores alike everywhere, a country of farmland, is decided by a small roll of each candidate's own, so
  // the sites kept stand where the roll peaks rather than in a row from one corner.
  const standing = (one: Candidate): number =>
    one.score +
    (one.fishing ? file.fishing.favour : 0) +
    TIE * (hashOf(`tie:${one.gx}:${one.gy}`) / 0x100000000);
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
        const other = byPlace.get(keyOf(candidate.gx + dx, candidate.gy + dy));
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
      inRuins.holds(candidate.x, candidate.y, unitsOfKm(file.beside.gapKm, candidate.y, width) + side / 2) ||
      beside.some(candidate.x, candidate.y, spacing, (site) => apart(site, candidate, width) < spacing)
    ) {
      continue;
    }
    sites.push({
      id: `site:${candidate.gx}:${candidate.gy}`,
      type: candidate.fishing ? 'fishingVillage' : 'village',
      level: levelOf(file, candidate.score, hashOf(`level:${candidate.gx}:${candidate.gy}`) / 0x100000000),
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
