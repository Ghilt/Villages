import { useEffect, useRef } from 'react';
import type * as maplibregl from 'maplibre-gl';

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

  return <div className="sprites" ref={containerRef} data-testid="sprites" />;
}
