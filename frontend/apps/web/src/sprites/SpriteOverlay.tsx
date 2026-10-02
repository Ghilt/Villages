import { useEffect, useMemo, useRef, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { sceneryStore } from './scenery/settings';
import { circleOf, visionOf } from '../fog/circles';
import { fieldOf } from '../fog/fogField';
import { sessionStore } from '../net/gateway';
import { cameraOf } from './mapCamera';
import { createPixiSpriteRenderer } from './PixiSpriteRenderer';
import type { MapSprite } from './SpriteRenderer';
import { useStore } from '../store/useStore';

/** How a person's mark is told from a house's: its id is theirs with this in front. See App.tsx. */
const CHARACTER = 'character:';

interface SpriteOverlayProps {
  map: maplibregl.Map;
  sprites: readonly MapSprite[];
  /** Where this page's flat tiles live, which is the terrain the scenery is scattered from. */
  worldRoot: string;
  /**
   * What the map marks: the newest thing a window is open on, if any. Handed in, as picking is, so that the
   * overlay knows nothing of windows. See `App.tsx`.
   */
  picked: { kind: 'house' | 'area' | 'character'; id: string } | undefined;
  /** A house or a person clicked on the map, which opens a window on them. */
  onPick: (thing: { kind: 'house' | 'character'; id: string }) => void;
}

/**
 * Holds the renderer for as long as the map lives, and hands it whatever should be on the map. The
 * renderer type is the only thing this file knows about Pixi, so swapping it is a one-line change here.
 */
export function SpriteOverlay({ map, sprites, worldRoot, picked: top, onPick }: SpriteOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const uncolouringRef = useRef<HTMLCanvasElement | null>(null);
  // Held in state, so that a renderer made after a switch was thrown is handed it the moment it exists.
  const [renderer, setRenderer] = useState<ReturnType<typeof createPixiSpriteRenderer> | null>(null);
  const everything = useStore(sessionStore, (state) => state.seeAll);
  const scenery = useStore(sceneryStore);
  const sight = useStore(sessionStore, (state) => state.yourSight);
  const today = useStore(sessionStore, (state) => state.world?.today ?? null);
  const fogOn = useStore(sessionStore, (state) => state.fogOfWar);

  // The house's vision points as circles, the distance field the fog is drawn from, and what it has in vision
  // for deciding which marks go over the fog, all with the surface tension between the circles, worked out once
  // for each change to what the house has seen from and never while the camera moves. See 0061 and 0064.
  const tension = sight?.tension ?? 0;
  const circles = useMemo(
    () => (sight?.points ?? []).map((point) => circleOf(point, today, tension)),
    [sight, today, tension],
  );
  const field = useMemo(() => fieldOf(circles, tension), [circles, tension]);
  const vision = useMemo(() => visionOf(sight?.points ?? [], today, tension), [sight, today, tension]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const made = createPixiSpriteRenderer(cameraOf(map));
    setRenderer(made);
    void made.mount(container, uncolouringRef.current ?? undefined);

    return () => {
      setRenderer(null);
      made.destroy();
    };
  }, [map]);

  // Each hands the renderer one thing when it changes, and the renderer draws once for however many changed.
  useEffect(() => {
    renderer?.setSprites(sprites);
  }, [renderer, sprites]);

  useEffect(() => {
    renderer?.setEverything(everything);
  }, [renderer, everything]);

  useEffect(() => {
    renderer?.setScenery({ ...scenery, tilesRoot: worldRoot });
  }, [renderer, scenery, worldRoot]);

  // Nothing is drawn until the gateway has said what the house sees, so a page still connecting is not a world
  // under haze for a moment; nothing either with the switch off.
  useEffect(() => {
    renderer?.setFog(fogOn && sight !== null ? { field, vision } : null);
  }, [renderer, fogOn, sight, field, vision]);

  // The ring follows whatever was opened last. With three windows up the map can still only mark one, and
  // the newest is the one the player is looking at.
  useEffect(() => {
    renderer?.setSelected(
      top?.kind === 'house' ? top.id : top?.kind === 'character' ? `${CHARACTER}${top.id}` : null,
    );
  }, [renderer, top]);

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
  const pick = useRef(onPick);
  pick.current = onPick;
  useEffect(() => {
    const onClick = (event: maplibregl.MapMouseEvent) => {
      const hit = renderer?.hitTest(event.point) ?? null;
      if (hit !== null) {
        event.preventDefault();
        pick.current(
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
  }, [map, renderer]);

  // The canvas the map's colour is taken out through comes first, so that it lies between the map and the
  // sprites and its blend reaches the map alone. See decision record 0065.
  return (
    <>
      <canvas className="uncolouring" ref={uncolouringRef} aria-hidden="true" />
      <div className="sprites" ref={containerRef} data-testid="sprites" />
    </>
  );
}
