import type { MomentView, SliceView } from '@villages/protocol';
import { filledIn } from '@villages/world';
import type { Aspect, ChallengeEffect, Challenges } from '@villages/world';

import type { MarkName } from '../ui/mark/Mark';
import type { AspectShown } from '../ui/slice/Slice';
import type { Borne } from '../ui/slice/sliceWords';
import type { Bearing } from './replay';

/** A side as the spectacle shows it: its house's name and colour. */
export interface HouseShown {
  readonly name: string;
  readonly colour: string;
}

/** An aspect by its name: `Violence`. */
export const aspectName = (aspect: string) => aspect.charAt(0).toUpperCase() + aspect.slice(1);

/** An aspect as the library shows it: its mark, its name, its colour. */
export function aspectShown(aspect: Aspect): AspectShown {
  return {
    mark: `aspect-${aspect}` as MarkName,
    name: aspectName(aspect),
    colour: `var(--ui-aspect-${aspect})`,
  };
}

/** What is borne, as a pip says it: its name in the catalogue, buff or debuff, and the seconds left at a second. */
export function borneOf(bearing: readonly Bearing[], content: Challenges, second: number): Borne[] {
  return bearing.map((one) => {
    const buff = content.buffs.find((lasting) => lasting.id === one.id);
    const debuff = content.debuffs.find((lasting) => lasting.id === one.id);
    return {
      name: buff?.name ?? debuff?.name ?? one.id,
      kind: debuff === undefined ? 'buff' : 'debuff',
      seconds: Math.max(1, one.until - second + 1),
    };
  });
}

/** How much the aspect boost grows what a matching slice does: `×1.5`, from the catalogue's empowered. */
export function boostSaid(content: Challenges): string {
  const percent = content.buffs.find((lasting) => lasting.id === 'empowered')?.numbers.percent ?? 50;
  return `×${1 + percent / 100}`;
}

/** An effect's words with its numbers in them. */
export function effectWords(effect: ChallengeEffect): string {
  return filledIn(effect.words, effect.numbers);
}

/** What stands in a slice's slot, said whole: `Lady Ilse, kindness 14`, `the Cathedral of Varga, level 3`. */
export function slotSaid(slice: SliceView, content: Challenges): string | undefined {
  for (const id of slice.effects) {
    const stand = slice.slotted[id];
    if (stand === undefined) continue;
    const effect = content.effects.find((one) => one.id === id);
    if (stand.kind === 'keyFigure') {
      const lends = effect?.slot?.lends;
      return lends === null || lends === undefined
        ? stand.name
        : `${stand.name}, ${lends} ${stand.stats[lends] ?? 0}`;
    }
    return `${stand.name}, level ${stand.level}${effect?.slot?.onTheLine === true ? ', on the line' : ''}`;
  }
  return undefined;
}

/** A side's speaker: the first key figure in its slices' slots, or none. */
export function speakerOf(slices: readonly SliceView[]): string | null {
  for (const slice of slices) {
    for (const stand of Object.values(slice.slotted)) {
      if (stand.kind === 'keyFigure') return stand.name;
    }
  }
  return null;
}

/** A number as the page says it: whole, or to one decimal. */
export const numberSaid = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

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
export function whoSaid(
  who: string | null,
  sides: Readonly<Record<'a' | 'b', readonly SliceView[]>>,
  called: ReadonlyMap<string, string>,
): string {
  if (who === null) return '';
  if (who === 'challenge') return '';
  if (who.startsWith('#')) return `${who} ${called.get(who) ?? ''}`.trim();
  const side = who.startsWith('a') ? sides.a : sides.b;
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

/** A buff's or a debuff's name from the catalogue, or its id when the catalogue has none. */
export const lastingSaid = (id: string, content: Challenges | null) =>
  [...(content?.buffs ?? []), ...(content?.debuffs ?? [])].find((one) => one.id === id)?.name ?? id;

/**
 * A moment in words, as a challenge's history and the inspect page's table say it: who did it, what it was, the buff or
 * debuff it put on or lifted, by which effect, and to whom.
 */
export function momentSaid(
  moment: MomentView,
  sides: Readonly<Record<'a' | 'b', readonly SliceView[]>>,
  called: ReadonlyMap<string, string>,
  content: Challenges | null,
): string {
  const who = whoSaid(moment.actor, sides, called);
  const what = WHAT_SAID[moment.what] ?? moment.what;
  const status = moment.status === null ? '' : `: ${lastingSaid(moment.status, content)}`;
  const by = moment.effect === null ? '' : ` · ${effectSaid(moment.effect, content)}`;
  const to = moment.target === null ? '' : ` → ${whoSaid(moment.target, sides, called)}`;
  return `${who === '' ? '' : `${who} `}${what}${status}${by}${to}`;
}
