import './structures.css';

import { useEffect, useState } from 'react';

import { CULTURES, parseStructureCatalogue } from '@villages/world';
import type {
  StructureCatalogue,
  StructureResource,
  StructureSlot,
  StructureTypeSpec,
} from '@villages/world';

/** The resources as the page says them. */
const SAID: Record<StructureResource, string> = {
  wealth: 'wealth',
  naturalDomain: 'domain',
  influence: 'influence',
  reason: 'reason',
  piety: 'piety',
};

/** Levels as the page says them: one number when every level agrees, else each in turn. */
function byLevel(values: readonly number[]): string {
  return values.every((value) => value === values[0]) ? String(values[0]) : values.join(' / ');
}

/** The zoom a significance is first drawn from, as `coarsestZoom` works it out on both ends. */
function zoomOf(significance: number): number {
  return Math.round(((100 - significance) / 100) * 10);
}

/**
 * Every type of structure there is, as `world/structures.json` says, for reading: what each gives its holder a
 * month at each level, how far it sees and from which zoom it is drawn, its slots and what makes each count, its
 * zone, and what each culture calls it. Read through the dev server, fresh on every load, so a number changed in
 * the file is here on a reload; the game server reads the file only when it starts.
 *
 * Its own page rather than a section of the debug panel, because it is not something the world does but a
 * catalogue to read, as the events and the components have theirs. The structures' sprites will stand here too,
 * a culture to a column. A file this cannot read is said in place of the table, naming the type and the field.
 * See docs/plans/structures.md.
 */
export function Structures() {
  const [read, setRead] = useState<StructureCatalogue | string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/structures.json', { cache: 'no-store' })
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(response.statusText))))
      .then((text) => live && setRead(parseStructureCatalogue(text)))
      .catch((unread: unknown) => live && setRead(unread instanceof Error ? unread.message : String(unread)));
    return () => {
      live = false;
    };
  }, []);

  return (
    <main className="catalogue">
      <header className="catalogue__bar">
        <h1 className="catalogue__title">Structures</h1>
        <span className="catalogue__count">
          {typeof read === 'object' && read !== null ? `${read.types.length} types` : ''} from
          world/structures.json, every number a placeholder
        </span>
      </header>

      {read === null && <p className="catalogue__quiet">reading world/structures.json</p>}
      {typeof read === 'string' && <p className="catalogue__problem">{read}</p>}
      {typeof read === 'object' && read !== null && (
        <div className="catalogue__scroll">
          <table className="catalogue__table">
            <thead>
              <tr>
                <th>type</th>
                <th>levels</th>
                <th>drawn from zoom</th>
                <th>sees, km</th>
                <th>gives a month</th>
                <th>slots</th>
                <th>zone</th>
                <th>called</th>
              </tr>
            </thead>
            <tbody>
              {read.types.map((spec) => (
                <TypeRow key={spec.type} spec={spec} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function TypeRow({ spec }: { spec: StructureTypeSpec }) {
  const gives = Object.entries(spec.yields).map(
    ([resource, each]) => `${SAID[resource as StructureResource]} ${byLevel(each)}`,
  );
  return (
    <tr>
      <th scope="row">
        {spec.words.european}
        <span className="catalogue__key">{spec.type}</span>
      </th>
      <td>{spec.levels}</td>
      <td>{byLevel(spec.significance.map(zoomOf))}</td>
      <td>{byLevel(spec.sightKm)}</td>
      <td>
        {gives.length === 0 ? (
          <span className="catalogue__quiet">nothing but sight</span>
        ) : (
          <ul className="catalogue__slots">
            {gives.map((one) => (
              <li key={one}>{one}</li>
            ))}
          </ul>
        )}
      </td>
      <td>
        {spec.slots.length === 0 ? (
          <span className="catalogue__quiet">none</span>
        ) : (
          <ul className="catalogue__slots">
            {spec.slots.map((slot) => (
              <li key={slot.name}>{saySlot(slot)}</li>
            ))}
          </ul>
        )}
      </td>
      <td>
        {spec.zone === null ? <span className="catalogue__quiet">none</span> : `reach ${spec.zone.reach}`}
      </td>
      <td>
        <ul className="catalogue__slots">
          {CULTURES.map((culture) => (
            <li key={culture}>
              <span className="catalogue__key">{culture}</span> {spec.words[culture]}
            </li>
          ))}
        </ul>
      </td>
    </tr>
  );
}

/** A slot in a line: its name, what it takes, its places at each level, and anything that makes it count. */
function saySlot(slot: StructureSlot): string {
  const rules = [
    slot.takes,
    slot.seenBy === 'holder' ? "holder's eyes only" : null,
    slot.needed ? 'needed' : null,
    slot.scales === null ? null : `by ${slot.scales}`,
    ...Object.entries(slot.adds).map(
      ([resource, amount]) => `+${amount} ${SAID[resource as StructureResource]} each`,
    ),
    slot.bringsItsOwn ? 'brings its own' : null,
  ].filter((rule) => rule !== null);
  return `${slot.name} ${byLevel(slot.places)} (${rules.join(', ')})`;
}
