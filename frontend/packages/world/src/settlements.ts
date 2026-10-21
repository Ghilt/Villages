import { TIERS } from './ruins.ts';
import type { Tier } from './ruins.ts';

/*
 * The villages and fishing villages of 1790, which nobody holds: `world/settlements.json`, what the bake chooses every
 * settlement site by, and the rules a settlement's ground keeps that the bake and the page both read - how big its
 * square is, and where its streets run. Every town of 1790 fell, and the countryside was spared (`SETTING.md`). See
 * docs/plans/settlements-and-roads.md and decision record 0114.
 */

/** The two types of settlement, by their names in the structures' catalogue. */
export const SETTLEMENT_TYPES = ['village', 'fishingVillage'] as const;
export type SettlementType = (typeof SETTLEMENT_TYPES)[number];

/** Whether a structure's type is a settlement's, drawn as the buildings the page lays out for it. */
export function isASettlement(type: string): type is SettlementType {
  return (SETTLEMENT_TYPES as readonly string[]).includes(type);
}

/** How the sites beside a ruin stand: how many by its tier, how far past its overgrowth, how far apart, and how big. */
export interface BesideRuins {
  readonly sites: Readonly<Record<Tier, number>>;
  readonly gapKm: number;
  readonly apartKm: number;
  readonly level: Readonly<Record<Tier, number>>;
}

/** `world/settlements.json`, read. */
export interface SettlementsFile {
  /** How good each class of ground is to live on, nought to one, by its name; a class not listed is none. */
  readonly ground: Readonly<Record<string, number>>;
  readonly least: number;
  readonly reliefMetres: number;
  readonly spacingKm: number;
  readonly grid: number;
  readonly riverBonus: number;
  readonly fishing: {
    readonly water: readonly [number, number];
    readonly river: number;
    readonly favour: number;
  };
  /**
   * The share of the sites on the best ground that are villages or larger, and that are large villages; fewer on
   * poorer ground, by its score. The rest are hamlets.
   */
  readonly levels: { readonly village: number; readonly large: number };
  /** How far from its middle a structure is part of a settlement, in world units, a level at a time. */
  readonly radius: readonly [number, number, number];
  /** What each kind of settlement is called in each culture: the word its name begins with. */
  readonly words: Readonly<Record<SettlementType, Readonly<Record<string, string>>>>;
  readonly beside: BesideRuins;
}

const share = (value: unknown): value is number => typeof value === 'number' && value >= 0 && value <= 1;
const positive = (value: unknown): value is number => typeof value === 'number' && value > 0;

