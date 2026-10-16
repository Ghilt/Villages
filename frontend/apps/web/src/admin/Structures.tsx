import { CULTURES, parseStructureCatalogue } from '@villages/world';
import type { StructureResource, StructureSlot, StructureTypeSpec } from '@villages/world';

import { InspectPage } from './frame/InspectPage';
import { useCatalogue } from './frame/useCatalogue';

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

/**
 * Every type of structure there is, as `world/catalogues/structures.json` says, for reading: what each gives its holder a
 * month at each level, how far it sees and how significant it is, its slots and what makes each count, its
 * zone, and what each culture calls it. Read through the dev server, and again whenever the file changes, so a
 * number changed in it is here at once; the game server reads the file only when it starts.
 *
 * Its own page rather than a section of the debug panel, because it is not something the world does but a
 * catalogue to read, as the events and the components have theirs. The structures' sprites will stand here too,
 * a culture to a column. A file this cannot read is said in place of the table, naming the type and the field.
 * See docs/plans/structures.md.
 */
export function Structures() {
  const reading = useCatalogue('structures.json', parseStructureCatalogue);
  const read = reading.state === 'read' ? reading.shelved.value : null;

  return (
    <InspectPage
      title="Structures"
      bar={
        <span className="inspect-note">
          {read === null ? '' : `${read.types.length} types`} from world/catalogues/structures.json, every
          number a placeholder
        </span>
      }
    >
      {reading.state === 'reading' && (
        <p className="inspect-quiet">reading world/catalogues/structures.json</p>
      )}
      {reading.state === 'unread' && <p className="inspect-problem">{reading.problem}</p>}
      {read !== null && (
        <div className="inspect-scroll">
          <table className="inspect-table">
            <thead>
              <tr>
                <th>type</th>
                <th>levels</th>
                <th>significance</th>
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
    </InspectPage>
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
        <span className="inspect-key">{spec.type}</span>
      </th>
      <td>{spec.levels}</td>
      <td>{byLevel(spec.significance)}</td>
      <td>{byLevel(spec.sightKm)}</td>
      <td>
        {gives.length === 0 ? (
          <span className="inspect-quiet">nothing but sight</span>
        ) : (
          <ul className="inspect-list">
            {gives.map((one) => (
              <li key={one}>{one}</li>
            ))}
          </ul>
        )}
      </td>
      <td>
        {spec.slots.length === 0 ? (
          <span className="inspect-quiet">none</span>
        ) : (
          <ul className="inspect-list">
            {spec.slots.map((slot) => (
              <li key={slot.name}>{saySlot(slot)}</li>
            ))}
          </ul>
        )}
      </td>
      <td>{spec.zone === null ? <span className="inspect-quiet">none</span> : `reach ${spec.zone.reach}`}</td>
      <td>
        <ul className="inspect-list">
          {CULTURES.map((culture) => (
            <li key={culture}>
              <span className="inspect-key">{culture}</span> {spec.words[culture]}
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
