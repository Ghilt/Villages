import { parseDialogue } from '@villages/world';

import { InspectPage } from '../frame/InspectPage';
import { SaveBar, WholeFile } from '../frame/SaveBar';
import { useCatalogueFiles } from '../frame/useCatalogue';
import { useCatalogueEditor } from '../frame/useCatalogueEditor';

/** Where the page stands, and a dialogue's own address under it: `/admin/inspect-dialogues/letter`. */
const HERE = '/admin/inspect-dialogues';

/**
 * Every dialogue there is to offer, `world/catalogues/dialogues/`, a file a dialogue: their names across the top, each
 * an address of its own, and the one chosen to read and to change, saved through the game server, which takes it on at
 * once. See docs/plans/catalogues.md and decision record 0097.
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
  return (
    <>
      <SaveBar editor={editor} />
      {editor.reading.state === 'unread' && <p className="inspect-problem">{editor.reading.problem}</p>}
      {editor.value !== null && <h2 className="inspect-group__title">{editor.value.title}</h2>}
      <WholeFile editor={editor} />
    </>
  );
}
