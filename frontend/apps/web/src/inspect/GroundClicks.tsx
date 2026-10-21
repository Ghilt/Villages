import { useEffect, useRef } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { areasStore } from '../areas/areas';
import { toMercatorExact } from '../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../geometry/world';
import { inspectAt, sessionStore } from '../net/gateway';
import { settlementOnItsSquare } from '../sprites/settlements/settlementsHeld';
import { useSettlementsHeld } from '../sprites/settlements/useSettlementsHeld';
import { BECOMES_A_MARK_AT } from '../sprites/twoForms';
import { useStore } from '../store/useStore';
import type { Subject } from './subjects';
import { heardWater } from './waters';

/**
 * A click on the ground opens an **inspect window** on what is there: a settlement's square, or water - a river, a
 * lake, the sea.
 *
 * A click on a settlement's square of ground opens its window, from zoom 7.5 in, where it is drawn; the page holds the
 * settlement, so nothing is asked. Any other click that no house, person or area took - the sprite overlay and the area overlay mark theirs handled - asks
 * the server what water is there, and the answer opens a window when it names some. The server names it from the
 * master's ground map and its real names, only on ground the house has revealed, and the page's own copy of the
 * names is never what a player reads (0087). Asked only zoomed in this far, because further out a click covers
 * more ground than one river. A click on dry ground opens nothing, as a click on empty ground closes nothing; one
 * that names water sends a gold ripple out along it: see `RippleAlongWater`.
 */
const WATERS_FROM_ZOOM = 6;

interface GroundClicksProps {
  map: maplibregl.Map | null;
  /** Where this page's world is served, whose settlements map names what the page holds. */
  worldRoot: string;
  onPick: (subject: Subject) => void;
}

export function GroundClicks({ map, worldRoot, onPick }: GroundClicksProps) {
  const pick = useRef(onPick);
  pick.current = onPick;
  const held = useSettlementsHeld(worldRoot);
  const settlements = useRef(held);
  settlements.current = held;
  /** The place last asked about: an answer for any other is a click the player has since moved on from. */
  const asked = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (map === null) {
      return;
    }
    const onClick = (event: maplibregl.MapMouseEvent) => {
      // Once every overlay has had the click: the one that took it marks it handled while the map is firing it.
      queueMicrotask(() => {
        if (event.defaultPrevented || areasStore.get().armed) {
          return;
        }
        const { lng, lat } = event.lngLat.wrap();
        if (map.getZoom() >= BECOMES_A_MARK_AT) {
          const at = toMercatorExact({ lng, lat });
          const on = settlementOnItsSquare(
            settlements.current,
            at.x * WORLD_MASTER_WIDTH,
            at.y * WORLD_MASTER_WIDTH,
          );
          if (on !== null) {
            pick.current({ kind: 'settlement', id: String(on.index) });
            return;
          }
        }
        if (map.getZoom() < WATERS_FROM_ZOOM) {
          return;
        }
        asked.current = { lat, lon: lng };
        inspectAt(asked.current);
      });
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  const answer = useStore(sessionStore, (state) => state.inspectedAt);
  useEffect(() => {
    const was = asked.current;
    if (answer === null || was === null || answer.at.lat !== was.lat || answer.at.lon !== was.lon) {
      return;
    }
    asked.current = null;
    const seen = heardWater(answer);
    if (seen !== null) {
      pick.current({ kind: seen.water.kind, id: seen.id });
    }
  }, [answer]);

  return null;
}
