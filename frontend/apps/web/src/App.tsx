import { useEffect, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { DebugPanel } from './debug/DebugPanel';
import { note } from './debug/log';
import { gateway } from './net/gateway';
import { HudShell } from './hud/HudShell';
import { MapView } from './map/MapView';
import { DebugMapPanel } from './map/DebugMapPanel';
import { worldRootOf } from './map/masters';
import { DEFAULT_RENDERER, RENDERERS, applyRenderer } from './map/renderers';
import { DEMO_SEATS } from './sprites/demoSeats';
import { SpriteOverlay } from './sprites/SpriteOverlay';

interface AppProps {
  /** Which hand-painted master this page load is drawing. Decided once, in main.tsx. */
  master: string;
}

export function App({ master }: AppProps) {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [renderer, setRenderer] = useState(DEFAULT_RENDERER);

  // The one connection to the gateway, opened as the app mounts.
  useEffect(() => {
    gateway();
  }, []);

  useEffect(() => {
    if (map !== null) {
      applyRenderer(map, renderer);
      const chosen = RENDERERS.find((candidate) => candidate.name === renderer);
      note('renderer', `${renderer}${chosen === undefined ? '' : `, ${chosen.note.toLowerCase()}`}`);
    }
  }, [map, renderer]);

  return (
    <main className="app">
      <MapView worldRoot={worldRootOf(master)} onReady={setMap} />
      {map !== null && <SpriteOverlay map={map} sprites={DEMO_SEATS} />}
      <HudShell />
      <div className="rail">
        <DebugMapPanel master={master} renderer={renderer} onRenderer={setRenderer} />
        <DebugPanel map={map} renderer={renderer} />
      </div>
    </main>
  );
}
