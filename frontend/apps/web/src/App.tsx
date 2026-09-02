import { useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { HudShell } from './hud/HudShell';
import { MapView } from './map/MapView';
import { DEMO_SEATS } from './sprites/demoSeats';
import { SpriteOverlay } from './sprites/SpriteOverlay';

export function App() {
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  return (
    <main className="app">
      <MapView onReady={setMap} />
      {map !== null && <SpriteOverlay map={map} sprites={DEMO_SEATS} />}
      <HudShell />
    </main>
  );
}
