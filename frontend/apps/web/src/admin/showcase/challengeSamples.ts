import type { Band, Tick } from '../../ui/replay/Replay';
import type { AspectShown, EffectShown } from '../../ui/slice/Slice';
import type { Borne } from '../../ui/slice/sliceWords';
import type { SideShown } from '../../ui/tug/Tug';

/*
 * The samples the Challenges section shows its parts with: a sermon of Varga against Brannock, sixty seconds long, its
 * happenings Violence and Industry, Holy, Reason, and Violence and Industry again.
 */

/** Four of the ten aspects, as a slice shows them. */
export const HOLY: AspectShown = { mark: 'aspect-holy', name: 'Holy', colour: 'var(--ui-aspect-holy)' };
export const REASON: AspectShown = {
  mark: 'aspect-reason',
  name: 'Reason',
  colour: 'var(--ui-aspect-reason)',
};
export const DIPLOMACY: AspectShown = {
  mark: 'aspect-diplomacy',
  name: 'Diplomacy',
  colour: 'var(--ui-aspect-diplomacy)',
};
export const AUTHORITY: AspectShown = {
  mark: 'aspect-authority',
  name: 'Authority',
  colour: 'var(--ui-aspect-authority)',
};
export const VIOLENCE: AspectShown = {
  mark: 'aspect-violence',
  name: 'Violence',
  colour: 'var(--ui-aspect-violence)',
};
export const INDUSTRY: AspectShown = {
  mark: 'aspect-industry',
  name: 'Industry',
  colour: 'var(--ui-aspect-industry)',
};

export const EMPOWERED: Borne = { name: 'Empowered', kind: 'buff', seconds: null };
export const WEAKENED: Borne = { name: 'Weakened', kind: 'debuff', seconds: 3 };
export const HASTENED: Borne = { name: 'Hastened', kind: 'buff', seconds: 6 };

export const REASONS_EFFECTS: readonly EffectShown[] = [
  {
    name: 'Learned Counsel',
    need: 'any',
    works: true,
    now: 'working',
    words: 'Master Oswin lends his reason as it meets a happening',
  },
  {
    name: 'Sow Doubt',
    need: 'anti',
    works: true,
    now: 'working',
    words: 'Weakens every enemy summon for 12 s',
  },
];

export const HOLYS_EFFECTS: readonly EffectShown[] = [
  { name: 'Ordination', need: 'match', works: false, now: 'waits for Holy', words: 'Summons a Priest' },
  {
    name: 'Sanctuary',
    need: 'match',
    works: false,
    now: 'waits for Holy',
    words: 'Puts the Cathedral of Varga on the line',
  },
];

export const VARGA = '#3d6aa6';
export const BRANNOCK = '#a8452a';
export const VARGA_SIDE: SideShown = { name: 'Varga', colour: VARGA };
export const BRANNOCK_SIDE: SideShown = { name: 'Brannock', colour: BRANNOCK };

/** A sermon's sixty seconds of tug, as a run might pull it: Brannock first, then Varga's Holy turning it. */
export const TUG: readonly number[] = [
  -17, -16.5, -10.5, -23.5, -17.5, -17, -24.5, -24, -18, -31, -25, -24.5, -32, -31.5, -25.5, 9.5, 13.5, 16,
  14.1, 16.6, 20.6, 17.2, 21.2, 23.7, 21.8, 24.3, 28.3, 26.3, 31.8, 34.3, 23.3, 25.3, 30.3, 26.3, 31.3, 33.3,
  32.3, 34.3, 39.3, 35.3, 40.3, 42.3, 41.3, 43.3, 48.3, 37.3, 44.3, 53.3, 31.8, 40.8, 47.8, 28.3, 35.3, 44.3,
  36.3, 45.3, 52.3, 46.3, 53.3, 62.3, 54.3,
];

export const BANDS: readonly Band[] = [
  { from: 0, to: 15, name: 'Violence and Industry', colours: [VIOLENCE.colour, INDUSTRY.colour] },
  { from: 15, to: 30, name: 'Holy', colours: [HOLY.colour] },
  { from: 30, to: 45, name: 'Reason', colours: [REASON.colour] },
  { from: 45, to: 60, name: 'Violence and Industry', colours: [VIOLENCE.colour, INDUSTRY.colour] },
];

export const TICKS: readonly Tick[] = [
  { second: 0, kind: 'arrived', said: 'Mercenary #1, Machine #2 and the Forge at Hollin' },
  { second: 15, kind: 'arrived', said: 'Priest #4 and the Cathedral of Varga' },
  { second: 45, kind: 'arrived', said: 'Mercenary #6 and Machine #5' },
  { second: 52, kind: 'fell', said: 'Machine #2' },
];
