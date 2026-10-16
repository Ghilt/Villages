import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { inspectViewAt, isInspectIndex } from './admin/inspectViews';
import { App } from './App';
import type { DevTools } from './App';
import { note } from './log/log';
import { shareTheLog } from './log/shared';
import { chosenMaster, worldRootOf } from './map/masters';
import { registerPainterlyTiles } from './map/painterlyTiles';
import { observeGateway } from './net/gateway';
import { STAGE_PANES } from './panes';
import { sessionLog } from './sessionLog';
import { configureBays } from './stage/bays';

import './styles.css';

/**
 * Which master is drawn, decided here and nowhere else.
 *
 * The map style, the outlines and every painter are all given this one value, so they cannot disagree
 * about which world is on the screen. Changing it is a reload, which is what the terrain dropdown does.
 */
const container = document.getElementById('root');
if (container === null) {
  throw new Error('the page is missing its root element');
}

const root = createRoot(container);

/*
 * A page the browser brings back from its back/forward cache - the events log's map link followed, then *back* - is
 * the page exactly as it was left, but its connection to the game server was closed when it was left, and a closed
 * connection is never opened again. So it is loaded again, which is the one way it hears from the world again.
 * Adam's tab of 2026-10-11 sat *closed*, drawing nothing, until this.
 */
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

/**
 * Which page this is, by its address. A check rather than a router: the pages beside the game are listed in
 * `admin/inspectViews.ts`, each with how it is fetched, the index of them is `/admin`, and anything else is the
 * game. Every inspect page is fetched with `import()`, so none of them, nor what they carry, is part of the game's
 * bundle (0091).
 */
const inspecting = inspectViewAt(window.location.pathname);
if (isInspectIndex(window.location.pathname)) {
  document.title = 'Villages: inspect';
  void import('./admin/InspectIndex').then(({ InspectIndex }) =>
    root.render(
      <StrictMode>
        <InspectIndex />
      </StrictMode>,
    ),
  );
} else if (inspecting !== undefined) {
  document.title = `Villages: ${inspecting.title.toLowerCase()}`;
  void inspecting.load().then((Page) =>
    root.render(
      <StrictMode>
        <Page />
      </StrictMode>,
    ),
  );
} else {
  // The log is shared with the logs' inspect page, the panel's lines in a page of their own: a development build's
  // alone, as the panel is. A window closing, or loading again, says it has gone.
  if (import.meta.env.DEV) {
    window.addEventListener('pagehide', shareTheLog(window.location.pathname + window.location.search), {
      once: true,
    });
  }
  // The log listens to the conversation from before it begins.
  observeGateway(sessionLog);
  // The stage is told which panes the game puts on it, and the bays what they open on.
  configureBays(STAGE_PANES);
  const master = chosenMaster();

  // Before any map exists, because a style may ask for a painted tile as soon as one does.
  registerPainterlyTiles(worldRootOf(master));
  note('world', `drawing the master called ${master}`);
  note(
    'start',
    `${navigator.hardwareConcurrency ?? '?'} cores reported, so painting is spread over half of them`,
  );

  const play = (devTools: DevTools | null): void =>
    root.render(
      <StrictMode>
        <App master={master} devTools={devTools} />
      </StrictMode>,
    );
  // The debug panel is a development build's alone. A production build has `false` here, so the bundler leaves
  // the panel out whole - its code, its words and its stylesheet - and a player's page is the stage. See 0079.
  if (import.meta.env.DEV) {
    void import('./debug/devTools').then(play);
  } else {
    play(null);
  }
}
