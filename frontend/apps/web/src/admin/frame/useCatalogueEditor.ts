import { useCallback, useMemo, useState } from 'react';

import { useCatalogue } from './useCatalogue';
import type { Reading, Shelved } from './useCatalogue';
import { useShelf } from './useShelf';
import { getAt, keyOf, setAt, startsWith } from './draft';
import type { Path } from './draft';
import type { SaveAnswer, ShelfLink } from './useShelf';

export type { Path } from './draft';

/** A catalogue being edited on its inspect page, saved through the game server. */
export interface CatalogueEditor<T> {
  /** The file as the dev server last read it. */
  readonly reading: Reading<T>;
  readonly shelf: ShelfLink;
  /** The catalogue with every change made on the page, as JSON; null until the file has been read. */
  readonly draft: unknown;
  /** The draft as the world package reads it, or the last that read when it does not. */
  readonly value: T | null;
  /** Why the draft would not read, which is why it cannot be saved; null when it reads. */
  readonly problem: string | null;
  /** How many places the page has changed. */
  readonly edits: number;
  /** The file changed on disk since the first change here, so a save would be refused: discard to read it again. */
  readonly stale: boolean;
  /** Whether the game server runs on the file as read: `this`, another version of it, or unknown. */
  readonly runsOn: 'this' | 'another' | 'unknown';
  readonly saving: boolean;
  /** What the last save was answered, until the next change. */
  readonly answer: SaveAnswer | null;
  at(path: Path): unknown;
  isEdited(path: Path): boolean;
  set(path: Path, value: unknown): void;
  discard(): void;
  save(): void;
}

/**
 * A catalogue file as an inspect page edits it: read through the dev server, changed a place at a time - a number,
 * a word, the whole file - and saved whole through the game server, which writes it in the catalogues' one form and
 * takes it on. The changes are held over the version they began on, so a file changed on disk meanwhile is never
 * written over: the server refuses the save as stale. See decision record 0097.
 */
export function useCatalogueEditor<T>(file: string, parse: (text: string) => T): CatalogueEditor<T> {
  const catalogue = file.replace(/\.json$/, '');
  const reading = useCatalogue(file, parse);
  const shelf = useShelf();
  const [base, setBase] = useState<Shelved<T> | null>(null);
  const [changes, setChanges] = useState<ReadonlyMap<string, { path: Path; value: unknown }>>(new Map());
  const [saving, setSaving] = useState(false);
  const [answer, setAnswer] = useState<SaveAnswer | null>(null);

  const read = reading.state === 'read' ? reading.shelved : null;
  const current = base ?? read;
  const original = useMemo(
    () => (current === null ? null : (JSON.parse(current.text) as unknown)),
    [current],
  );
  const draft = useMemo<unknown>(() => {
    if (original === null) return null;
    let json: unknown = original;
    for (const at of changes.values()) json = setAt(json, at.path, at.value);
    return json;
  }, [original, changes]);
  const { value, problem } = useMemo(() => {
    if (draft === null) return { value: read?.value ?? null, problem: null };
    try {
      return { value: parse(JSON.stringify(draft)), problem: null };
    } catch (unread) {
      return {
        value: read?.value ?? null,
        problem: unread instanceof Error ? unread.message : String(unread),
      };
    }
  }, [draft, parse, read]);

  const set = useCallback(
    (path: Path, next: unknown) => {
      if (current === null) return;
      setBase(current);
      setAnswer(null);
      setChanges((held) => {
        const changed = new Map(held);
        if (JSON.stringify(getAt(original, path)) === JSON.stringify(next)) changed.delete(keyOf(path));
        else changed.set(keyOf(path), { path, value: next });
        return changed;
      });
    },
    [current, original],
  );

  const discard = useCallback(() => {
    setChanges(new Map());
    setBase(null);
    setAnswer(null);
  }, []);

  const save = useCallback(() => {
    if (current === null || draft === null) return;
    setSaving(true);
    void shelf
      .revise(catalogue, `${JSON.stringify(draft, null, 2)}\n`, current.fingerprint)
      .then((answered) => {
        setSaving(false);
        setAnswer(answered);
        if (answered.saved) {
          setChanges(new Map());
          setBase(null);
        }
      });
  }, [catalogue, current, draft, shelf]);

  const inForce = shelf.inForce?.[catalogue];
  return {
    reading,
    shelf,
    draft,
    value,
    problem,
    edits: changes.size,
    stale: base !== null && read !== null && read.fingerprint !== base.fingerprint,
    runsOn:
      inForce === undefined || read === null ? 'unknown' : inForce === read.fingerprint ? 'this' : 'another',
    saving,
    answer,
    at: (path) => getAt(draft, path),
    isEdited: (path) =>
      [...changes.values()].some((at) => startsWith(at.path, path) || startsWith(path, at.path)),
    set,
    discard,
    save,
  };
}
