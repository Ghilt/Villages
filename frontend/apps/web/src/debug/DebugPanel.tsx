import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { FLAT_MAX_ZOOM, TILE } from '../map/painterlyMessages';
import { forgetPaintedTally, paintedTally } from '../map/painterlyTiles';
import { WORLD_MASTER_WIDTH } from '../map/worldStyle';
import { atToClock, note, notesNow, watchNotes } from './log';
import { EventsView } from './EventsView';
import { describeState } from './report';
import type { Line } from './report';

interface DebugPanelProps {
  map: maplibregl.Map | null;
  renderer: string;
}

const OPEN_KEY = 'villages.debug.open';

/**
 * What the program thinks is happening, on the screen rather than in a console.
 *
 * It exists to be read out loud. When something looks wrong, the useful question is which zoom, which
 * renderer, and where the terrain is coming from, and none of those are guessable from a screenshot.
 * The copy button puts the state and the log on the clipboard so it can be pasted into a conversation.
 */
export function DebugPanel({ map, renderer }: DebugPanelProps) {
  const notes = useSyncExternalStore(watchNotes, notesNow);
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) !== 'no';
    } catch {
      return true;
    }
  });
  const [lines, setLines] = useState<Line[]>([]);
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  /** Recent frame gaps, so the worst one shown is the worst one lately and not the worst one ever. */
  const gaps = useRef<{ at: number; gap: number }[]>([]);
  const tileZoomWas = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? 'yes' : 'no');
    } catch {
      // A browser that will not remember the choice is not a reason to fail.
    }
  }, [open]);

  // The gap between animation frames is what lag is: how long the main thread could not respond. Only
  // the last few seconds are kept, because a number from page load says nothing about now.
  const RECENT_MS = 2500;
  useEffect(() => {
    let last = performance.now();
    let running = true;

    // Animation frames stop entirely while the page is hidden, so the first frame back would otherwise
    // be recorded as a stall of however long it was in the background. It reads as a catastrophe and it
    // means nothing, so the clock starts again instead.
    const restart = () => {
      if (document.visibilityState === 'visible') {
        last = performance.now();
      }
    };
    document.addEventListener('visibilitychange', restart);

    const tick = () => {
      const now = performance.now();
      gaps.current.push({ at: now, gap: now - last });
      while (gaps.current.length > 0 && now - gaps.current[0]!.at > RECENT_MS) {
        gaps.current.shift();
      }
      last = now;
      if (running) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
    return () => {
      running = false;
      document.removeEventListener('visibilitychange', restart);
    };
  }, []);

  useEffect(() => {
    if (map === null) {
      return;
    }
    const look = () => {
      const centre = map.getCenter();
      const tileZoom = Math.min(Math.round(map.getZoom()), map.getMaxZoom());

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

      setLines(
        describeState({
          renderer,
          zoom: map.getZoom(),
          tileZoom,
          flatMaxZoom: FLAT_MAX_ZOOM,
          masterWidth: WORLD_MASTER_WIDTH,
          tileSize: TILE,
          centre: { lng: centre.lng, lat: centre.lat },
          canvas: { width: map.getCanvas().width, height: map.getCanvas().height },
          pixelRatio: window.devicePixelRatio,
          painted: paintedTally(),
          worstFrameGap: gaps.current.reduce((worst, entry) => Math.max(worst, entry.gap), 0),
        }),
      );
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
  }, [map, renderer]);

  const asText = useCallback(
    () =>
      [
        ...lines.map((line) => `${line.label}: ${line.value}`),
        '',
        ...notes.map((entry) => `${atToClock(entry.at)} ${entry.area}: ${entry.message}`),
      ].join('\n'),
    [lines, notes],
  );

  const copy = () => {
    // A browser may refuse the clipboard. Saying so is better than a button that looks like it worked;
    // the panel is plain text on the page, so it can always be selected by hand instead.
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
            gaps.current = [];
            setCopied('no');
          }}
        >
          reset
        </button>
        <button type="button" className="debug__button" onClick={() => setOpen(false)}>
          hide
        </button>
      </header>

      <dl className="debug__state">
        {lines.map((line) => (
          <div key={line.label} className="debug__row">
            <dt>{line.label}</dt>
            <dd>{line.value}</dd>
          </div>
        ))}
      </dl>

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
