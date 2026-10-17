import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';

import * as camera from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import { note } from '../../log/log';
import { useStore } from '../../store/useStore';

import { armSpawn, askSpawn, critterSpawnStore } from './critterSpawn';
import { CRITTERS_LOOK } from './look';

/**
 * While the Critters part has a kind armed, a click on the map puts one there (`critterSpawn.ts`) and is that click's
 * whole meaning: no window opens for the water or the area under it. The cursor is a cross while armed, and escape
 * stops. Mounted before the area overlay and the water's clicks, which leave a click another has marked handled.
 */
export function CritterClicks({ map }: { map: maplibregl.Map | null }) {
  const armed = useStore(critterSpawnStore, (state) => state.armed);

  useEffect(() => {
    if (map === null) return;
    const onClick = (event: maplibregl.MapMouseEvent) => {
      if (critterSpawnStore.get().armed === null) return;
      event.preventDefault();
      if (map.getZoom() < CRITTERS_LOOK.fromZoom) {
        note('critters', `critters come only from zoom ${CRITTERS_LOOK.fromZoom} in`);
        return;
      }
      const at = camera.toMercatorExact(event.lngLat);
      askSpawn(at.x * WORLD_MASTER_WIDTH, at.y * WORLD_MASTER_WIDTH);
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  useEffect(() => {
    if (map === null || armed === null) return;
    const canvas = map.getCanvasContainer();
    const was = canvas.style.cursor;
    canvas.style.cursor = 'crosshair';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') armSpawn(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      canvas.style.cursor = was;
      window.removeEventListener('keydown', onKey);
    };
  }, [map, armed]);

  return null;
}
