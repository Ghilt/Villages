import { parseBalance } from '@villages/world';

import { InspectPage } from './frame/InspectPage';
import { SaveBar, WholeFile } from './frame/SaveBar';
import { useCatalogueEditor } from './frame/useCatalogueEditor';

/**
 * The balance, `world/catalogues/balance.json`: the numbers that belong to no one entry of a catalogue, to read and
 * to change, saved through the game server, which takes them on at once. See docs/plans/catalogues.md.
 */
export function Balance() {
  const editor = useCatalogueEditor('balance.json', parseBalance);
  return (
    <InspectPage
      title="Balance"
      bar={
        <span className="inspect-note">from world/catalogues/balance.json, every number a first draft</span>
      }
    >
      <SaveBar editor={editor} />
      {editor.reading.state === 'unread' && <p className="inspect-problem">{editor.reading.problem}</p>}
      <WholeFile editor={editor} />
    </InspectPage>
  );
}
