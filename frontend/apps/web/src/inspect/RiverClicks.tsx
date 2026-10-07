import { useEffect, useRef } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { areasStore } from '../areas/areas';
import { inspectAt, sessionStore } from '../net/gateway';
import { useStore } from '../store/useStore';
import { heardRiver } from './rivers';
import type { Subject } from './subjects';

/**
 * A click on a river opens an **inspect window** on it.
 *
 * A click that no house, person or area took - the sprite overlay and the area overlay mark theirs handled - asks
 * the server what river is there, and the answer opens a window when it names one. The server names it from the
 * master's ground map and its real names, only on ground the house has revealed, and the page's own copy of the
 * names is never what a player reads (0087). Asked only zoomed in this far, because further out a click covers
 * more ground than one river. A click on no river opens nothing, as a click on empty ground closes nothing.
 */
const RIVERS_FROM_ZOOM = 6;

interface RiverClicksProps {
  map: maplibregl.Map | null;
  onPick: (subject: Subject) => void;
}

export function RiverClicks({ map, onPick }: RiverClicksProps) {
  const pick = useRef(onPick);
  pick.current = onPick;
  /** The place last asked about: an answer for any other is a click the player has since moved on from. */
  const asked = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (map === null) {
      return;
    }
    const onClick = (event: maplibregl.MapMouseEvent) => {
      // Once every overlay has had the click: the one that took it marks it handled while the map is firing it.
      queueMicrotask(() => {
        if (event.defaultPrevented || areasStore.get().armed || map.getZoom() < RIVERS_FROM_ZOOM) {
          return;
        }
        const { lng, lat } = event.lngLat.wrap();
        asked.current = { lat, lon: lng };
        inspectAt(asked.current);
      });
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  const answer = useStore(sessionStore, (state) => state.inspected);
  useEffect(() => {
    const was = asked.current;
    if (answer === null || was === null || answer.at.lat !== was.lat || answer.at.lon !== was.lon) {
      return;
    }
    asked.current = null;
    const seen = heardRiver(answer);
    if (seen !== null) {
      pick.current({ kind: 'river', id: seen.id });
    }
  }, [answer]);

  return null;
}