/** `world/settlements.json`, or the refusal naming the first thing in it that cannot be read. */
export function parseSettlements(text: string): SettlementsFile {
  const file = JSON.parse(text) as Partial<Record<keyof SettlementsFile, unknown>>;
  const ground = (file.ground ?? null) as Record<string, unknown> | null;
  if (ground === null || typeof ground !== 'object' || !Object.values(ground).every(share)) {
    throw new Error(
      'world/settlements.json: ground wants a share from nought to one for each class it names',
    );
  }
  for (const key of ['least', 'riverBonus'] as const) {
    if (!share(file[key])) {
      throw new Error(`world/settlements.json: ${key} wants a share from nought to one`);
    }
  }
  for (const key of ['reliefMetres', 'spacingKm', 'grid'] as const) {
    if (!positive(file[key])) {
      throw new Error(`world/settlements.json: ${key} wants a number above nought`);
    }
  }
  if (!Number.isInteger(file.grid)) {
    throw new Error('world/settlements.json: grid wants a whole number of world units');
  }
  const fishing = (file.fishing ?? {}) as { water?: unknown; river?: unknown; favour?: unknown };
  const water = Array.isArray(fishing.water) ? (fishing.water as unknown[]) : [];
  if (
    water.length !== 2 ||
    !share(water[0]) ||
    !share(water[1]) ||
    water[0] >= water[1] ||
    !share(fishing.river) ||
    !share(fishing.favour)
  ) {
    throw new Error(
      'world/settlements.json: fishing wants a water share from one to a larger, and a river size',
    );
  }
  const levels = (file.levels ?? {}) as { village?: unknown; large?: unknown };
  if (!share(levels.village) || !share(levels.large) || levels.large > levels.village) {
    throw new Error(
      'world/settlements.json: levels wants the share of villages and the smaller share of large villages',
    );
  }
  const radius = file.radius;
  if (!Array.isArray(radius) || radius.length !== 3 || !radius.every(positive)) {
    throw new Error('world/settlements.json: radius wants three numbers above nought, a level at a time');
  }
  const words = (file.words ?? {}) as Record<string, Record<string, unknown> | undefined>;
  for (const type of SETTLEMENT_TYPES) {
    const said = words[type];
    if (said === undefined || !Object.values(said).every((word) => typeof word === 'string' && word !== '')) {
      throw new Error(`world/settlements.json: words wants what a ${type} is called in each culture`);
    }
  }
  const beside = (file.beside ?? {}) as Partial<Record<keyof BesideRuins, unknown>>;
  const sites = (beside.sites ?? {}) as Partial<Record<Tier, unknown>>;
  const level = (beside.level ?? {}) as Partial<Record<Tier, unknown>>;
  for (const tier of TIERS) {
    const count = sites[tier];
    const at = level[tier];
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      throw new Error(
        `world/settlements.json: beside.sites wants a whole number of sites by a ruin of the tier ${tier}`,
      );
    }
    if (at !== 1 && at !== 2 && at !== 3) {
      throw new Error(
        `world/settlements.json: beside.level wants a level of one to three for the tier ${tier}`,
      );
    }
  }
  if (!positive(beside.gapKm) || !positive(beside.apartKm)) {
    throw new Error('world/settlements.json: beside wants a gapKm and an apartKm above nought');
  }
  return file as unknown as SettlementsFile;
}

/** Kilometres a world unit spans at the equator: the equator over the world's width. */
export const KM_A_UNIT = 40_075.016_686 / 32_768;

/**
 * How many world units a distance on the ground spans at a row of world space, whose width is `width`: the world's
 * Mercator stretches a unit to cover less ground the further it is from the equator, by the cosine of the latitude,
 * which at row `y` is the hyperbolic secant of `π(1 - 2y/width)`.
 */
export function unitsOfKm(km: number, y: number, width: number): number {
  const across = 1 / Math.cosh(Math.PI * (1 - (2 * y) / width));
  return km / (KM_A_UNIT * Math.max(across, 0.05));
}

/**
 * A settlement's square of ground on the lattice: the diamonds from `fromU` and `fromV`, `side` of them each way,
 * laid round the corner its middle stands on, so a level up grows it outward round a middle that does not move.
 */
export interface SettlementSquare {
  readonly u: number;
  readonly v: number;
  readonly fromU: number;
  readonly fromV: number;
  readonly side: number;
}

export function settlementSquare(u: number, v: number, side: number): SettlementSquare {
  const half = Math.floor(side / 2);
  return { u, v, fromU: u - half, fromV: v - half, side };
}

/** Whether a diamond is inside a settlement's square. */
export function inSquare(square: SettlementSquare, u: number, v: number): boolean {
  return (
    u >= square.fromU && u < square.fromU + square.side && v >= square.fromV && v < square.fromV + square.side
  );
}

/**
 * Whether a diamond of a settlement is on one of its two **streets**: the row and the column of diamonds through its
 * middle, along the lattice's two axes, which no building stands on and which a road comes in by.
 */
export function onStreet(square: SettlementSquare, u: number, v: number): boolean {
  return inSquare(square, u, v) && (u === square.u || v === square.v);
}

/** The diamond just outside a settlement's square at each end of its streets: where a road meets one, four of them. */
export function streetEnds(square: SettlementSquare): { u: number; v: number }[] {
  const { u, v, fromU, fromV, side } = square;
  return [
    { u: fromU - 1, v },
    { u: fromU + side, v },
    { u, v: fromV - 1 },
    { u, v: fromV + side },
  ];
}
