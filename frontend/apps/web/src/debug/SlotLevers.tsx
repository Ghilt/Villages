import { useMemo, useState } from 'react';

import { charactersInView } from '@villages/client-core';
import type { StructureTypeSpec } from '@villages/world';

import { fullName } from '../figures/describe';
import { sessionStore } from '../net/gateway';
import { useStore } from '../store/useStore';
import { emptySlot, fillSlotWithItem, fillSlotWithPerson } from './levers';

/** What a lever puts in a slot when it puts something: a thing the slot is for, or a chest. */
export function sampleItem(slot: string): { name: string; about: string; amount?: number } {
  switch (slot) {
    case 'garrison':
      return { name: 'a garrison', about: 'men of the coast', amount: 40 };
    case 'granary':
    case 'cellar':
    case 'stores':
      return { name: 'bushels of grain', about: 'the last harvest', amount: 300 };
    case 'reliquary':
      return { name: 'a relic', about: 'the finger of a saint, they say' };
    case 'slipway':
      return { name: 'an unfinished galley', about: 'her ribs are up' };
    case 'moorings':
      return { name: 'a merchantman', about: 'out of Bordeaux' };
    default:
      return { name: 'a chest', about: 'locked' };
  }
}

/**
 * Adam's levers for the slots of the structure whose window is open, standing in for a story filling one: a slot of
 * its type, someone to put in it - one of the house's key figures, or anyone standing in view - or a thing the slot
 * is for, and *empty a place*, which takes out what was put in last. Each is a command said in the log under
 * `structures`. See docs/plans/structures.md.
 */
export function SlotLevers({
  open,
  name,
  spec,
}: {
  open: string | null;
  name: string | null;
  spec: StructureTypeSpec | undefined;
}) {
  const connection = useStore(sessionStore, (state) => state.connection);
  const figures = useStore(sessionStore, (state) => state.yourKeyFigures) ?? [];
  // The held cells, and who stands in them worked out here: a selector that made a new list each time would never settle.
  const houses = useStore(sessionStore, (state) => state.houses);
  const standing = useMemo(() => charactersInView(houses), [houses]);
  const people = [
    ...figures.map((one) => ({ id: one.id, said: fullName(one) })),
    ...standing
      .filter((one) => !figures.some((figure) => figure.id === one.id))
      .map((one) => ({ id: one.id, said: `${one.givenName} ${one.familyName}` })),
  ];
  const [slot, setSlot] = useState('');
  const [who, setWho] = useState('');
  const slots = spec?.slots ?? [];
  const chosenSlot = slots.find((one) => one.name === slot)?.name ?? slots[0]?.name ?? '';
  const person = people.find((one) => one.id === who) ?? people[0];
  const idle = connection !== 'open' || open === null || chosenSlot === '';
  const building = name ?? 'it';

  return (
    <>
      <div className="debug__levers">
        <select
          className="debug-map__select"
          aria-label="slot"
          value={chosenSlot}
          disabled={slots.length === 0}
          onChange={(event) => setSlot(event.target.value)}
        >
          {slots.length === 0 && <option value="">no slots</option>}
          {slots.map((one) => (
            <option key={one.name} value={one.name}>
              {one.name}
            </option>
          ))}
        </select>
        <select
          className="debug-map__select"
          aria-label="someone to put in it"
          value={person?.id ?? ''}
          disabled={people.length === 0}
          onChange={(event) => setWho(event.target.value)}
        >
          {people.length === 0 && <option value="">nobody in view</option>}
          {people.map((one) => (
            <option key={one.id} value={one.id}>
              {one.said}
            </option>
          ))}
        </select>
      </div>
      <div className="debug__levers">
        <button
          type="button"
          className="debug__button"
          disabled={idle || person === undefined}
          title={
            person === undefined
              ? 'nobody to put in'
              : `put ${person.said} in the ${chosenSlot} of ${building}`
          }
          onClick={() =>
            open !== null &&
            person !== undefined &&
            fillSlotWithPerson(open, building, chosenSlot, person.id, person.said)
          }
        >
          put them in
        </button>
        <button
          type="button"
          className="debug__button"
          disabled={idle}
          title={`put ${sampleItem(chosenSlot).name} in the ${chosenSlot} of ${building}`}
          onClick={() =>
            open !== null && fillSlotWithItem(open, building, chosenSlot, sampleItem(chosenSlot))
          }
        >
          put something in
        </button>
        <button
          type="button"
          className="debug__button"
          disabled={idle}
          title={`take out of the ${chosenSlot} of ${building} what was put in last`}
          onClick={() => open !== null && emptySlot(open, building, chosenSlot)}
        >
          empty a place
        </button>
      </div>
    </>
  );
}
