import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { housesInView } from '@villages/client-core';
import type { HouseView } from '@villages/protocol';

import { DebugPanel } from './debug/DebugPanel';
import { WorktreeTabs } from './debug/WorktreeTabs';
import { note } from './debug/log';
import { gateway, gatewayState, watchGateway } from './net/gateway';
import { followMap } from './net/followMap';
import { HudShell } from './hud/HudShell';
import { StoodDown } from './hud/StoodDown';
import { MapView } from './map/MapView';
import { DebugMapPanel } from './map/DebugMapPanel';
import { worldRootOf } from './map/masters';
import { DEFAULT_RENDERER, RENDERERS, applyRenderer } from './map/renderers';
import { SpriteOverlay } from './sprites/SpriteOverlay';
import type { MapSprite } from './sprites/SpriteRenderer';
import { tinctureColour } from './sprites/tinctures';
import { Timeline } from './timeline/Timeline';

/** A house as the renderer draws it: a mark at its seat, in its field's tincture. */
function toSprite(house: HouseView): MapSprite {
  return {
    id: house.id,
    at: { lng: house.seat.lon, lat: house.seat.lat },
    tint: tinctureColour(house.banner.field),
  };
}

interface AppProps {
  /** Which hand-painted master this page load is drawing. Decided once, in main.tsx. */
  master: string;
}

export function App({ master }: AppProps) {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [renderer, setRenderer] = useState(DEFAULT_RENDERER);
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const sprites = useMemo(() => housesInView(heard.houses).map(toSprite), [heard.houses]);

  // The one connection to the gateway, opened as the app mounts.
  useEffect(() => {
    gateway();
  }, []);

  // The gateway follows the camera: the cells covering the view, at the view's own zoom.
  useEffect(() => (map === null ? undefined : followMap(map)), [map]);

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
      {import.meta.env.DEV && <WorktreeTabs />}
      {map !== null && <SpriteOverlay map={map} sprites={sprites} />}
      <HudShell />
      <StoodDown />
      <Timeline />
      <div className="rail">
        <DebugMapPanel master={master} renderer={renderer} onRenderer={setRenderer} />
        <DebugPanel map={map} renderer={renderer} />
      </div>
    </main>
  );
}
