import type { SliceView } from '@villages/protocol';
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
