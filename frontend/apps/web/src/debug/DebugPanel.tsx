import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { FLAT_MAX_ZOOM, TILE } from '../map/painterlyMessages';
import { forgetPaintedTally } from '../map/painterlyTiles';
import { sheetCoversView, sheetOnScreen } from '../map/sheet';
import { WORLD_MASTER_WIDTH } from '../map/worldStyle';
import { AreasView } from '../areas/AreasView';
import { atToClock, note, notesNow, watchNotes } from './log';
import { restart, wipeWorld } from '../net/gateway';
import { describeTerrainStep } from './terrainDepth';
import { EventsView } from './EventsView';

interface DebugPanelProps {
  map: maplibregl.Map | null;
  /** Where this page's tiles live, which is what an area is counted against. */
  worldRoot: string;
}

const OPEN_KEY = 'villages.debug.open';

/**
 * How long the camera has to settle before the terrain says where it ended up.
 *
 * A `flyTo` crosses half a dozen tile zooms on its way and a pinch crosses several, and a line for each
 * step was six lines about one movement. The run is said once, by where it started and where it
 * stopped. The same quarter second everything else in the program gathers over.
 */
const SETTLE_MS = 250;

/**
 * What the program thinks is happening, on the screen rather than in a console.
 *
 * It is the log and the buttons. The block of state that used to sit above them - the zoom, the sheet,
 * the cell names, the counts - went on 2026-09-16, because it was not what Adam read: what a thing does
 * is said as it happens, in a line of the log, and what he wants to change is a button. The copy button
 * puts the log on the clipboard so it can be pasted into a conversation.
 *
 * The camera still says the two things about itself that are worth knowing - that the sheet stopped
 * covering the view, and where the terrain came from and went - but it says them to the log when they
 * happen rather than to a row that is always there, and a run of zoom steps is one line rather than
 * six. See decision record 0023.
 */
export function DebugPanel({ map, worldRoot }: DebugPanelProps) {
  const notes = useSyncExternalStore(watchNotes, notesNow);
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) !== 'no';
    } catch {
      return true;
    }
  });
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const tileZoomWas = useRef<number | undefined>(undefined);
  /** Where a run of zoom steps began, and the timer that will say it once the camera stops moving. */
  const cameFrom = useRef<number | undefined>(undefined);
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coveredWas = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? 'yes' : 'no');
    } catch {
      // A browser that will not remember the choice is not a reason to fail.
    }
  }, [open]);

  useEffect(() => {
    if (map === null) {
      return;
    }
    const look = () => {
      const centre = map.getCenter();
      // Below zoom 0 MapLibre still asks for the z0 tile, so this says z0 rather than a zoom no tile
      // has. See decision 0033.
      const tileZoom = Math.max(0, Math.min(Math.round(map.getZoom()), map.getMaxZoom()));

      const container = map.getContainer();
      const viewport = { width: container.clientWidth, height: container.clientHeight };
      const sheet = sheetOnScreen({
        center: { lng: centre.lng, lat: centre.lat },
        zoom: map.getZoom(),
        ...viewport,
      });
      const covered = sheetCoversView(sheet, viewport);
      if (coveredWas.current !== undefined && coveredWas.current !== covered) {
        note(
          'camera',
          covered
            ? 'the sheet covers the view again'
            : `the sheet no longer covers the view: ${Math.round(sheet.size)} px on ${viewport.width} by ${viewport.height}`,
        );
      }
      coveredWas.current = covered;

      // Every change of tile zoom is worth knowing, not just the ones that change the stretch: a step
      // between two zooms is the sort of thing that is felt and hard to name, and below the depth the
      // terrain was cut at the stretch never moves, so watching only the stretch says nothing about z3
      // to z4. But a run of them is one movement, so it is said once, when the camera has settled.
      if (tileZoomWas.current !== undefined && tileZoomWas.current !== tileZoom) {
        cameFrom.current ??= tileZoomWas.current;
        if (settling.current !== null) {
          clearTimeout(settling.current);
        }
        settling.current = setTimeout(() => {
          settling.current = null;
          const from = cameFrom.current;
          cameFrom.current = undefined;
          const said =
            from === undefined
              ? null
              : describeTerrainStep(from, {
                  tileZoom,
                  flatMaxZoom: FLAT_MAX_ZOOM,
                  masterWidth: WORLD_MASTER_WIDTH,
                  tileSize: TILE,
                });
          if (said !== null) {
            note('terrain', said);
          }
        }, SETTLE_MS);
      }
      tileZoomWas.current = tileZoom;
    };
    look();
    const often = setInterval(look, 400);
    map.on('move', look);
    map.on('idle', look);
    return () => {
      clearInterval(often);
      if (settling.current !== null) {
        clearTimeout(settling.current);
        settling.current = null;
      }
      map.off('move', look);
      map.off('idle', look);
    };
  }, [map]);

  const asText = useCallback(
    () => notes.map((entry) => `${atToClock(entry.at)} ${entry.area}: ${entry.message}`).join('\n'),
    [notes],
  );

  const copy = () => {
    // A browser may refuse the clipboard. Saying so is better than a button that looks like it worked;
    // the log is plain text on the page, so it can always be selected by hand instead.
    try {
      void navigator.clipboard.writeText(asText()).then(
        () => setCopied('yes'),
        () => setCopied('failed'),
      );
    } catch {
      setCopied('failed');
    }
  };

  if (!open) {
    return (
      <button type="button" className="debug debug--shut" onClick={() => setOpen(true)}>
        Debug
      </button>
    );
  }

  return (
    <section className="debug">
      <header className="debug__bar">
        <span className="debug__title">Debug</span>
        <button type="button" className="debug__button" onClick={copy}>
          {copied === 'yes' ? 'copied' : copied === 'failed' ? 'select it' : 'copy'}
        </button>
        <button
          type="button"
          className="debug__button"
          onClick={() => {
            forgetPaintedTally();
            setCopied('no');
          }}
        >
          reset
        </button>
        {/* No confirmation: the log line is the record, and this panel is not a player's. See 0023. */}
        <button
          type="button"
          className="debug__button"
          onClick={restart}
          title="forget this player and arrive as a new one"
        >
          restart
        </button>
        <button
          type="button"
          className="debug__button"
          onClick={wipeWorld}
          title="empty the world for everyone connected to it"
        >
          wipe
        </button>
        <button type="button" className="debug__button" onClick={() => setOpen(false)}>
          hide
        </button>
      </header>

      <AreasView map={map} worldRoot={worldRoot} />

      <EventsView map={map} />

      <ol className="debug__log">
        {notes.length === 0 && <li className="debug__quiet">nothing logged yet</li>}
        {[...notes].reverse().map((entry, index) => (
          <li key={`${entry.at}-${index}`}>
            <span className="debug__when">{atToClock(entry.at)}</span>
            <span className="debug__area">{entry.area}</span>
            {entry.message}
          </li>
        ))}
      </ol>
    </section>
  );
}
