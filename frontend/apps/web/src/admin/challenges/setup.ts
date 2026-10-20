import type { Asked } from './useSimulator';

/**
 * The sample challenge the page fights before anything is built on it: Violence against Diplomacy over half a
 * minute, the first draft's slices, Sellswords and No Quarter against Trusted Envoy, with Ines in its slot, and Sweeter
 * Terms. No seed, so the server draws one each time.
 */
export const SAMPLE: Asked = {
  a: [
    {
      aspect: 'violence',
      power: 50,
      integrity: 50,
      summonCount: 3,
      effects: ['violence.sellswords', 'violence.noQuarter'],
      slotted: {},
    },
  ],
  b: [
    {
      aspect: 'diplomacy',
      power: 50,
      integrity: 50,
      summonCount: 3,
      effects: ['diplomacy.envoy', 'diplomacy.sweeterTerms'],
      slotted: {
        'diplomacy.envoy': {
          kind: 'keyFigure',
          name: 'Ines',
          stats: { piety: 9, reason: 11, kindness: 14, physical: 8 },
        },
      },
    },
  ],
  progression: { seconds: 30, happenings: [['violence'], ['diplomacy'], ['violence', 'diplomacy']] },
};

/** A tug as the page says it, toward the side it favours: `+12.5 toward A`, `even`. */
export function towardSaid(tug: number): string {
  if (tug === 0) return 'even';
  const amount = Math.abs(tug);
  return `+${Number.isInteger(amount) ? amount : amount.toFixed(1)} toward ${tug > 0 ? 'A' : 'B'}`;
}
