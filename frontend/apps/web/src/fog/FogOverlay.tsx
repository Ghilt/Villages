import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { gatewayState, watchGateway } from '../net/gateway';
import { cameraOf } from '../sprites/mapCamera';

import { circleOf } from './circles';
import { fieldOf } from './fogField';
import { fogIsOn, watchFog } from './fogOfWar';
import { createFogRenderer } from './fogRenderer';

const sightNow = () => gatewayState().yourSight;
const todayNow = () => gatewayState().world?.today ?? null;

/**
 * The fog of war over the map and everything standing on it, drawn from the vision points the server says
 * the player's house has had. Holds the renderer for as long as the map lives, as the sprite overlay does.
 *
 * Nothing is drawn until the gateway has said what the house sees, so a page that is still connecting is
 * not a world under haze for a moment; and nothing is drawn with the switch off. A house that sees nothing,
 * which is a player who has not founded one, is a world that is all unknown. See decision record 0061.
 */
export function FogOverlay({ map }: { map: maplibregl.Map }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ReturnType<typeof createFogRenderer> | null>(null);
  const sight = useSyncExternalStore(watchGateway, sightNow);
  const today = useSyncExternalStore(watchGateway, todayNow);
  const on = useSyncExternalStore(watchFog, fogIsOn);

  // Once for each change to what the house has seen from, never while the camera moves.
  const field = useMemo(
    () => (sight === null ? null : fieldOf(sight.map((point) => circleOf(point, today)))),
    [sight, today],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const renderer = createFogRenderer(cameraOf(map));
    rendererRef.current = renderer;
    renderer.mount(container);
    return () => {
      rendererRef.current = null;
      renderer.destroy();
    };
  }, [map]);

  // Also on the map, because a renderer made for a new map starts out drawing nothing.
  useEffect(() => {
    rendererRef.current?.show(on && sight !== null ? { field } : null);
  }, [on, sight, field, map]);

  return <div className="fog" ref={containerRef} data-testid="fog" />;
}
