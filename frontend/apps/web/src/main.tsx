import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { note } from './debug/log';
import { chosenMaster, worldRootOf } from './map/masters';
import { registerPainterlyTiles } from './map/painterlyTiles';

import './styles.css';

/**
 * Which master is drawn, decided here and nowhere else.
 *
 * The map style, the outlines and every painter are all given this one value, so they cannot disagree
 * about which world is on the screen. Changing it is a reload, which is what the terrain dropdown does.
 */
const master = chosenMaster();

// Before any map exists, because a style may ask for a painted tile as soon as one does.
registerPainterlyTiles(worldRootOf(master));
note('world', `drawing the master called ${master}`);
note(
  'start',
  `${navigator.hardwareConcurrency ?? '?'} cores reported, so painting is spread over half of them`,
);

const container = document.getElementById('root');
if (container === null) {
  throw new Error('the page is missing its root element');
}

createRoot(container).render(
  <StrictMode>
    <App master={master} />
  </StrictMode>,
);
