import { useCallback, useEffect, useRef, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { FLAT_MAX_ZOOM, TILE } from '../geometry/world';
import { forgetPaintedTally } from '../map/painterlyTiles';
import { flatWindow, sheetCoversView, sheetOnScreen } from '../map/sheet';
import { WORLD_MASTER_WIDTH } from '../geometry/world';
import { AccountsSection } from './AccountsSection';
import { AreasSection } from './AreasSection';
import { BuildBadge } from '../version/BuildBadge';
import { CameraSection } from './CameraSection';
import { CharactersSection } from './CharactersSection';
import { ChoiceRollSection } from './ChoiceRollSection';
import { DialoguesSection } from './DialoguesSection';
import { QuestsSection } from './QuestsSection';
import { MapSection } from './MapSection';
import { ScenerySection } from './ScenerySection';
import { ShadersSection } from './ShadersSection';
import { WorktreesSection } from './WorktreesSection';
import { logStore, atToClock, note } from '../log/log';
import { stageStore, setLogOpen, setPanelShut, toggleShape } from './stage';
import { PANEL_WANTS } from '../stage/stageBox';
import { describeTerrainStep } from './terrainDepth';
import { ResourcesSection } from './ResourcesSection';
import { StructuresSection } from './StructuresSection';
import { WorldSection } from './WorldSection';
import { useStore } from '../store/useStore';

interface DebugPanelProps {
  map: maplibregl.Map | null;
  /** Where this page's tiles live, which is what an area is counted against. */
  worldRoot: string;
  /** Which hand-painted master is drawn, and what draws it: the map controls live in here now. */
  master: string;
  renderer: string;
  onRenderer: (renderer: string) => void;
}

/**
 * How long the camera has to settle before the terrain says where it ended up.
 *
 * A `flyTo` crosses half a dozen tile zooms on its way and a pinch crosses several, and a line for each
 * step was six lines about one movement. The run is said once, by where it started and where it
 * stopped. The same quarter second everything else in the program gathers over.
 */
const SETTLE_MS = 250;

/**
 * Everything that helps while the game is being built, in one space down the right-hand side.
 *
 * It is not a card floating over the world: it takes room from the stage, so making it wider makes the
 * play area smaller exactly as a smaller screen would, and the toggle in its top corner confines the
 * stage to a phone. That is the instrument for the rule in `docs/RESPONSIVE-DESIGN.md` - a component
 * that only works at 1600 pixels wide is not finished - and there was no way to see it before.
 *
 * It is the log and the buttons. The block of state that used to sit above them - the zoom, the sheet,
 * the cell names, the counts - went on 2026-09-16, because it was not what Adam read: what a thing does
 * is said as it happens, in a line of the log, and what he wants to change is a button. The copy button
 * puts the log on the clipboard so it can be pasted into a conversation.
 *
 * The buttons are one column and the log is a second beside it, the whole height of the panel, so that
 * what a button did is in view while the button is: as the last section it was scrolled away from by
 * every section above it. It folds away to the `log` toggle in the header, and gives its room back to
 * the stage when it does.
 *
 * The camera still says the two things about itself that are worth knowing - that the sheet stopped
 * covering the view, and where the terrain came from and went - but it says them to the log when they
 * happen rather than to a row that is always there, and a run of zoom steps is one line rather than
 * six. See decision records 0023 and 0039.
 */
export function DebugPanel({ map, worldRoot, master, renderer, onRenderer }: DebugPanelProps) {
  const notes = useStore(logStore, (state) => state.notes);
  const shut = useStore(stageStore, (state) => state.shut);
  const mode = useStore(stageStore, (state) => state.mode);
  const logOpen = useStore(stageStore, (state) => state.log);
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const tileZoomWas = useRef<number | undefined>(undefined);
  /** Where a run of zoom steps began, and the timer that will say it once the camera stops moving. */
  const cameFrom = useRef<number | undefined>(undefined);
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coveredWas = useRef<boolean | undefined>(undefined);

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
      const viewport = flatWindow(
        { width: container.clientWidth, height: container.clientHeight },
        map.getPitch(),
      );
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
            : `the sheet no longer covers the view: ${Math.round(sheet.size)} px on ${container.clientWidth} by ${container.clientHeight}`,
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

  // Minimised, it is a badge over the corner of the stage and nothing else. The stage keeps whatever
  // size it had, so a phone-shaped stage with this alone over it is the interface undisturbed.
  if (shut) {
    return (
      <button
        type="button"
        className="debug__badge"
        onClick={() => setPanelShut(false)}
        title="the debug panel"
        aria-label="Show the debug panel"
      >
        debug
      </button>
    );
  }

  return (
    <section
      className={`debug${logOpen ? ' debug--log' : ''}`}
      style={{ '--controls': `${PANEL_WANTS}px` } as React.CSSProperties}
    >
      <div className="debug__controls">
        <header className="debug__bar">
          <span className="debug__title">Debug</span>
          <button
            type="button"
            className="debug__button"
            onClick={() => setPanelShut(true)}
            title="minimise to a badge"
          >
            hide
          </button>
          {/*
          The very top right, because that is where Adam asked for it. Two shapes and not one: a phone
          upright and the same phone in landscape, which is the only way to see the stage cut into a left and a
          right rather than a top and a bottom - and the only shape short enough to find out whether a pane
          can live in 390 pixels of height.
        */}
          <button
            type="button"
            className={`debug__button${mode === 'phone' ? ' debug__button--on' : ''}`}
            onClick={() => toggleShape('phone')}
            aria-pressed={mode === 'phone'}
            title="confine the stage to a phone, and back"
          >
            phone
          </button>
          <button
            type="button"
            className={`debug__button${mode === 'landscape' ? ' debug__button--on' : ''}`}
            onClick={() => toggleShape('landscape')}
            aria-pressed={mode === 'landscape'}
            title="confine the stage to a phone in landscape, and back"
          >
            landscape
          </button>
          <button
            type="button"
            className={`debug__button${logOpen ? ' debug__button--on' : ''}`}
            onClick={() => setLogOpen(!logOpen)}
            aria-pressed={logOpen}
            title={logOpen ? 'fold the log away' : 'open the log beside the controls'}
          >
            log
          </button>
        </header>

        {/*
        The sections scroll and the bar above them does not, so the way out is reachable however many
        there are. The panel is expected to gain sections rather than stay this size.
      */}
        <div className="debug__sections">
          {import.meta.env.DEV && <WorktreesSection />}

          <MapSection map={map} master={master} renderer={renderer} onRenderer={onRenderer} />

          <ShadersSection />

          <ScenerySection />

          <CameraSection map={map} />

          <AreasSection map={map} worldRoot={worldRoot} />

          <WorldSection map={map} />
          <AccountsSection />
          <ResourcesSection />
          <StructuresSection map={map} />
          <CharactersSection map={map} />
          <DialoguesSection />
          <QuestsSection />
          <ChoiceRollSection />

          <footer className="debug__foot">
            {/* The admin pages of this tree, at its own address, so it opens the admin of the build in view. */}
            <a className="debug__adminlink" href="/admin" target="_blank" rel="noreferrer">
              admin
            </a>
            <BuildBadge />
          </footer>
        </div>
      </div>

      {/*
        On the outside, at the window's edge, so folding it away takes a column off the far side and the
        controls stay where the hand already is. Its bar lines up with the header's, and nothing in it
        scrolls but the lines.
      */}
      {logOpen && (
        <section className="debug__logcolumn" aria-label="Log">
          <header className="debug__bar">
            <span className="debug__title">Log</span>
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
            <button
              type="button"
              className="debug__button"
              onClick={() => setLogOpen(false)}
              title="fold the log away; the log button in the header brings it back"
            >
              hide
            </button>
          </header>
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
      )}
    </section>
  );
}
