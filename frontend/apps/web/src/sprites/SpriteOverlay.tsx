import { useEffect, useRef, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { seeingEverything, watchSeeingEverything } from '../debug/seeEverything';
import { inspect } from '../inspect/opening';
import { subjectsNow, watchSubjects } from '../inspect/subjects';
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
  const top = useSyncExternalStore(watchSubjects, subjectsNow).open[0];
  const everything = useSyncExternalStore(watchSeeingEverything, seeingEverything);

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

  // Also on the sprites, because a renderer made after the switch was thrown starts with it off.
  useEffect(() => {
    rendererRef.current?.setEverything(everything);
  }, [everything, sprites]);

  // The ring follows whatever was opened last. With three windows up the map can still only mark one, and
  // the newest is the one the player is looking at.
  useEffect(() => {
    rendererRef.current?.setSelected(top?.kind === 'house' ? top.id : null);
  }, [top, sprites]);

  /**
   * Picking a house, which opens an **inspect window** on it.
   *
   * The canvas takes no pointer events, so the map hands the click over and the renderer says what it drew
   * there. A hit is marked handled, which is how the area overlay knows to leave the click alone: two
   * things opened by one click would be one thing too many.
   *
   * A click on empty ground closes nothing. A window is a thing the player opened and it is theirs to
   * shut; the old inspector vanished on every stray click, which made it useless for reading.
   */
  useEffect(() => {
    const onClick = (event: maplibregl.MapMouseEvent) => {
      const hit = rendererRef.current?.hitTest(event.point) ?? null;
      if (hit !== null) {
        event.preventDefault();
        inspect({ kind: 'house', id: hit });
      }
    };

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  return <div className="sprites" ref={containerRef} data-testid="sprites" />;
}
