import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { note } from './log';
import { Section } from './Section';
import { chooseMaster, cutMaster, describeMaster, furnishMaster, isStale, listMasters } from '../map/masters';
import type { MasterOnDisk } from '../map/masters';
import { RENDERERS } from '../map/renderers';
import { fogIsOn, setFogOfWar, watchFog } from '../fog/fogOfWar';
import { lastingOn } from '../fog/describe';
import { gatewayState, giveVision, takeVision, watchGateway } from '../net/gateway';

interface MapSectionProps {
  /** The map, so vision can be given where the camera is looking. Null until it has loaded. */
  map: maplibregl.Map | null;
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
 *
 * **Two errands, because they go stale together and are mended apart.** Cutting traces the coast, cuts
 * the tiles and works out the biomes, which is five minutes; furnishing does only the last of those,
 * which is half a minute and is what an edit to `world/biomes.json` needs. A master that is cut but not
 * furnished draws a bare world, and the dropdown says so. See docs/adr/0054.
 */
export function MapSection({ map, master, renderer, onRenderer }: MapSectionProps) {
  const [masters, setMasters] = useState<MasterOnDisk[]>([]);
  const [tunedAt, setTunedAt] = useState<number | null>(null);
  const [wanted, setWanted] = useState(master);
  const [working, setWorking] = useState<false | 'cut' | 'furnish'>(false);
  const fog = useSyncExternalStore(watchFog, fogIsOn);
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  // The visions given outright that the house still has, oldest first: each one can be taken away.
  const given = (heard.yourSight?.points ?? []).filter(
    (point) => point.kind === 'given' && lastingOn(point, heard.world?.today ?? null),
  );

  const refresh = useCallback(() => {
    void listMasters().then((answer) => {
      setMasters(answer.masters);
      setTunedAt(answer.tunedAt);
    });
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
  // Offered whenever there is a world to furnish, not only when something looks out of date. Tuning a
  // look is running this over and over against a master nothing has touched, and a button that hid
  // itself until the panel thought it was needed would be missing for exactly that.
  const canFurnish = chosen !== undefined && chosen.cutAt !== null;
  const furnishLabel = chosen?.furnishedAt === null ? 'furnish it' : 'furnish it again';

  const pick = (name: string): void => {
    setWanted(name);
    const found = masters.find((candidate) => candidate.name === name);
    if (found !== undefined && found.cutAt !== null && name !== master) {
      note('world', `loading ${name}`);
      chooseMaster(name);
    }
  };

  /**
   * Runs one of the two errands, and starts the page again if it worked.
   *
   * The reload is not laziness. Every painter, every decoded tile and the whole sprite map are read once
   * at startup and held, so the one way to be certain nothing is still holding the old world is to begin
   * again - which is the same reason picking a different master reloads.
   */
  const run = (which: 'cut' | 'furnish'): void => {
    if (chosen === undefined || working !== false) {
      return;
    }
    setWorking(which);
    void (which === 'cut' ? cutMaster(chosen.name) : furnishMaster(chosen.name)).then((ready) => {
      setWorking(false);
      refresh();
      if (ready) {
        chooseMaster(chosen.name);
      }
    });
  };

  const rendererChoice = RENDERERS.find((candidate) => candidate.name === renderer);

  return (
    <Section name="Debug map">
      <label className="debug-map__label" htmlFor="terrain">
        Terrain
      </label>
      <select
        id="terrain"
        className="debug-map__select"
        value={wanted}
        disabled={working !== false}
        onChange={(event) => pick(event.target.value)}
      >
        {masters.length === 0 && <option value={master}>{master}</option>}
        {masters.map((candidate) => (
          <option key={candidate.name} value={candidate.name}>
            {candidate.name}
            {candidate.cutAt === null ? ' (not cut)' : candidate.furnishedAt === null ? ' (bare)' : ''}
          </option>
        ))}
      </select>
      <p className="debug-map__note">{describeMaster(chosen, master, working, tunedAt)}</p>
      {needsCutting && (
        <button
          type="button"
          className="debug-map__cut"
          onClick={() => run('cut')}
          disabled={working !== false}
        >
          {working === 'cut' ? 'cutting, watch the log' : cutLabel}
        </button>
      )}
      {canFurnish && (
        <button
          type="button"
          className="debug-map__cut"
          onClick={() => run('furnish')}
          disabled={working !== false}
          title="work out the biomes and the stands again, without recutting the tiles"
        >
          {working === 'furnish' ? 'furnishing, watch the log' : furnishLabel}
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

      {/*
          Adam's switch for the fog of war, in words, as he asked. On at every load; off lifts all of it for
          this window, the drawing and what the gateway holds back. See decision record 0061.
        */}
      <button
        type="button"
        className={fog ? 'debug-map__switch debug-map__switch--on' : 'debug-map__switch'}
        onClick={() => setFogOfWar(!fog)}
        aria-pressed={fog}
        title="draw the fog of war over what your house cannot see, or lift it in this window"
      >
        {fog ? 'fog of war: on' : 'fog of war: off'}
      </button>

      {/*
          Vision given outright, a real command each way. Left pressable without a house, so the refusal is
          seen in the log rather than guessed from a greyed button. See decision record 0061.
        */}
      <button
        type="button"
        className="debug-map__cut"
        onClick={() => {
          if (map !== null) {
            const centre = map.getCenter();
            giveVision({ lat: centre.lat, lon: centre.lng });
          }
        }}
        disabled={map === null || heard.connection !== 'open'}
        title="give your house vision where the camera is looking, as far as a seat sees, until it is taken away"
      >
        give vision here
      </button>
      {given.map((point) => (
        <div key={point.of} className="debug-map__vision">
          <span>
            given at {point.place.lat.toFixed(2)}, {point.place.lon.toFixed(2)}
          </span>
          <button
            type="button"
            className="debug__button"
            onClick={() => takeVision(point)}
            disabled={heard.connection !== 'open'}
            title="take this vision away; what it saw stays revealed"
          >
            take it away
          </button>
        </div>
      ))}
    </Section>
  );
}
