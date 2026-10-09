import { useEffect, useMemo, useRef } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { circleOf } from '../fog/circles';
import { fieldOf } from '../fog/fogField';
import { note } from '../log/log';
import { sessionStore } from '../net/gateway';
import { useStore } from '../store/useStore';
import { pickedOf } from './waterPicked';
import { addRipple, removeRipple, rippleAlong } from './waterRipple';
import { watersStore } from './waters';

/**
 * A click that names water sends a crackle of gold out along it from where it landed: a river along its whole course,
 * a lake within its shores, the sea about the click, stepped along the master's own pixels rather than the diamonds
 * the ground is drawn on. A flourish, read from the page's own tiles along where the server says the water runs, and
 * only on ground the house has revealed unless Adam's switch has lifted the fog. See `waterRipple.ts`.
 */

interface RippleAlongWaterProps {
  map: maplibregl.Map | null;
  /** Where this page's tiles live, as the root of a URL. */
  worldRoot: string;
}

export function RippleAlongWater({ map, worldRoot }: RippleAlongWaterProps) {
  const clicked = useStore(watersStore, (state) => state.clicked);
  const sight = useStore(sessionStore, (state) => state.yourSight);
  const today = useStore(sessionStore, (state) => state.world?.today ?? null);
  const fogOn = useStore(sessionStore, (state) => state.fogOfWar);

  // What the house has revealed, as the fog is drawn from it; undefined with the fog lifted, where all may show.
  const tension = sight?.tension ?? 0;
  const field = useMemo(
    () =>
      fogOn
        ? fieldOf(
            (sight?.points ?? []).map((point) => circleOf(point, today, tension)),
            tension,
          )
        : undefined,
    [fogOn, sight, today, tension],
  );

  // What a ripple reads the ground by, as it is when the click comes, without a new one starting each time it changes.
  const ground = useRef({ worldRoot, field });
  ground.current = { worldRoot, field };

  // The ripple's source and layers, added once, as the areas' are.
  useEffect(() => {
    if (map === null) {
      return;
    }
    addRipple(map);
    return () => removeRipple(map);
  }, [map]);

  // Each click that names water sends a ripple out along what it picked; the next click stops the last.
  useEffect(() => {
    if (map === null || clicked === null) {
      return;
    }
    const { worldRoot: root, field: revealed } = ground.current;
    let stop: (() => void) | null = null;
    let wanted = true;
    pickedOf(clicked.seen, map.getZoom(), root, revealed).then(
      (what) => {
        if (wanted) stop = rippleAlong(map, clicked.seen, what);
      },
      (cause: unknown) => {
        note(
          'inspect',
          `no ripple along the water: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      },
    );
    return () => {
      wanted = false;
      stop?.();
    };
  }, [map, clicked]);

  return null;
}
