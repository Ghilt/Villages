import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { sceneryNow, watchScenery } from '../debug/scenery';
import { circleOf } from '../fog/circles';
import { fieldOf } from '../fog/fogField';
import { fogIsOn, watchFog } from '../fog/fogOfWar';
import { gatewayState, watchGateway } from '../net/gateway';
import { seeingEverything, watchSeeingEverything } from '../debug/seeEverything';
import { inspect } from '../inspect/opening';
import { subjectsNow, watchSubjects } from '../inspect/subjects';
import { cameraOf } from './mapCamera';
import { createPixiSpriteRenderer } from './PixiSpriteRenderer';
import type { MapSprite } from './SpriteRenderer';

/** How a person's mark is told from a house's: its id is theirs with this in front. See App.tsx. */
const CHARACTER = 'character:';

const sightNow = () => gatewayState().yourSight;
const todayNow = () => gatewayState().world?.today ?? null;

interface SpriteOverlayProps {
  map: maplibregl.Map;
  sprites: readonly MapSprite[];
  /** Where this page's flat tiles live, which is the terrain the scenery is scattered from. */
  worldRoot: string;
}

/**
 * Holds the renderer for as long as the map lives, and hands it whatever should be on the map. The
 * renderer type is the only thing this file knows about Pixi, so swapping it is a one-line change here.
 */
export function SpriteOverlay({ map, sprites, worldRoot }: SpriteOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ReturnType<typeof createPixiSpriteRenderer> | null>(null);
  const top = useSyncExternalStore(watchSubjects, subjectsNow).open[0];
  const everything = useSyncExternalStore(watchSeeingEverything, seeingEverything);
  const scenery = useSyncExternalStore(watchScenery, sceneryNow);
  const sight = useSyncExternalStore(watchGateway, sightNow);
  const today = useSyncExternalStore(watchGateway, todayNow);
  const fogOn = useSyncExternalStore(watchFog, fogIsOn);

  // The house's vision points as circles, and the distance field the fog is drawn from, worked out once for
  // each change to what the house has seen from and never while the camera moves. See decision 0061.
  const circles = useMemo(() => (sight ?? []).map((point) => circleOf(point, today)), [sight, today]);
  const field = useMemo(() => fieldOf(circles), [circles]);

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

  useEffect(() => {
    rendererRef.current?.setScenery({ ...scenery, tilesRoot: worldRoot });
  }, [scenery, worldRoot, sprites]);

  // Nothing is drawn until the gateway has said what the house sees, so a page still connecting is not a world
  // under haze for a moment; nothing either with the switch off. Also on the sprites, because a renderer made
  // after the switch was thrown starts with no fog.
  useEffect(() => {
    rendererRef.current?.setFog(fogOn && sight !== null ? { field, circles } : null);
  }, [fogOn, sight, field, circles, sprites]);

  // The ring follows whatever was opened last. With three windows up the map can still only mark one, and
  // the newest is the one the player is looking at.
  useEffect(() => {
    rendererRef.current?.setSelected(
      top?.kind === 'house' ? top.id : top?.kind === 'character' ? `${CHARACTER}${top.id}` : null,
    );
  }, [top, sprites]);

  /**
   * Picking a house or a person, which opens an **inspect window** on them.
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
        inspect(
          hit.startsWith(CHARACTER)
            ? { kind: 'character', id: hit.slice(CHARACTER.length) }
            : { kind: 'house', id: hit },
        );
      }
    };

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  return <div className="sprites" ref={containerRef} data-testid="sprites" />;
}
