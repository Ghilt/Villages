import { useCallback, useEffect, useState } from 'react';

import { note } from '../debug/log';
import { chooseMaster, cutMaster, describeMaster, isStale, listMasters } from './masters';
import type { MasterOnDisk } from './masters';
import { RENDERERS } from './renderers';

interface DebugMapPanelProps {
  /** The master this page is drawing. Switching to another one reloads the page. */
  master: string;
  renderer: string;
  onRenderer: (name: string) => void;
}

/**
 * Which world is on the screen and what draws it. Scaffolding for deciding a look and for looking at a
 * master, not part of the interface a player will end up with.
 *
 * The terrain dropdown is every PNG in `world/master`, because that is where a master is painted and
 * the point is to see a Photoshop save without leaving the browser. A master nobody has cut yet cannot
 * be drawn - the browser draws map tiles, not a 32768 pixel image - so picking one offers to cut it,
 * and the commands' own output goes into the debug log below while it runs. See docs/adr/0025.
 */
export function DebugMapPanel({ master, renderer, onRenderer }: DebugMapPanelProps) {
  const [masters, setMasters] = useState<MasterOnDisk[]>([]);
  const [wanted, setWanted] = useState(master);
  const [cutting, setCutting] = useState(false);

  const refresh = useCallback(() => {
    void listMasters().then(setMasters);
  }, []);

  // Also whenever the window is given focus, which is what coming back from an image editor looks like:
  // the file has just changed on disk, and the panel should say so without being asked.
  useEffect(() => {
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  const chosen = masters.find((candidate) => candidate.name === wanted);
  const needsCutting = chosen !== undefined && (chosen.cutAt === null || isStale(chosen));
  const cutLabel = chosen?.cutAt === null ? 'cut it' : 'cut it again';

  const pick = (name: string): void => {
    setWanted(name);
    const found = masters.find((candidate) => candidate.name === name);
    if (found !== undefined && found.cutAt !== null && name !== master) {
      note('world', `loading ${name}`);
      chooseMaster(name);
    }
  };

  const cut = (): void => {
    if (chosen === undefined || cutting) {
      return;
    }
    setCutting(true);
    void cutMaster(chosen.name).then((ready) => {
      setCutting(false);
      refresh();
      if (!ready) {
        return;
      }
      // Either way the page has to start again: a different master to draw, or the same one cut afresh.
      chooseMaster(chosen.name);
    });
  };

  const rendererChoice = RENDERERS.find((candidate) => candidate.name === renderer);

  return (
    <div className="debug-map">
      <p className="debug-map__title">Debug map</p>

      <label className="debug-map__label" htmlFor="terrain">
        Terrain
      </label>
      <select
        id="terrain"
        className="debug-map__select"
        value={wanted}
        disabled={cutting}
        onChange={(event) => pick(event.target.value)}
      >
        {masters.length === 0 && <option value={master}>{master}</option>}
        {masters.map((candidate) => (
          <option key={candidate.name} value={candidate.name}>
            {candidate.name}
            {candidate.cutAt === null ? ' (not cut)' : ''}
          </option>
        ))}
      </select>
      <p className="debug-map__note">{describeMaster(chosen, master, cutting)}</p>
      {needsCutting && (
        <button type="button" className="debug-map__cut" onClick={cut} disabled={cutting}>
          {cutting ? 'cutting, watch the log' : cutLabel}
        </button>
      )}

      <label className="debug-map__label" htmlFor="renderer">
        Renderer
      </label>
      <select
        id="renderer"
        className="debug-map__select"
        value={renderer}
        onChange={(event) => onRenderer(event.target.value)}
      >
        {RENDERERS.map((candidate) => (
          <option key={candidate.name} value={candidate.name}>
            {candidate.title}
          </option>
        ))}
      </select>
      {rendererChoice !== undefined && <p className="debug-map__note">{rendererChoice.note}</p>}
    </div>
  );
}
