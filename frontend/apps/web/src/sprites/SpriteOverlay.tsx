import { useEffect, useMemo, useRef, useState } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { sceneryStore } from './scenery/settings';
import { circleOf, visionOf } from '../fog/circles';
import { fieldOf } from '../fog/fogField';
import { whileInHand } from '../loading/inHand';
import { sessionStore } from '../net/gateway';
import { focusOn } from '../map/focus';
import { CrowdCard } from './CrowdCard';
import { cameraOf } from './mapCamera';
import { createPixiSpriteRenderer } from './PixiSpriteRenderer';
import type { MapSprite } from './SpriteRenderer';
import { useStore } from '../store/useStore';

/** How a person's mark is told from a structure's: its id is theirs with this in front. See App.tsx. */
const CHARACTER = 'character:';
/** The id space structures are drawn under, apart from people. See `mapSprites.ts`. */
const STRUCTURE = 'structure:';
/** What a crowd's "+N" answers a click with: its leader's id with this in front. See `MarksLayer.ts`. */
const GROUP = 'group:';
/** How close a Ctrl-click takes the camera: well in from where everything becomes its mark. */
const CLOSER_ZOOM = 9;

/** A person or a structure, by the id it is drawn under, or null for anything else. */
function thingOf(id: string): { kind: 'character' | 'structure'; id: string } | null {
  return id.startsWith(CHARACTER)
    ? { kind: 'character', id: id.slice(CHARACTER.length) }
    : id.startsWith(STRUCTURE)
      ? { kind: 'structure', id: id.slice(STRUCTURE.length) }
      : null;
}

interface SpriteOverlayProps {
  map: maplibregl.Map;
  sprites: readonly MapSprite[];
  /** Where this page's flat tiles live, which is the terrain the scenery is scattered from. */
  worldRoot: string;
  /**
   * What the map marks: the newest thing a window is open on, if any. Handed in, as picking is, so that the
   * overlay knows nothing of windows. See `App.tsx`.
   */
  picked:
    { kind: 'house' | 'area' | 'character' | 'structure' | 'river' | 'lake' | 'sea'; id: string } | undefined;
  /** A person or a structure clicked on the map, which opens a window on it. */
  onPick: (thing: { kind: 'character' | 'structure'; id: string }) => void;
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
    void whileInHand('the sprite canvas', made.mount(container, uncolouringRef.current ?? undefined));

    return () => {
      setRenderer(null);
      made.destroy();
    };
  }, [map]);

  // Nothing is drawn until the gateway has said what the house sees, so a page still connecting is not a world
  // under haze for a moment; nothing either with the switch off.
  const fog = useMemo(
    () => (fogOn && sight !== null ? { field, vision } : null),
    [fogOn, sight, field, vision],
  );
  const how = useMemo(() => ({ ...scenery, tilesRoot: worldRoot }), [scenery, worldRoot]);
  // The ring follows whatever was opened last. With three windows up the map can still only mark one, and
  // the newest is the one the player is looking at. A house is marked by its seat, which the app hands in.
  const selected =
    top?.kind === 'character'
      ? `${CHARACTER}${top.id}`
      : top?.kind === 'structure'
        ? `${STRUCTURE}${top.id}`
        : null;
  const scene = useMemo(() => ({ sprites, selected, fog, scenery: how }), [sprites, selected, fog, how]);

  // The whole scene at once: the renderer works out what changed, and draws once for however much did.
  useEffect(() => {
    renderer?.setScene(scene);
  }, [renderer, scene]);

  /**
   * Picking a structure or a person, which opens an **inspect window** on them.
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
  const drawn = useRef(sprites);
  drawn.current = sprites;
  // A crowd of marks far out, opened by a click on its "+N": who is in it, and where it was opened.
  const [crowd, setCrowd] = useState<{ members: readonly MapSprite[]; at: { x: number; y: number } } | null>(
    null,
  );
  /** A mark picked, on the map or in a crowd's card: its window, or with Ctrl or Cmd, the camera taken to it. */
  const choose = useRef((sprite: MapSprite, closer: boolean) => {
    const thing = thingOf(sprite.id);
    if (thing === null) return;
    if (closer) {
      focusOn({ lat: sprite.at.lat, lon: sprite.at.lng }, CLOSER_ZOOM);
    } else {
      pick.current(thing);
    }
  });
  useEffect(() => {
    const onClick = (event: maplibregl.MapMouseEvent) => {
      const hit = renderer?.hitTest(event.point) ?? null;
      if (hit === null) {
        return;
      }
      event.preventDefault();
      const byId = new Map(drawn.current.map((one) => [one.id, one]));
      if (hit.startsWith(GROUP)) {
        const members = (renderer?.groupOf(hit.slice(GROUP.length)) ?? []).flatMap(
          (id) => byId.get(id) ?? [],
        );
        setCrowd(members.length === 0 ? null : { members, at: { x: event.point.x, y: event.point.y } });
        return;
      }
      const sprite = byId.get(hit);
      if (sprite !== undefined) {
        choose.current(sprite, event.originalEvent.ctrlKey || event.originalEvent.metaKey);
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
      {crowd !== null && (
        <CrowdCard
          map={map}
          members={crowd.members}
          at={crowd.at}
          onClose={() => setCrowd(null)}
          onPick={(sprite, how) => {
            setCrowd(null);
            choose.current(sprite, how.closer);
          }}
        />
      )}
    </>
  );
}
