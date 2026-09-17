import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { FLAT_MAX_ZOOM, TILE } from '../map/painterlyMessages';
import { forgetPaintedTally } from '../map/painterlyTiles';
import { sheetCoversView, sheetOnScreen } from '../map/sheet';
import { WORLD_MASTER_WIDTH } from '../map/worldStyle';
import { AreasView } from '../areas/AreasView';
import { atToClock, note, notesNow, watchNotes } from './log';
import { restart, wipeWorld } from '../net/gateway';
import { EventsView } from './EventsView';

interface DebugPanelProps {
  map: maplibregl.Map | null;
  /** Where this page's tiles live, which is what an area is counted against. */
  worldRoot: string;
}

const OPEN_KEY = 'villages.debug.open';

/**
 * What the program thinks is happening, on the screen rather than in a console.
 *
 * It is the log and the buttons. The block of state that used to sit above them - the zoom, the sheet,
 * the cell names, the counts - went on 2026-09-16, because it was not what Adam read: what a thing does
 * is said as it happens, in a line of the log, and what he wants to change is a button. The copy button
 * puts the log on the clipboard so it can be pasted into a conversation.
 *
 * The camera still says the two things about itself that are worth knowing - that the sheet stopped
 * covering the view, and that the terrain changed zoom - but it says them to the log when they happen
 * rather than to a row that is always there. See decision record 0023.
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

      // Every change of tile zoom is logged, not just the ones that change the stretch. A step between
      // two zooms is the sort of thing that is felt and hard to name, and below the depth the terrain
      // was cut at the stretch never moves, so watching only the stretch says nothing about z3 to z4.
      const stretch = 2 ** Math.max(0, tileZoom - FLAT_MAX_ZOOM);
      if (tileZoomWas.current !== undefined && tileZoomWas.current !== tileZoom) {
        const ground = WORLD_MASTER_WIDTH / (TILE * 2 ** tileZoom);
        note(
          'terrain',
          `z${tileZoomWas.current} to z${tileZoom}: ${ground.toFixed(2)} master px a pixel` +
            (stretch === 1 ? ', as cut' : `, z${FLAT_MAX_ZOOM} stretched ${stretch}x`),
        );
      }
      tileZoomWas.current = tileZoom;
    };
    look();
    const often = setInterval(look, 400);
    map.on('move', look);
    map.on('idle', look);
    return () => {
      clearInterval(often);
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
