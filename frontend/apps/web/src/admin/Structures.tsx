import './structures.css';

import { useState } from 'react';

import { CULTURES, markKey, parseStructureCatalogue, pictureKey } from '@villages/world';
import type {
  StructureCatalogue,
  StructureResource,
  StructureSlot,
  StructureTypeSpec,
} from '@villages/world';

import { Cut, useAtlas } from './frame/Atlas';
import { LevelsField, NumberField, WordsField } from './frame/Fields';
import { InspectPage } from './frame/InspectPage';
import { SettlementLayouts } from './SettlementLayouts';
import { SettlementPieces } from './SettlementPieces';
import { Standing } from './Standing';
import type { StructuresAtlas } from './Standing';
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

/** How tall a structure's picture is drawn beside its words, and its pin beside its name, and how wide at most. */
const TALL = 40;
const WIDE = 48;

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
 * naming the type and the field.
 *
 * Beside each type's name stands its pin, and beside what each culture calls it its picture in that culture, as
 * `world:structures` cut them into their atlas, read again whenever the dev server cuts it again: save a picture over
 * a placeholder and it is here. A placeholder is ringed in dashes. See docs/plans/structures.md and
 * docs/plans/catalogues.md.
 *
 * On the ground, each culture's picture stands on its footprint at the level chosen, as tall as it is drawn on the map
 * and on the diamonds as the camera sees them closest in, so a footprint is tuned against the base it lies under. See
 * docs/plans/worked-ground.md.
 */
export function Structures() {
  const editor = useCatalogueEditor('structures.json', parseStructureCatalogue);
  const read = editor.value;
  const atlas = useAtlas<StructuresAtlas>('structures');
  const [level, setLevel] = useState(1);

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
      {atlas === 'missing' && (
        <p className="inspect-quiet">
          the pictures are not cut in this tree yet: npm run world:structures --prefix frontend, or the quick
          start
        </p>
      )}
      {read !== null && (
        <p className="inspect-note structures-levels">
          standing at level{' '}
          {[1, 2, 3].map((one) => (
            <button
              key={one}
              type="button"
              className="inspect-button"
              aria-pressed={one === level}
              onClick={() => setLevel(one)}
            >
              {one}
            </button>
          ))}
        </p>
      )}
      {read !== null && (
        <TypesTable editor={editor} read={read} atlas={atlas === 'missing' ? null : atlas} level={level} />
      )}
      <SettlementPieces />
      <SettlementLayouts />
      <WholeFile editor={editor} />
    </InspectPage>
  );
}

function TypesTable({
  editor,
  read,
  atlas,
  level,
}: {
  editor: CatalogueEditor<StructureCatalogue>;
  read: StructureCatalogue;
  atlas: StructuresAtlas | null;
  level: number;
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
            <th>on the ground</th>
            <th>in each culture</th>
          </tr>
        </thead>
        <tbody>
          {read.types.map((spec) => (
            <TypeRow key={spec.type} editor={editor} spec={spec} atlas={atlas} level={level} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TypeRow({
  editor,
  spec,
  atlas,
  level,
}: {
  editor: CatalogueEditor<StructureCatalogue>;
  spec: StructureTypeSpec;
  atlas: StructuresAtlas | null;
  level: number;
}) {
  const shown = Math.min(level, spec.levels) - 1;
  const at = ['types', spec.type] as const;
  const resources = Object.keys(spec.yields) as StructureResource[];
  return (
    <tr>
      <th scope="row">
        <div className="structures-named">
          <Picture atlas={atlas} at={markKey(spec.type)} name={`the ${spec.type}'s pin`} />
          <span>
            {spec.words.european}
            <span className="inspect-key">{spec.type}</span>
          </span>
        </div>
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
          <li>
            tall <LevelsField editor={editor} path={[...at, 'groundHeight']} label={`${spec.type} height`} />
          </li>
          <li>
            footprint{' '}
            <LevelsField editor={editor} path={[...at, 'footprint']} label={`${spec.type} footprint`} />
          </li>
        </ul>
        <div className="structures-standing">
          {CULTURES.map((culture) => (
            <Standing
              key={culture}
              atlas={atlas}
              at={pictureKey(spec.type, culture)}
              name={`${spec.type}, ${culture}, on its footprint`}
              height={spec.groundHeight[shown]!}
              side={spec.footprint[shown]!}
            />
          ))}
        </div>
      </td>
      <td>
        <ul className="inspect-list">
          {CULTURES.map((culture) => (
            <li key={culture} className="structures-named">
              <Picture atlas={atlas} at={pictureKey(spec.type, culture)} name={`${spec.type}, ${culture}`} />
              <span>
                <span className="inspect-key">{culture}</span>{' '}
                <WordsField
                  editor={editor}
                  path={[...at, 'words', culture]}
                  label={`${spec.type}, ${culture}`}
                />
              </span>
            </li>
          ))}
        </ul>
      </td>
    </tr>
  );
}

/** A picture of the structures' atlas by the name the map asks for it by, in a box the same size whether it is cut or not. */
function Picture({ atlas, at, name }: { atlas: StructuresAtlas | null; at: string; name: string }) {
  const frame = atlas?.frames[at];
  return (
    <span className="structures-picture">
      {atlas !== null && frame !== undefined && (
        <Cut name={name} atlas={atlas} image="/art/structures.webp" frame={frame} tall={TALL} wide={WIDE} />
      )}
    </span>
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
