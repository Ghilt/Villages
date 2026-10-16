import { parseFate } from '@villages/world';

import { InspectPage } from './frame/InspectPage';
import { SaveBar, WholeFile } from './frame/SaveBar';
import { useCatalogueEditor } from './frame/useCatalogueEditor';

/**
 * The pools and the actions a choice roll deals from, `world/catalogues/fate.json`, to read and to change, saved
 * through the game server, which takes them on at once. See docs/plans/catalogues.md.
 */
export function Rolls() {
  const editor = useCatalogueEditor('fate.json', parseFate);
  return (
    <InspectPage title="Rolls" bar={<span className="inspect-note">from world/catalogues/fate.json</span>}>
      <SaveBar editor={editor} />
      {editor.reading.state === 'unread' && <p className="inspect-problem">{editor.reading.problem}</p>}
      <WholeFile editor={editor} />
    </InspectPage>
  );
}
