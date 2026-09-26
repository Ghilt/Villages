import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { note } from '../debug/log';
import { deskCoversView, deskOnScreen } from '../desk/deskTop';
import type { DeskTop } from '../desk/deskTop';
import { drawnAt, drawnPoint, flatWindow, floorZoom, sheetOnScreen } from '../map/sheet';

import { lightAt, roomAt, sceneAt, solidAt } from './dive';
import { attachPull, pullNow, watchPull } from './pull';
import { BEYOND, roomFloor } from './roomArt';
import { roomOnScreen, scaleFor, turnsAt } from './roomBox';

interface RoomProps {
  map: maplibregl.Map | null;
  /** Where the player's house stands, which is the way into the room and out of it. */
  seat: { lat: number; lon: number } | null;
  /** Whether the map pane is put away as a strip, in which case there is no room to pull back into. */
  strip: boolean;
  children: ReactNode;
}

const lay = (element: HTMLElement, rect: DeskTop): void => {
  element.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
};

/**
 * The room the desk stands in, and everything that lies on the desk.
 *
 * Three layers, and the order of them is the whole design. The room's floor sits behind the map and the
 * desk, inside the part that scales, so that pulling back shrinks the desk away from it and opens the
 * room around it - the same rule that reveals the desk from under the sheet, one level further out. The
 * copy over the top is outside the part that scales, and is the only thing ever drawn in front of the
 * map: it is the room inside the castle during a dive, growing out of the sprite's own pixels on the way
 * in and shrinking back into them on the way out.
 *
 * On the rail the part that scales is not a map any more but a picture of one, so it is drawn with its
 * pixels hard rather than smeared. That is the point of the passage: you go into the mark for your own
 * house until the mark is all there is, and the room is inside it.
 *
 * This element is also the pointer surface; see the note on the two of them below. Experiment 0009.
 *
 * Like the desk, it is laid out as if the camera looked straight down, in the flat window, and each
 * rectangle and point is squashed by the tip only as it is written to the page. A scale about the middle
 * of the flat window is a scale about the middle of the real one, so the pull's own numbers do not change
 * at all. See decision record 0060.
 */
export function Room({ map, seat, strip, children }: RoomProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const wallsRef = useRef<HTMLDivElement | null>(null);
  const stillRef = useRef<HTMLDivElement | null>(null);
  const pull = useSyncExternalStore(watchPull, pullNow);

  // Read through refs so that the pull can ask about them at any moment without being rebuilt when they
  // change; rebuilding it would drop the wheel listener mid-scroll.
  const seatRef = useRef(seat);
  seatRef.current = seat;
  const stripRef = useRef(strip);
  stripRef.current = strip;
  const openWas = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (map === null || surface === null) {
      return;
    }
    return attachPull({
      map,
      surface,
      seatNow: () => seatRef.current,
      stripNow: () => stripRef.current,
    });
  }, [map]);

  const place = useRef<() => void>(() => {});
  place.current = () => {
    const scene = sceneRef.current;
    const walls = wallsRef.current;
    const still = stillRef.current;
    if (map === null || scene === null || walls === null || still === null) {
      return;
    }
    const container = map.getContainer();
    const pitch = map.getPitch();
    const viewport = flatWindow({ width: container.clientWidth, height: container.clientHeight }, pitch);

    if (pull.dive !== null) {
      const flat = sceneAt(pull.dive, viewport, pull.dive.progress);
      const origin = drawnPoint(flat.origin, pitch);
      const slide = drawnPoint(flat.slide, pitch);
      const scale = flat.scale;
      scene.style.transformOrigin = `${origin.x}px ${origin.y}px`;
      scene.style.transform = `translate(${slide.x}px, ${slide.y}px) scale(${scale})`;
      scene.style.willChange = 'transform';
      scene.style.imageRendering = 'pixelated';
      scene.style.opacity = `${lightAt(pull.dive.progress)}`;
      walls.hidden = true;
      openWas.current = undefined;
      still.hidden = false;
      lay(still, drawnAt(roomAt(pull.dive, viewport, pull.dive.progress), pitch));
      still.style.opacity = `${solidAt(pull.dive.progress)}`;
      return;
    }

    still.hidden = true;
    scene.style.transformOrigin = '';
    scene.style.imageRendering = '';
    scene.style.opacity = '';

    const centre = map.getCenter();
    const lying = sheetOnScreen({
      center: { lng: centre.lng, lat: centre.lat },
      zoom: map.getZoom(),
      ...viewport,
    });
    const pulled = pull.amount > 0;
    const desk = deskOnScreen(lying, viewport);
    const scale = pulled ? scaleFor(pull.amount, turnsAt(roomOnScreen(desk), viewport)) : 1;
    scene.style.transform = pulled ? `scale(${scale})` : '';
    scene.style.willChange = pulled ? 'transform' : '';
    const open = pulled && !deskCoversView(desk, viewport, scale);
    walls.hidden = !open;
    if (open) {
      lay(walls, drawnAt(roomOnScreen(desk), pitch));
    }
    // Only while the pull is on and the camera is still pinned at its floor. A dive moves the camera, and
    // the move it fires runs this before React has heard, so without the second half of the guard leaving
    // the room would report itself as the desk closing over the view.
    const pinned = map.getZoom() <= floorZoom(viewport) + 1e-6;
    if (openWas.current !== undefined && openWas.current !== open && pulled && pinned) {
      note('room', open ? 'the desk has edges, and the room is around it' : 'the desk covers the view again');
    }
    openWas.current = open;
  };

  useEffect(() => {
    place.current();
  });

  useEffect(() => {
    if (map === null) {
      return;
    }
    const moved = () => place.current();
    map.on('move', moved);
    map.on('resize', moved);
    return () => {
      map.off('move', moved);
      map.off('resize', moved);
    };
  }, [map]);

  const away = pull.amount > 0 || pull.dive !== null;

  /*
   * Which of the two takes the pointer, and it is only ever one of them. At rest the scene takes
   * everything and this element is not even in the way, so a drag, a click and a wheel reach the map
   * exactly as they always did - a capture listener here still sees them on the way down. Once the pull
   * is on it is the other way about: the scene is out of the path entirely, so nothing can be dragged by
   * a pointer whose coordinates a scale has made a lie, and the wheel has the whole window to land in
   * rather than the thumbnail the map has become.
   */
  return (
    <div
      className="room"
      ref={surfaceRef}
      style={{ pointerEvents: away ? 'auto' : 'none', background: away ? BEYOND : 'none' }}
    >
      <div className="room__scene" ref={sceneRef} style={{ pointerEvents: away ? 'none' : 'auto' }}>
        <div className="room__walls" ref={wallsRef} hidden style={{ backgroundImage: roomFloor }} />
        {children}
      </div>
      <div className="room__still" ref={stillRef} hidden style={{ backgroundImage: roomFloor }} />
    </div>
  );
}
