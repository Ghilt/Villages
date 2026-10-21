import { useEffect, useState } from 'react';

import type { CatalogueEditor, Path } from './useCatalogueEditor';

/**
 * A place in a catalogue an inspect page edits in its own cell: it reads as the text around it until it is pointed
 * at, holds what is typed until the cell is left or Enter is pressed, and only then hands the editor what it read -
 * or nothing, marked wrong, when it cannot read it. Escape puts it back. Changed from the file, it is marked. See 0097.
 */
function Field({
  editor,
  path,
  shown,
  read,
  wide,
  label,
}: {
  editor: CatalogueEditor<unknown>;
  path: Path;
  /** The value at [path], said as the cell says it. */
  shown: string;
  /** What was typed, read back into a value, or undefined when it cannot be. */
  read: (typed: string) => unknown;
  wide?: boolean;
  label: string;
}) {
  const [typed, setTyped] = useState(shown);
  const [wrong, setWrong] = useState(false);
  useEffect(() => {
    setTyped(shown);
    setWrong(false);
  }, [shown]);

  const commit = () => {
    const value = read(typed.trim());
    if (value === undefined) {
      setWrong(true);
      return;
    }
    setWrong(false);
    editor.set(path, value);
  };
  const edited = editor.isEdited(path);
  return (
    <input
      className={`inspect-field${wide === true ? ' inspect-field--wide' : ''}${edited ? ' is-edited' : ''}${wrong ? ' is-wrong' : ''}`}
      aria-label={label}
      value={typed}
      size={Math.max(2, typed.length)}
      onChange={(event) => setTyped(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') {
          setTyped(shown);
          setWrong(false);
        }
      }}
    />
  );
}

const asNumber = (typed: string): number | undefined =>
  typed !== '' && Number.isFinite(Number(typed)) ? Number(typed) : undefined;

/** A number. */
export function NumberField({
  editor,
  path,
  label,
}: {
  editor: CatalogueEditor<unknown>;
  path: Path;
  label: string;
}) {
  const value = editor.at(path);
  return (
    <Field
      editor={editor}
      path={path}
      label={label}
      shown={typeof value === 'number' ? String(value) : ''}
      read={asNumber}
    />
  );
}

/** A number for each level, said `34 / 40 / 48`; as many as there were, or it is wrong. */
export function LevelsField({
  editor,
  path,
  label,
}: {
  editor: CatalogueEditor<unknown>;
  path: Path;
  label: string;
}) {
  const value = editor.at(path);
  const levels = Array.isArray(value) ? (value as unknown[]) : [];
  const read = (typed: string) => {
    const numbers = typed.split('/').map((each) => asNumber(each.trim()));
    return numbers.length === levels.length && numbers.every((each) => each !== undefined)
      ? numbers
      : undefined;
  };
  return <Field editor={editor} path={path} label={label} shown={levels.join(' / ')} read={read} />;
}

/** Some words. */
export function WordsField({
  editor,
  path,
  label,
  wide,
}: {
  editor: CatalogueEditor<unknown>;
  path: Path;
  label: string;
  wide?: boolean;
}) {
  const value = editor.at(path);
  return (
    <Field
      editor={editor}
      path={path}
      label={label}
      wide={wide}
      shown={typeof value === 'string' ? value : ''}
      read={(typed) => (typed === '' ? undefined : typed)}
    />
  );
}

/** A list of words, said `Hearth, Coin`: split again at the commas, each trimmed, none empty. */
export function ListField({
  editor,
  path,
  label,
  wide,
}: {
  editor: CatalogueEditor<unknown>;
  path: Path;
  label: string;
  wide?: boolean;
}) {
  const value = editor.at(path);
  const each = Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string') : [];
  const read = (typed: string) =>
    typed
      .split(',')
      .map((one) => one.trim())
      .filter((one) => one !== '');
  return <Field editor={editor} path={path} label={label} wide={wide} shown={each.join(', ')} read={read} />;
}

/** Words that run on, a line said in a dialogue: wrapped in a box as tall as they are, handed over when left. */
export function ProseField({
  editor,
  path,
  label,
}: {
  editor: CatalogueEditor<unknown>;
  path: Path;
  label: string;
}) {
  const value = editor.at(path);
  const shown = typeof value === 'string' ? value : '';
  const [typed, setTyped] = useState(shown);
  useEffect(() => setTyped(shown), [shown]);
  const commit = () => {
    if (typed.trim() !== '' && typed.trim() !== shown) editor.set(path, typed.trim());
    if (typed.trim() === '') setTyped(shown);
  };
  return (
    <textarea
      className={`inspect-field inspect-prose${editor.isEdited(path) ? ' is-edited' : ''}`}
      aria-label={label}
      value={typed}
      rows={Math.max(2, Math.ceil(typed.length / 48))}
      onChange={(event) => setTyped(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        }
        if (event.key === 'Escape') setTyped(shown);
      }}
    />
  );
}

/** Yes or no, a box: set at once, and a field left out of the file is no. */
export function FlagField({
  editor,
  path,
  label,
}: {
  editor: CatalogueEditor<unknown>;
  path: Path;
  label: string;
}) {
  return (
    <label className={`inspect-pick${editor.isEdited(path) ? ' is-edited' : ''}`}>
      <input
        type="checkbox"
        checked={editor.at(path) === true}
        onChange={(event) => editor.set(path, event.target.checked)}
      />{' '}
      {label}
    </label>
  );
}

/** One of a few, a select: set at once, and a field left out of the file is the choice whose value is none. */
export function ChoiceField({
  editor,
  path,
  label,
  choices,
}: {
  editor: CatalogueEditor<unknown>;
  path: Path;
  label: string;
  choices: readonly { readonly value: string | null; readonly said: string }[];
}) {
  const value = editor.at(path);
  return (
    <label className={`inspect-pick${editor.isEdited(path) ? ' is-edited' : ''}`}>
      <select
        aria-label={label}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => editor.set(path, event.target.value === '' ? undefined : event.target.value)}
      >
        {choices.map((choice) => (
          <option key={choice.value ?? ''} value={choice.value ?? ''}>
            {choice.said}
          </option>
        ))}
      </select>
    </label>
  );
}
