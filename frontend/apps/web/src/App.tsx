import { useEffect, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { HudShell } from './hud/HudShell';
import { MapView } from './map/MapView';
import { RendererPicker } from './map/RendererPicker';
import { DEFAULT_RENDERER, applyRenderer } from './map/renderers';
import { DEMO_SEATS } from './sprites/demoSeats';
import { SpriteOverlay } from './sprites/SpriteOverlay';

export function App() {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [renderer, setRenderer] = useState(DEFAULT_RENDERER);

  useEffect(() => {
    if (map !== null) {
      applyRenderer(map, renderer);
    }
  }, [map, renderer]);

  return (
    <main className="app">
      <MapView onReady={setMap} />
      {map !== null && <SpriteOverlay map={map} sprites={DEMO_SEATS} />}
      <HudShell />
      <RendererPicker value={renderer} onChange={setRenderer} />
    </main>
  );
}
