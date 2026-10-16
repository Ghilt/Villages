import { parseQuest } from '@villages/world';

import { InspectPage } from '../frame/InspectPage';
import { SaveBar, WholeFile } from '../frame/SaveBar';
import { useCatalogueFiles } from '../frame/useCatalogue';
import { useCatalogueEditor } from '../frame/useCatalogueEditor';

/** Where the page stands, and a quest's own address under it: `/admin/inspect-quests/abbot`. */
const HERE = '/admin/inspect-quests';

/**
 * Every quest there is to offer, `world/catalogues/quests/`, a file a quest: their names across the top, each an address
 * of its own, and the one chosen to read and to change, saved through the game server, which takes it on at once. See
 * docs/plans/catalogues.md and decision record 0097.
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
  return (
    <>
      <SaveBar editor={editor} />
      {editor.reading.state === 'unread' && <p className="inspect-problem">{editor.reading.problem}</p>}
      {editor.value !== null && <h2 className="inspect-group__title">{editor.value.title}</h2>}
      <WholeFile editor={editor} />
    </>
  );
}
