import './quests.css';

import { useState } from 'react';

import { parseQuest } from '@villages/world';

import { FlagField, WordsField } from '../frame/Fields';
import { InspectPage } from '../frame/InspectPage';
import { SaveBar, WholeFile } from '../frame/SaveBar';
import { useCatalogueFiles } from '../frame/useCatalogue';
import { useCatalogueEditor } from '../frame/useCatalogueEditor';
import { NodeEditor } from './NodeEditor';
import { Road } from './Road';

/** Where the page stands, and a quest's own address under it: `/admin/inspect-quests/abbot`. */
const HERE = '/admin/inspect-quests';

/**
 * Every quest there is to offer, `world/catalogues/quests/`, a file a quest: their names across the top, each an
 * address of its own, and the one chosen drawn as its road - a card a node, a fork's roads named by the endings that
 * take them - beside the node chosen on it, its title, its marks, its objectives' and its reward's numbers changed in
 * place, a dialogue node linking to the dialogue's own page. Saved through the game server, which takes it on at once,
 * so the next offer of it is what was saved; one offered already keeps its road. See docs/plans/catalogues.md and
 * decision record 0097.
 */
export function Quests() {
  const names = useCatalogueFiles('quests');
  const chosen = decodeURIComponent(window.location.pathname.slice(HERE.length + 1)) || names?.[0] || null;
  return (
    <InspectPage
      title="Quests"
      bar={
        <span className="inspect-note">
          {names === null ? '' : `${names.length} from world/catalogues/quests/`}
        </span>
      }
    >
      <nav className="inspect-each" aria-label="The quests">
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
      {chosen !== null && <OneQuest key={chosen} name={chosen} />}
    </InspectPage>
  );
}

function OneQuest({ name }: { name: string }) {
  const editor = useCatalogueEditor(`quests/${name}.json`, parseQuest);
  const quest = editor.value;
  const [chosen, choose] = useState<string | null>(null);
  const node = quest?.nodes.find((one) => one.id === chosen) ?? quest?.nodes[0] ?? null;
  return (
    <>
      <SaveBar editor={editor} />
      {editor.reading.state === 'unread' && <p className="inspect-problem">{editor.reading.problem}</p>}
      {quest !== null && (
        <>
          {quest.said !== '' && <p className="inspect-said">{quest.said}</p>}
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
                  {quest.scene === null ? (
                    <span className="inspect-quiet">none</span>
                  ) : (
                    <WordsField editor={editor} path={['scene']} label="scene" />
                  )}
                </td>
              </tr>
              <tr>
                <th scope="row">drawn</th>
                <td>
                  <FlagField
                    editor={editor}
                    path={['shownFromTheStart']}
                    label="every node shown from the start"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <div className="quest-bench">
            <Road quest={quest} chosen={node?.id ?? null} choose={choose} />
            {node !== null && <NodeEditor editor={editor} node={node} />}
          </div>
        </>
      )}
      <WholeFile editor={editor} />
    </>
  );
}
