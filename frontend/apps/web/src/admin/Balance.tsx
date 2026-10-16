import { parseBalance } from '@villages/world';
import type { Balance as BalanceFile } from '@villages/world';

import { NumberField } from './frame/Fields';
import { InspectPage } from './frame/InspectPage';
import { SaveBar, WholeFile } from './frame/SaveBar';
import { useCatalogueEditor } from './frame/useCatalogueEditor';
import type { CatalogueEditor, Path } from './frame/useCatalogueEditor';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A field's name as the page says it: `weakForDays` is *weak for days*. */
const wordsOf = (key: string) => key.replace(/([A-Z0-9]+)/g, ' $1').toLowerCase();

/** The fields of a group that are numbers or lists of them, leaving out what begins `$`, which says what they do. */
const fieldsOf = (group: Json) => Object.entries(group).filter(([key]) => !key.startsWith('$'));

/**
 * The balance, `world/catalogues/balance.json`: the numbers that belong to no one entry of a catalogue, a group at a
 * time with what its numbers do in its own words, every one changed in place and saved through the game server, which
 * takes them on at once - the next roll costs what the page saved. Drawn from the file itself, so a number added to
 * it is on the page without the page being told. Odds that do not add up to a hundred are said, and the server
 * refuses them. See docs/plans/catalogues.md and decision record 0097.
 */
export function Balance() {
  const editor = useCatalogueEditor('balance.json', parseBalance);
  const draft = isObject(editor.draft) ? editor.draft : null;
  return (
    <InspectPage
      title="Balance"
      bar={
        <span className="inspect-note">from world/catalogues/balance.json, every number a first draft</span>
      }
    >
      <SaveBar editor={editor} />
      {editor.reading.state === 'reading' && (
        <p className="inspect-quiet">reading world/catalogues/balance.json</p>
      )}
      {editor.reading.state === 'unread' && <p className="inspect-problem">{editor.reading.problem}</p>}
      {draft !== null && (
        <>
          {typeof draft.$comment === 'string' && <p className="inspect-said">{draft.$comment}</p>}
          {fieldsOf(draft).map(([name, group]) =>
            isObject(group) ? <Group key={name} editor={editor} name={name} group={group} /> : null,
          )}
        </>
      )}
      <WholeFile editor={editor} />
    </InspectPage>
  );
}

function Group({ editor, name, group }: { editor: CatalogueEditor<BalanceFile>; name: string; group: Json }) {
  return (
    <section className="inspect-group" aria-label={name}>
      <h2 className="inspect-group__title">{wordsOf(name)}</h2>
      {typeof group.$comment === 'string' && <p className="inspect-said">{group.$comment}</p>}
      <table className="inspect-table">
        <tbody>
          {fieldsOf(group).map(([field, value]) => (
            <tr key={field}>
              <th scope="row">{wordsOf(field)}</th>
              <td>
                <Value editor={editor} path={[name, field]} value={value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** A number, or a number for each of several things - a rarity's odds - with what they add up to. */
function Value({
  editor,
  path,
  value,
}: {
  editor: CatalogueEditor<BalanceFile>;
  path: Path;
  value: unknown;
}) {
  if (typeof value === 'number') {
    return <NumberField editor={editor} path={path} label={path.join('.')} />;
  }
  if (!isObject(value)) {
    return <span className="inspect-quiet">not a number</span>;
  }
  const each = fieldsOf(value);
  const sum = each.reduce((total, [, one]) => total + (typeof one === 'number' ? one : 0), 0);
  return (
    <ul className="inspect-each">
      {each.map(([key]) => (
        <li key={key}>
          <span className="inspect-key">{wordsOf(key)}</span>{' '}
          <NumberField editor={editor} path={[...path, key]} label={`${path.join('.')}.${key}`} />
        </li>
      ))}
      {path[path.length - 1] === 'odds' && (
        <li className={sum === 100 ? 'inspect-quiet' : 'inspect-problem'}>
          {sum === 100 ? 'out of a hundred' : `add up to ${sum}, not a hundred`}
        </li>
      )}
    </ul>
  );
}
