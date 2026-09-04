import { useEffect, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { DebugPanel } from './debug/DebugPanel';
import { note } from './debug/log';
import { HudShell } from './hud/HudShell';
import { MapView } from './map/MapView';
import { RendererPicker } from './map/RendererPicker';
import { DEFAULT_RENDERER, RENDERERS, applyRenderer } from './map/renderers';
import { DEMO_SEATS } from './sprites/demoSeats';
import { SpriteOverlay } from './sprites/SpriteOverlay';

export function App() {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [renderer, setRenderer] = useState(DEFAULT_RENDERER);

  useEffect(() => {
    if (map !== null) {
      applyRenderer(map, renderer);
      const chosen = RENDERERS.find((candidate) => candidate.name === renderer);
      note('renderer', `${renderer}${chosen === undefined ? '' : `, ${chosen.note.toLowerCase()}`}`);
    }
  }, [map, renderer]);

  return (
    <main className="app">
      <MapView onReady={setMap} />
      {map !== null && <SpriteOverlay map={map} sprites={DEMO_SEATS} />}
      <HudShell />
      <RendererPicker value={renderer} onChange={setRenderer} />
      <DebugPanel map={map} renderer={renderer} />
    </main>
  );
}
