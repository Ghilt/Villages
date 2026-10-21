import type { Aspect, ChallengeEffect, Challenges, LentStat } from '@villages/world';
import type { MomentView, ProgressionView, SliceView } from '@villages/protocol';

import type { Asked } from './useSimulator';

/** An aspect as the page says it: `Violence`. */
export const said = (aspect: string) => aspect.charAt(0).toUpperCase() + aspect.slice(1);

/**
 * A challenge as the page is building it: each side's slices, the progression written by hand, the challenge kind to
 * draw one from instead, `''` for none, and the seed as typed, `''` to draw one.
 */
export interface Draft {
  readonly a: readonly SliceView[];
  readonly b: readonly SliceView[];
  readonly progression: ProgressionView;
  readonly kind: string;
  readonly seed: string;
}

/** What a new slice starts at, the balance's slice when the page has read it. */
export interface SliceStart {
  readonly power: number;
  readonly integrity: number;
  readonly summonCount: number;
}

export const FIRST_SLICE: SliceStart = { power: 50, integrity: 50, summonCount: 3 };

/** The most slices a side brings, and the most seconds a challenge lasts: the server's own bounds. */
export const MOST_SLICES = 3;
export const MOST_SECONDS = 600;

/** A slice of [aspect] at [start], carrying the first two of its aspect's effects. */
export function sliceOf(aspect: Aspect, start: SliceStart, content: Challenges | null): SliceView {
  const effects = (content?.effects ?? []).filter((effect) => effect.aspect === aspect).slice(0, 2);
  return { aspect, ...start, effects: effects.map((effect) => effect.id), slotted: {} };
}

/**
 * The sample the page opens on: Violence against Diplomacy over half a minute, the golden log's sides - Sellswords and
 * No Quarter against Trusted Envoy, with Ines in its slot, and Sweeter Terms, beside a Violence slice of Sellswords and
 * Spoils of the Field. No seed, so the server draws one.
 */
export const SAMPLE: Draft = {
  a: [
    {
      aspect: 'violence',
      ...FIRST_SLICE,
      power: 60,
      effects: ['violence.sellswords', 'violence.noQuarter'],
      slotted: {},
    },
  ],
  b: [
    {
      aspect: 'diplomacy',
      ...FIRST_SLICE,
      summonCount: 2,
      effects: ['diplomacy.envoy', 'diplomacy.sweeterTerms'],
      slotted: {
        'diplomacy.envoy': {
          kind: 'keyFigure',
          name: 'Ines',
          stats: { piety: 9, reason: 11, kindness: 14, physical: 8 },
        },
      },
    },
    {
      aspect: 'violence',
      ...FIRST_SLICE,
      integrity: 40,
      effects: ['violence.sellswords', 'violence.spoils'],
      slotted: {},
    },
  ],
  progression: { seconds: 30, happenings: [['violence'], ['diplomacy'], ['violence', 'diplomacy']] },
  kind: '',
  seed: '',
};

/**
 * The draft as the wire asks for it: the progression written by hand, or the kind to draw one from; a seed typed as a
 * whole number, or none for the server to draw.
 */
export function askedOf(draft: Draft): Asked {
  const seed = draft.seed.trim();
  const sides = { a: [...draft.a], b: [...draft.b] };
  const asked =
    draft.kind === '' ? { ...sides, progression: draft.progression } : { ...sides, kind: draft.kind };
  return /^\d+$/.test(seed) && Number.isSafeInteger(Number(seed)) ? { ...asked, seed: Number(seed) } : asked;
}

/** Whether a seed as typed can be sent: empty, to draw one, or a whole number a page holds exactly. */
export const seedReads = (seed: string) =>
  seed.trim() === '' || (/^\d+$/.test(seed.trim()) && Number.isSafeInteger(Number(seed.trim())));

/** What a stand-in for [effect]'s slot starts as: a key figure of middling stats, or a building of level one. */
export function standInFor(effect: ChallengeEffect): NonNullable<SliceView['slotted'][string]> {
  if (effect.slot?.fits === 'structure') return { kind: 'building', name: 'A building', level: 1 };
  return {
    kind: 'keyFigure',
    name: 'A key figure',
    stats: { piety: 10, reason: 10, kindness: 10, physical: 10 },
  };
}

