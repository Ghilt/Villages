import { useState } from 'react';

import { parseCharacterNames } from '@villages/world';
import type { CharacterNames as Names } from '@villages/world';

import { InspectPage } from './frame/InspectPage';
import { SaveBar, WholeFile } from './frame/SaveBar';
import { useCatalogueEditor } from './frame/useCatalogueEditor';
import type { CatalogueEditor, Path } from './frame/useCatalogueEditor';

/**
 * The names a newcomer can be given, `world/catalogues/character-names.json`: the given names of women and of men and
 * the family names, every one changed in place, emptied to take it out, or added at the end of its list, and saved
 * through the game server, which takes them on at once - the next newcomer is named from what was saved. A name a
 * character cannot have is refused by the server, naming it. See docs/plans/catalogues.md and decision record 0097.
 */
export function CharacterNames() {
  const editor = useCatalogueEditor('character-names.json', parseCharacterNames);
  const names = editor.value;
  const was = editor.reading.state === 'read' ? editor.reading.shelved.value : null;
  return (
    <InspectPage
      title="Character names"
      bar={
        <span className="inspect-note">
          {names === null
            ? ''
            : `${names.woman.length + names.man.length} given and ${names.family.length} family names `}
          from world/catalogues/character-names.json
        </span>
      }
    >
      <SaveBar editor={editor} />
      {editor.reading.state === 'reading' && (
        <p className="inspect-quiet">reading world/catalogues/character-names.json</p>
      )}
      {editor.reading.state === 'unread' && <p className="inspect-problem">{editor.reading.problem}</p>}
      {names !== null && (
        <>
          {names.said !== '' && <p className="inspect-said">{names.said}</p>}
          <NameList
            editor={editor}
            title="women"
            path={['given', 'woman']}
            names={names.woman}
            was={was?.woman}
          />
          <NameList editor={editor} title="men" path={['given', 'man']} names={names.man} was={was?.man} />
          <NameList
            editor={editor}
            title="families"
            path={['family']}
            names={names.family}
            was={was?.family}
          />
        </>
      )}
      <WholeFile editor={editor} />
    </InspectPage>
  );
}

/** One list of names: each in a cell of its own, emptied to take it out, and a cell at the end to add one. */
function NameList({
  editor,
  title,
  path,
  names,
  was = [],
}: {
  editor: CatalogueEditor<Names>;
  title: string;
  path: Path;
  names: readonly string[];
  /** The list as the file says it, to mark what the page has changed. */
  was?: readonly string[];
}) {
  const replace = (at: number, name: string) =>
    editor.set(
      path,
      name === '' ? names.filter((_, one) => one !== at) : names.map((was, one) => (one === at ? name : was)),
    );
  return (
    <section className="inspect-group" aria-label={title}>
      <h2 className="inspect-group__title">
        {title} <span className="inspect-key">{names.length}</span>
      </h2>
      <ul className="inspect-each">
        {names.map((name, at) => (
          <li key={`${at}:${name}`}>
            <NameCell
              name={name}
              edited={was[at] !== name}
              label={`${title}, ${name}`}
              commit={(typed) => replace(at, typed)}
            />
          </li>
        ))}
        <li>
          <NameCell
            name=""
            label={`a name to add to the ${title}`}
            commit={(typed) => typed !== '' && editor.set(path, [...names, typed])}
          />
        </li>
      </ul>
    </section>
  );
}

/** A name in its cell: handed over when the cell is left or Enter is pressed, and put back by Escape. */
function NameCell({
  name,
  label,
  edited = false,
  commit,
}: {
  name: string;
  label: string;
  edited?: boolean;
  commit: (typed: string) => void;
}) {
  const [typed, setTyped] = useState(name);
  const done = () => {
    if (typed.trim() !== name) commit(typed.trim());
    if (name === '') setTyped('');
  };
  return (
    <input
      className={`inspect-field${edited ? ' is-edited' : ''}`}
      aria-label={label}
      placeholder={name === '' ? 'add a name' : undefined}
      value={typed}
      size={Math.max(8, typed.length)}
      onChange={(event) => setTyped(event.target.value)}
      onBlur={done}
      onKeyDown={(event) => {
        if (event.key === 'Enter') done();
        if (event.key === 'Escape') setTyped(name);
      }}
    />
  );
}
