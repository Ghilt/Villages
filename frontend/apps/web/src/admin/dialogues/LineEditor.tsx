import type { Dialogue, DialogueLine } from '@villages/world';

import { NumberField, ProseField } from '../frame/Fields';
import type { CatalogueEditor } from '../frame/useCatalogueEditor';

/** What a line shows, as the page says it. */
const SHOWS: Record<NonNullable<DialogueLine['shows']>, string> = {
  seat: "the house's seat",
  house: 'the house',
  keyFigure: 'the key figure',
};

/** What an option reveals, as the page says it: hidden, or each resource it gives and takes. */
function sayReveals(reveals: DialogueLine['reveals']): string {
  if (reveals === null) return 'nothing, until it is taken';
  if (reveals === 'hidden') return 'that something will come of it, and not what';
  return reveals
    .flatMap((each) =>
      Object.entries(each).map(([resource, amount]) => `${amount > 0 ? '+' : ''}${amount} ${resource}`),
    )
    .join(', ');
}

/** Where a line leads, as the page says it. */
function sayThen(then: DialogueLine['then']): string {
  if (then === null) return 'the end';
  return typeof then === 'string' ? `on to ${then}` : `a choice of ${then.join(', ')}`;
}

/**
 * The line chosen in the tree, to change: its words - `{given}` for the key figure's given name - and what it grants
 * and spends, in place, with what it reveals, shows and leads to said beside. What has no cell here - a line added, a
 * lead moved - is changed in the whole file. See decision record 0097.
 */
export function LineEditor({
  editor,
  dialogue,
  line,
}: {
  editor: CatalogueEditor<Dialogue>;
  dialogue: Dialogue;
  line: DialogueLine;
}) {
  const at = ['lines', line.id] as const;
  const speaker = dialogue.speakers.find((one) => one.id === line.by);
  const said =
    speaker === undefined
      ? line.by
      : 'keyFigure' in speaker.who
        ? "the house's key figure"
        : speaker.who.name;
  return (
    <section className="dialogue-line-editor" aria-label={`line ${line.id}`}>
      <h3 className="inspect-group__subtitle">
        {line.id} <span className="inspect-key">said by {said}</span>
      </h3>
      <ProseField editor={editor} path={[...at, 'says']} label={`${line.id}, its words`} />
      <table className="inspect-table">
        <tbody>
          {(['grants', 'spends'] as const).map((field) =>
            Object.keys(line[field]).map((resource) => (
              <tr key={`${field}.${resource}`}>
                <th scope="row">{field}</th>
                <td>
                  <NumberField
                    editor={editor}
                    path={[...at, field, resource]}
                    label={`${line.id} ${field} ${resource}`}
                  />{' '}
                  {resource}
                </td>
              </tr>
            )),
          )}
          <tr>
            <th scope="row">reveals</th>
            <td>{sayReveals(line.reveals)}</td>
          </tr>
          <tr>
            <th scope="row">shows</th>
            <td>{line.shows === null ? 'nothing' : SHOWS[line.shows]}</td>
          </tr>
          <tr>
            <th scope="row">then</th>
            <td>{sayThen(line.then)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
