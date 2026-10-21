import type { ReactNode } from 'react';

import type { SliceView } from '@villages/protocol';
import { antiOf } from '@villages/world';
import type { Challenges } from '@villages/world';

import { SliceOpened } from '../ui/slice/Slice';
import type { EffectShown } from '../ui/slice/Slice';
import type { Field, SideKey, SliceNow } from './replay';
import { aspectName, aspectShown, borneOf, effectWords, slotSaid } from './said';
import type { HouseShown } from './said';

/** A slice's chip says its state, and the boost when it matches. */
export function stateSaid(slice: SliceNow, boost: string): string | undefined {
  return slice.state === 'matching' ? `matches, ${boost}` : undefined;
}

/** The slice opened above a side's tray, if one of its is. */
export function openedOf(
  field: Field,
  side: SideKey,
  sides: Readonly<Record<SideKey, readonly SliceView[]>>,
  content: Challenges,
  houses: Readonly<Record<SideKey, HouseShown>>,
  opened: string | null,
  boost: string,
  close: () => void,
): ReactNode {
  const now = field.slices[side].find((slice) => slice.actor === opened);
  const slice = now === undefined ? undefined : sides[side][now.index];
  if (now === undefined || slice === undefined) {
    return undefined;
  }
  const anti = field.happening.aspects.includes(antiOf(now.aspect));
  const effects: EffectShown[] = slice.effects.flatMap((id) => {
    const effect = content.effects.find((one) => one.id === id);
    if (effect === undefined) return [];
    const works =
      effect.needs === null ||
      (effect.needs === 'match' && now.state === 'matching') ||
      (effect.needs === 'anti' && anti);
    const waitsFor = effect.needs === 'match' ? aspectName(now.aspect) : aspectName(antiOf(now.aspect));
    return [
      {
        name: effect.name,
        need: effect.needs ?? 'any',
        works,
        now: works ? (effect.needs === 'match' ? `working, ${boost}` : 'working') : `waits for ${waitsFor}`,
        words: effectWords(effect),
      },
    ];
  });
  const hired = field.standing.filter(
    (one) =>
      one.side === side &&
      !one.onTheLine &&
      one.fell === null &&
      one.effect !== null &&
      slice.effects.includes(one.effect),
  ).length;
  const slot = slotSaid(slice, content);
  return (
    <SliceOpened
      aspect={aspectShown(now.aspect)}
      house={houses[side].name}
      state={now.state}
      said={stateSaid(now, boost)}
      effects={effects}
      {...(slot === undefined ? {} : { slot })}
      numbers={[
        ['power', slice.power],
        ['integrity', slice.integrity],
        ['summons', `${hired} of ${slice.summonCount}`],
      ]}
      borne={borneOf(now.bearing, content, field.second)}
      onClose={close}
      width={360}
    />
  );
}
