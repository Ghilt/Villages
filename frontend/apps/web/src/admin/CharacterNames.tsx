import { parseCharacterNames } from '@villages/world';

import { InspectPage } from './frame/InspectPage';
import { SaveBar, WholeFile } from './frame/SaveBar';
import { useCatalogueEditor } from './frame/useCatalogueEditor';

/**
 * The names a newcomer can be given, `world/catalogues/character-names.json`, to read and to change, saved through the
 * game server, which takes them on at once. See docs/plans/catalogues.md.
 */
export function CharacterNames() {
  const editor = useCatalogueEditor('character-names.json', parseCharacterNames);
  return (
    <InspectPage
      title="Character names"
      bar={<span className="inspect-note">from world/catalogues/character-names.json</span>}
    >
      <SaveBar editor={editor} />
      {editor.reading.state === 'unread' && <p className="inspect-problem">{editor.reading.problem}</p>}
      <WholeFile editor={editor} />
    </InspectPage>
  );
}
