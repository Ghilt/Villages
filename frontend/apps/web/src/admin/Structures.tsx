import { CULTURES, parseStructureCatalogue } from '@villages/world';
import type {
  StructureCatalogue,
  StructureResource,
  StructureSlot,
  StructureTypeSpec,
} from '@villages/world';

import { LevelsField, NumberField, WordsField } from './frame/Fields';
import { InspectPage } from './frame/InspectPage';
import { SaveBar, WholeFile } from './frame/SaveBar';
import { useCatalogueEditor } from './frame/useCatalogueEditor';
import type { CatalogueEditor } from './frame/useCatalogueEditor';

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
 * Every type of structure there is, as `world/catalogues/structures.json` says, to read and to change: what each
 * gives its holder a month at each level, how far it sees and how significant it is, its slots and what makes each
 * count, its zone, and what each culture calls it. Read through the dev server, and again whenever the file changes.
 *
 * Every number and word in a cell is changed in place, a level at a time as `34 / 40 / 48`, and saved whole through
 * the game server, which takes it on at once: a house's income moves with the yield. What has no cell - a slot, a
 * type added - is changed in the whole file at the foot. A file this cannot read is said in place of the table,
 * naming the type and the field. See docs/plans/structures.md and docs/plans/catalogues.md.
 */
export function Structures() {
  const editor = useCatalogueEditor('structures.json', parseStructureCatalogue);
  const read = editor.value;

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
      <SaveBar editor={editor} />
      {editor.reading.state === 'reading' && (
        <p className="inspect-quiet">reading world/catalogues/structures.json</p>
      )}
      {editor.reading.state === 'unread' && <p className="inspect-problem">{editor.reading.problem}</p>}
      {read !== null && <TypesTable editor={editor} read={read} />}
      <WholeFile editor={editor} />
    </InspectPage>
  );
}

function TypesTable({
  editor,
  read,
}: {
  editor: CatalogueEditor<StructureCatalogue>;
  read: StructureCatalogue;
}) {
  return (
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
            <TypeRow key={spec.type} editor={editor} spec={spec} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TypeRow({ editor, spec }: { editor: CatalogueEditor<StructureCatalogue>; spec: StructureTypeSpec }) {
  const at = ['types', spec.type] as const;
  const resources = Object.keys(spec.yields) as StructureResource[];
  return (
    <tr>
      <th scope="row">
        {spec.words.european}
        <span className="inspect-key">{spec.type}</span>
      </th>
      <td>{spec.levels}</td>
      <td>
        <LevelsField editor={editor} path={[...at, 'significance']} label={`${spec.type} significance`} />
      </td>
      <td>
        <LevelsField editor={editor} path={[...at, 'sightKm']} label={`${spec.type} sight`} />
      </td>
      <td>
        {resources.length === 0 ? (
          <span className="inspect-quiet">nothing but sight</span>
        ) : (
          <ul className="inspect-list">
            {resources.map((resource) => (
              <li key={resource}>
                {SAID[resource]}{' '}
                <LevelsField
                  editor={editor}
                  path={[...at, 'yields', resource]}
                  label={`${spec.type} ${SAID[resource]} a month`}
                />
              </li>
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
      <td>
        {spec.zone === null ? (
          <span className="inspect-quiet">none</span>
        ) : (
          <>
            reach{' '}
            <NumberField editor={editor} path={[...at, 'zone', 'reach']} label={`${spec.type} zone reach`} />
          </>
        )}
      </td>
      <td>
        <ul className="inspect-list">
          {CULTURES.map((culture) => (
            <li key={culture}>
              <span className="inspect-key">{culture}</span>{' '}
              <WordsField
                editor={editor}
                path={[...at, 'words', culture]}
                label={`${spec.type}, ${culture}`}
              />
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
