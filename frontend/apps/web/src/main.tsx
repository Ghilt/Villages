import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { note } from './debug/log';
import { registerPainterlyTiles } from './map/painterlyTiles';

import './styles.css';

// Before any map exists, because a style may ask for a painted tile as soon as one does.
registerPainterlyTiles();
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
    <App />
  </StrictMode>,
);
