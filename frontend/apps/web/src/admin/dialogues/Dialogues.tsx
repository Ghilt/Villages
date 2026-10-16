import './dialogues.css';

import { useState } from 'react';

import { parseDialogue } from '@villages/world';
import type { Dialogue } from '@villages/world';

import { NumberField, WordsField } from '../frame/Fields';
import { InspectPage } from '../frame/InspectPage';
import { SaveBar, WholeFile } from '../frame/SaveBar';
import { useCatalogueFiles } from '../frame/useCatalogue';
import { useCatalogueEditor } from '../frame/useCatalogueEditor';
import type { CatalogueEditor } from '../frame/useCatalogueEditor';
import { LineEditor } from './LineEditor';
import { Tree } from './Tree';

/** Where the page stands, and a dialogue's own address under it: `/admin/inspect-dialogues/letter`. */
const HERE = '/admin/inspect-dialogues';

/**
 * Every dialogue there is to offer, `world/catalogues/dialogues/`, a file a dialogue: their names across the top, each
 * an address of its own, and the one chosen drawn as its tree - a card a line, leading to the next or to the options
 * of a choice - beside the line chosen in it, its words and numbers changed in place, with the dialogue's title,
 * scene and speakers above. Saved through the game server, which takes it on at once, so the next offer of it says
 * what was saved; one offered already keeps its words. See docs/plans/catalogues.md and decision record 0097.
 */
export function Dialogues() {
  const names = useCatalogueFiles('dialogues');
  const chosen = decodeURIComponent(window.location.pathname.slice(HERE.length + 1)) || names?.[0] || null;
  return (
    <InspectPage
      title="Dialogues"
      bar={
        <span className="inspect-note">
          {names === null ? '' : `${names.length} from world/catalogues/dialogues/`}
        </span>
      }
    >
      <nav className="inspect-each" aria-label="The dialogues">
        {(names ?? []).map((name) => (
          <a
            key={name}
            className={name === chosen ? 'inspect-tab is-chosen' : 'inspect-tab'}
            href={`${HERE}/${name}`}
          >
            {name}
          </a>
        ))}
      </nav>
      {chosen !== null && <OneDialogue key={chosen} name={chosen} />}
    </InspectPage>
  );
}

function OneDialogue({ name }: { name: string }) {
  const editor = useCatalogueEditor(`dialogues/${name}.json`, parseDialogue);
  const dialogue = editor.value;
  const [chosen, choose] = useState<string | null>(null);
  const line = dialogue?.lines.find((one) => one.id === chosen) ?? dialogue?.lines[0] ?? null;
  return (
    <>
      <SaveBar editor={editor} />
      {editor.reading.state === 'unread' && <p className="inspect-problem">{editor.reading.problem}</p>}
      {dialogue !== null && (
        <>
          {dialogue.said !== '' && <p className="inspect-said">{dialogue.said}</p>}
          <Heading editor={editor} dialogue={dialogue} />
          <div className="dialogue-bench">
            <Tree dialogue={dialogue} chosen={line?.id ?? null} choose={choose} />
            {line !== null && <LineEditor editor={editor} dialogue={dialogue} line={line} />}
          </div>
        </>
      )}
      <WholeFile editor={editor} />
    </>
  );
}

function Heading({ editor, dialogue }: { editor: CatalogueEditor<Dialogue>; dialogue: Dialogue }) {
  return (
    <table className="inspect-table">
      <tbody>
        <tr>
          <th scope="row">title</th>
          <td>
            <WordsField editor={editor} path={['title']} label="title" wide />
          </td>
        </tr>
        <tr>
          <th scope="row">scene</th>
          <td>
            {dialogue.scene === null ? (
              <span className="inspect-quiet">none</span>
            ) : (
              <WordsField editor={editor} path={['scene']} label="scene" />
            )}
          </td>
        </tr>
        {dialogue.speakers.map((speaker) => (
          <tr key={speaker.id}>
            <th scope="row">
              {speaker.id} <span className="inspect-key">party</span>{' '}
              <NumberField
                editor={editor}
                path={['speakers', speaker.id, 'party']}
                label={`${speaker.id} party`}
              />
            </th>
            <td>
              {'keyFigure' in speaker.who ? (
                <span className="inspect-quiet">
                  the house's key figure, whoever that is when it is offered
                </span>
              ) : (
                <WordsField
                  editor={editor}
                  path={['speakers', speaker.id, 'name']}
                  label={`${speaker.id} name`}
                  wide
                />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
