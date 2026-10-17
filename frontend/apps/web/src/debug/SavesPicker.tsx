import { useEffect, useState } from 'react';

import type { SaveView } from '@villages/protocol';

import { listSaves, loadSave, sessionStore } from '../net/gateway';
import { useStore } from '../store/useStore';

/** When a save was made, as the panel says it: the day and the minute, in this browser's own time. */
function madeAt(save: SaveView): string {
  return new Date(save.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * The saves of the world, every tree's, to load one in place of this tree's world: a dropdown and a button, because a
 * load replaces the world for everybody connected to it and a slip of the wheel over a dropdown should not. Asked for
 * whenever the connection opens; a save this code cannot read is listed and cannot be picked. See decision record 0101.
 */
export function SavesPicker() {
  const connection = useStore(sessionStore, (state) => state.connection);
  const saves = useStore(sessionStore, (state) => state.saves);
  const [picked, setPicked] = useState('');

  useEffect(() => {
    if (connection === 'open') listSaves();
  }, [connection]);

  const loadable = (saves ?? []).filter((save) => save.unreadable === null);
  const chosen = loadable.some((save) => save.name === picked) ? picked : (loadable[0]?.name ?? '');

  if (saves === null) return null;
  if (saves.length === 0)
    return <p className="debug__quiet">No saves yet: save makes one, for every tree.</p>;
  return (
    <div className="debug__levers">
      <select
        className="debug-map__select debug-saves__pick"
        value={chosen}
        onChange={(event) => setPicked(event.target.value)}
        aria-label="a save to load"
      >
        {saves.map((save) => (
          <option
            key={save.name}
            value={save.name}
            disabled={save.unreadable !== null}
            title={save.unreadable ?? undefined}
          >
            {save.name} · {madeAt(save)} · {save.events} events
            {save.unreadable === null ? '' : ' · cannot be read'}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="debug__button"
        onClick={() => loadSave(chosen)}
        disabled={connection !== 'open' || chosen === ''}
        title="replace this world with the save, for everyone connected to it"
      >
        load
      </button>
    </div>
  );
}
