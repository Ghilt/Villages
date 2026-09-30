import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { EventLog } from './admin/EventLog';
import { App } from './App';
import { note } from './debug/log';
import { chosenMaster, worldRootOf } from './map/masters';
import { registerPainterlyTiles } from './map/painterlyTiles';

import './styles.css';

/** A page that is not the game: every event the world stores, for reading. */
const INSPECT_EVENTS = '/admin/inspect-events';

/** The other: the component library, shown. See docs/UI-COMPONENTS.md. */
const INSPECT_UI_COMPONENTS = '/admin/inspect-ui-components';

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

/**
 * Which page this is, by its address. A check rather than a router: there are three pages, one of them
 * is the game, and a router would be a dependency to hold two `if`s.
 */
if (window.location.pathname.startsWith(INSPECT_EVENTS)) {
  document.title = 'Villages: events';
  root.render(
    <StrictMode>
      <EventLog />
    </StrictMode>,
  );
} else if (window.location.pathname.startsWith(INSPECT_UI_COMPONENTS)) {
  document.title = 'Villages: components';
  // Fetched only here, so neither the library nor its fonts and pictures are part of the game's bundle.
  void import('./admin/UiComponents').then(({ UiComponents }) =>
    root.render(
      <StrictMode>
        <UiComponents />
      </StrictMode>,
    ),
  );
} else {
  const master = chosenMaster();

  // Before any map exists, because a style may ask for a painted tile as soon as one does.
  registerPainterlyTiles(worldRootOf(master));
  note('world', `drawing the master called ${master}`);
  note(
    'start',
    `${navigator.hardwareConcurrency ?? '?'} cores reported, so painting is spread over half of them`,
  );

  root.render(
    <StrictMode>
      <App master={master} />
    </StrictMode>,
  );
}
