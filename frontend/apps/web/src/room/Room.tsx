import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { note } from '../log/log';
import type { DeskTop } from '../desk/deskTop';
import { drawnAt, drawnPoint, flatWindow, floorZoom, sheetOnScreen } from '../map/sheet';

import { coversWindow, cssOf, project } from './camera';
import { lightAt, roomAt, sceneAt, solidAt } from './dive';
import type { Dive } from './dive';
import { roomMarkup } from './draw';
import { BEYOND, tableOf } from './model';
import { pullStore, attachPull } from './pull';
import { atTheEnd, pulledBack } from './roomBox';
import { roomMost } from './seen';
import { useStore } from '../store/useStore';

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
 * Three layers, and the order of them is the whole design. The room's floor is drawn behind the map and the
 * desk, through the same camera that draws them back, turns them and tips them, so that pulling back shrinks
 * the desk away from it and opens the room round it - the same rule that reveals the desk from under the
 * sheet, one level further out. The room inside the castle is drawn over the top, and is the only thing ever
 * drawn in front of the map: during a dive it grows out of the sprite's own pixels on the way in and shrinks
 * back into them on the way out, and it is the same drawing of the same room. See `docs/plans/room.md`.
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
  const floorRef = useRef<HTMLDivElement | null>(null);
  const floorPictureRef = useRef<SVGSVGElement | null>(null);
  const stillRef = useRef<HTMLDivElement | null>(null);
  const stillPictureRef = useRef<SVGSVGElement | null>(null);
  // The room the picture inside the castle was last drawn for: it is drawn once a dive, not once a frame.
  const stillFor = useRef<Dive['room'] | null>(null);
  // Only who takes the pointer is React's. Everything drawn is written straight to the styles from the store
  // below, so a frame of the pull or of a drag is one write of a transform and no drawing of components.
  const away = useStore(pullStore, (state) => state.amount > 0 || state.dive !== null);

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
    const floor = floorRef.current;
    const floorPicture = floorPictureRef.current;
    const still = stillRef.current;
    const stillPicture = stillPictureRef.current;
    if (
      map === null ||
      scene === null ||
      floor === null ||
      floorPicture === null ||
      still === null ||
      stillPicture === null
    ) {
      return;
    }
    const container = map.getContainer();
    const pitch = map.getPitch();
    const real = { width: container.clientWidth, height: container.clientHeight };
    const viewport = flatWindow(real, pitch);
    const pull = pullStore.get();

    if (pull.dive !== null) {
      const flat = sceneAt(pull.dive, pull.dive.progress);
      const origin = drawnPoint(flat.origin, pitch);
      const slide = drawnPoint(flat.slide, pitch);
      const scale = flat.scale;
      scene.style.transformOrigin = `${origin.x}px ${origin.y}px`;
      scene.style.transform = `translate(${slide.x}px, ${slide.y}px) scale(${scale})`;
      scene.style.willChange = 'transform';
      scene.style.imageRendering = 'pixelated';
      scene.style.opacity = `${lightAt(pull.dive.progress)}`;
      floor.hidden = true;
      openWas.current = undefined;
      still.hidden = false;
      lay(still, drawnAt(roomAt(pull.dive, pull.dive.progress), pitch));
      still.style.opacity = `${solidAt(pull.dive.progress)}`;
      // The room as the pull draws it at the turn, framed by the box it is drawn in there, which is the box the
      // dive grows to: so at the end of the passage the picture is the room, pixel for pixel.
      const shot = pull.dive.room;
      if (stillFor.current !== shot) {
        stillFor.current = shot;
        const box = drawnAt(shot.box, shot.pitch);
        stillPicture.setAttribute('viewBox', `${box.left} ${box.top} ${box.width} ${box.height}`);
        stillPicture.innerHTML = roomMarkup(shot.desk, shot.camera, shot.pitch, 'still');
      }
      return;
    }

    still.hidden = true;
    scene.style.imageRendering = '';
    scene.style.opacity = '';

    const centre = map.getCenter();
    const lying = sheetOnScreen({
      center: { lng: centre.lng, lat: centre.lat },
      zoom: map.getZoom(),
      ...viewport,
    });
    const pulled = pull.amount > 0;
    const { desk, camera } = pulledBack(lying, viewport, pull.amount, pull.about, roomMost());
    // Drawn back, turned and tipped as one picture: the map, the sprites and the desk are the table top, and the
    // camera draws a plane with one matrix.
    const css = cssOf(camera, pitch);
    scene.style.transformOrigin = pulled ? css.origin : '';
    scene.style.transform = pulled ? css.transform : '';
    scene.style.willChange = pulled ? 'transform' : '';
    const open =
      pulled &&
      !coversWindow(
        tableOf(desk).map((corner) => project(camera, corner)),
        viewport,
      );
    floor.hidden = !open;
    if (open) {
      floorPicture.setAttribute('viewBox', `0 0 ${real.width} ${real.height}`);
      floorPicture.innerHTML = roomMarkup(desk, camera, pitch, 'floor');
    }
    // Only while the pull is on and the camera is still pinned at its floor. A dive moves the camera, and
    // the move it fires runs this before React has heard, so without the second half of the guard leaving
    // the room would report itself as the desk closing over the view.
    const pinned = atTheEnd(map.getZoom(), floorZoom(viewport));
    if (openWas.current !== undefined && openWas.current !== open && pulled && pinned) {
      note('room', open ? 'the desk has edges, and the room is around it' : 'the desk covers the view again');
    }
    openWas.current = open;
  };

  useEffect(() => {
    place.current();
  });

  useEffect(() => pullStore.watch(() => place.current()), []);

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
      style={{
        pointerEvents: away ? 'auto' : 'none',
        // A finger dragged in the room looks round it, rather than scrolling the page.
        touchAction: away ? 'none' : 'auto',
        background: away ? BEYOND : 'none',
      }}
    >
      <div className="room__floor" ref={floorRef} hidden>
        <svg ref={floorPictureRef} aria-hidden="true" />
      </div>
      <div className="room__scene" ref={sceneRef} style={{ pointerEvents: away ? 'none' : 'auto' }}>
        {children}
      </div>
      <div className="room__still" ref={stillRef} hidden>
        <svg ref={stillPictureRef} preserveAspectRatio="none" aria-hidden="true" />
      </div>
    </div>
  );
}
