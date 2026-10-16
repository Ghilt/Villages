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
