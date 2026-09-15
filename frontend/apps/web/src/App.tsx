import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { housesInView } from '@villages/client-core';
import type { ChoiceView, HouseView } from '@villages/protocol';

import { AreaOverlay } from './areas/AreaOverlay';
import { Parchment } from './choice/Parchment';
import { DebugPanel } from './debug/DebugPanel';
import { Desk } from './desk/Desk';
import { WorktreeTabs } from './debug/WorktreeTabs';
import { note } from './debug/log';
import { select } from './select/selection';
import { gateway, gatewayState, watchGateway } from './net/gateway';
import { followMap } from './net/followMap';
import { HudShell } from './hud/HudShell';
import { InfluenceOverlay } from './influence/InfluenceOverlay';
import { Inspector } from './inspect/Inspector';
import { StoodDown } from './hud/StoodDown';
import { MapView } from './map/MapView';
import { DebugMapPanel } from './map/DebugMapPanel';
import { worldRootOf } from './map/masters';
import { DEFAULT_RENDERER, RENDERERS, applyRenderer } from './map/renderers';
import { SpriteOverlay } from './sprites/SpriteOverlay';
import type { MapSprite } from './sprites/SpriteRenderer';
import { tinctureColour } from './sprites/tinctures';

/** A house as the renderer draws it: a mark at its seat, in its field's tincture. */
function toSprite(house: HouseView): MapSprite {
  return {
    id: house.id,
    at: { lng: house.seat.lon, lat: house.seat.lat },
    tint: tinctureColour(house.banner.field),
    kind: 'house',
  };
}

/** The gold of the interface, so a place being offered reads as the world asking rather than as a house. */
const OFFERED = 0x9d7c2a;

/**
 * The seats a pending choice is offering, as marks on the map.
 *
 * They are there so that the three places can be looked at before one is taken: set the parchment aside,
 * pull back, and see where the world is proposing to put you.
 */
function candidatesOf(choice: ChoiceView | null): MapSprite[] {
  if (choice === null) {
    return [];
  }
  return choice.options.flatMap((option) =>
    option.effect.kind === 'foundAt'
      ? [
          {
            id: `offered:${option.id}`,
            at: { lng: option.effect.seat.lon, lat: option.effect.seat.lat },
            tint: OFFERED,
            kind: 'candidate' as const,
          },
        ]
      : [],
  );
}

/**
 * How close the camera comes when the house is founded.
 *
 * Not a matter of taste: a new house has the founding significance, and `coarsestZoom` makes that zoom 8,
 * so a flight that stopped at 7 would land on a seat with nothing standing on it. Past 8 the sprite is
 * drawn as a marker rather than a dot, which is what arriving at your own house should look like.
 */
const FOUNDING_ZOOM = 8.5;

interface AppProps {
  /** Which hand-painted master this page load is drawing. Decided once, in main.tsx. */
  master: string;
}

export function App({ master }: AppProps) {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [renderer, setRenderer] = useState(DEFAULT_RENDERER);
  const heard = useSyncExternalStore(watchGateway, gatewayState);
  const inView = useMemo(() => housesInView(heard.houses), [heard.houses]);
  const sprites = useMemo(
    () => [...inView.map(toSprite), ...candidatesOf(heard.yourChoice)],
    [inView, heard.yourChoice],
  );

  // The one connection to the gateway, opened as the app mounts.
  useEffect(() => {
    gateway();
  }, []);

  // The gateway follows the camera: the cells covering the view, at the view's own zoom.
  useEffect(() => (map === null ? undefined : followMap(map)), [map]);

  // When the house comes to be, the camera goes to it. It is the one moment in the whole world so far
  // that is worth being taken to, and the seat was chosen from a parchment rather than from the map.
  const seat = heard.yourHouse?.seat;
  const mine = heard.yourHouse?.id;
  useEffect(() => {
    if (map !== null && seat !== undefined && mine !== undefined) {
      note('camera', `flying to the seat at ${seat.lat.toFixed(3)}, ${seat.lon.toFixed(3)}`);
      map.flyTo({ center: [seat.lon, seat.lat], zoom: Math.max(map.getZoom(), FOUNDING_ZOOM) });
      // Arriving at your own house with it already selected: the inspector is what the flight is for.
      select({ kind: 'house', id: mine });
    }
  }, [map, seat, mine]);

  useEffect(() => {
    if (map !== null) {
      applyRenderer(map, renderer);
      const chosen = RENDERERS.find((candidate) => candidate.name === renderer);
      note('renderer', `${renderer}${chosen === undefined ? '' : `, ${chosen.note.toLowerCase()}`}`);
    }
  }, [map, renderer]);

  const worldRoot = worldRootOf(master);

  return (
    <main className="app">
      <Desk map={map} />
      <MapView worldRoot={worldRoot} onReady={setMap} />
      {import.meta.env.DEV && <WorktreeTabs />}
      {map !== null && <SpriteOverlay map={map} sprites={sprites} />}
      <AreaOverlay map={map} worldRoot={worldRoot} />
      <InfluenceOverlay map={map} houses={inView} />
      <HudShell />
      <Inspector />
      <Parchment />
      <StoodDown />
      <div className="rail">
        <DebugMapPanel master={master} renderer={renderer} onRenderer={setRenderer} />
        <DebugPanel map={map} renderer={renderer} worldRoot={worldRoot} />
      </div>
    </main>
  );
}