export const STATS: readonly LentStat[] = ['piety', 'reason', 'kindness', 'physical'];

/** The second each happening of [progression] begins at, as the engine spaces them. */
export const startsOf = (progression: ProgressionView) =>
  progression.happenings.map((_, index) =>
    Math.floor((index * progression.seconds) / progression.happenings.length),
  );

/** A tug as the page says it, toward the side it favours: `+12.5 toward A`, `even`. */
export function towardSaid(tug: number): string {
  if (tug === 0) return 'even';
  return `+${numberSaid(Math.abs(tug))} toward ${tug > 0 ? 'A' : 'B'}`;
}

/** A number as the page says it: whole, or to one decimal. */
export const numberSaid = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/** The buff the aspect boost is, which the server's engine puts on whatever matches each happening. */
export const EMPOWERED = 'empowered';

/** What each kind of moment says, in words. */
export const WHAT_SAID: Readonly<Record<string, string>> = {
  happeningBegan: 'happening began',
  matches: 'aspect matches',
  idle: 'sat out, its aspect not matching',
  summoned: 'summoned',
  noRoom: 'no room',
  emptySlot: 'empty slot',
  pulled: 'pulled',
  cost: 'cost',
  lent: 'lent',
  arrived: 'came on the line',
  killed: 'killed',
  turned: 'turned',
  deserted: 'deserted',
  buffed: 'buffed',
  debuffed: 'debuffed',
  lifted: 'lifted',
  cleansed: 'cleansed',
  worn: 'worn',
  warded: 'warded off',
  held: 'stood fast',
  actedAgain: 'acted again',
  echoed: 'echoed',
  penalised: 'penalised',
  cancelled: 'cancelled',
  integrityLost: 'wore integrity',
  auraOn: 'aura on',
  auraOff: 'aura off',
  banked: 'filled its coffer',
  poured: 'coffer poured',
  cofferLost: 'coffer lost',
  ended: 'ended',
};

/** What a moment's doer or target is called: a slice by its place and aspect, a summon by its name. */
export function whoSaid(who: string | null, draft: Draft, called: ReadonlyMap<string, string>): string {
  if (who === null) return '';
  if (who === 'challenge') return '';
  if (who.startsWith('#')) return `${who} ${called.get(who) ?? ''}`.trim();
  const side = who.startsWith('a') ? draft.a : draft.b;
  const slice = side[Number(who.slice(1)) - 1];
  return slice === undefined ? who : `${who} ${slice.aspect}`;
}

/** Every summon of a challenge by its label, `#3`, and its name: the catalogue's, or a thing on the line's own. */
export function summonNames(
  summons: readonly { serial: number; kind: string; called: string | null }[],
  content: Challenges | null,
): Map<string, string> {
  return new Map(
    summons.map((summon) => [
      `#${summon.serial}`,
      summon.called ?? content?.summons.find((one) => one.id === summon.kind)?.name ?? summon.kind,
    ]),
  );
}

/** An effect's name from the catalogue, or its id when the catalogue has none. */
export const effectSaid = (id: string | null, content: Challenges | null) =>
  id === null ? '' : (content?.effects.find((effect) => effect.id === id)?.name ?? id);

/** The tug at the end of every second of a challenge, carried on through seconds nothing moved it. */
export function tugBySecond(moments: readonly MomentView[], seconds: number): number[] {
  const last = moments.at(-1)?.second ?? 0;
  const through = Math.min(seconds - 1, last);
  const tugs: number[] = [];
  let tug = 0;
  let at = 0;
  for (let second = 0; second <= through; second++) {
    while (at < moments.length && moments[at]!.second === second) {
      tug = moments[at]!.tugAfter;
      at++;
    }
    tugs.push(tug);
  }
  return tugs;
}

/** A buff's or a debuff's name from the catalogue, or its id when the catalogue has none. */
export const lastingSaid = (id: string, content: Challenges | null) =>
  [...(content?.buffs ?? []), ...(content?.debuffs ?? [])].find((one) => one.id === id)?.name ?? id;
