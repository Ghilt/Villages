import { useEffect, useRef, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { select, selectionNow, watchSelection } from '../select/selection';
import { cameraOf } from './mapCamera';
import { createPixiSpriteRenderer } from './PixiSpriteRenderer';
import type { MapSprite } from './SpriteRenderer';

interface SpriteOverlayProps {
  map: maplibregl.Map;
  sprites: readonly MapSprite[];
}

/**
 * Holds the renderer for as long as the map lives, and hands it whatever should be on the map. The
 * renderer type is the only thing this file knows about Pixi, so swapping it is a one-line change here.
 */
export function SpriteOverlay({ map, sprites }: SpriteOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ReturnType<typeof createPixiSpriteRenderer> | null>(null);
  const selected = useSyncExternalStore(watchSelection, selectionNow);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const renderer = createPixiSpriteRenderer(cameraOf(map));
    rendererRef.current = renderer;
    void renderer.mount(container);

    return () => {
      rendererRef.current = null;
      renderer.destroy();
    };
  }, [map]);

  useEffect(() => {
    rendererRef.current?.setSprites(sprites);
  }, [sprites]);

  useEffect(() => {
    rendererRef.current?.setSelected(selected?.kind === 'house' ? selected.id : null);
  }, [selected, sprites]);

  /**
   * Picking a house. The canvas takes no pointer events, so the map hands the click over and the
   * renderer says what it drew there. A hit is marked handled, which is how the area overlay knows to
   * leave its own selection alone: two things on one click would be one thing too many.
   */
  useEffect(() => {
    const onClick = (event: maplibregl.MapMouseEvent) => {
      const hit = rendererRef.current?.hitTest(event.point) ?? null;
      if (hit !== null) {
        event.preventDefault();
        select({ kind: 'house', id: hit });
      } else if (selectionNow() !== null) {
        select(null);
      }
    };

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  return <div className="sprites" ref={containerRef} data-testid="sprites" />;
}
