import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';

import { note } from '../log/log';
import { fromMercator, toMercatorExact } from '../geometry/cameraMath';

import { CAMERA, lensFor, resolveStyle } from './mapConfig';
import { constrainCamera, flatWindow, floorZoom } from './sheet';
import { startAtIn } from '../net/startAt';
import { tiltAt, tiltRamp, tippedAbout } from './tilt';

import 'maplibre-gl/dist/maplibre-gl.css';

/** Whether the map link has been said in the log: once a page load, though development makes the map twice. */
let linkSaid = false;

type Constrain = NonNullable<maplibregl.MapOptions['transformConstrain']>;

/**
 * The part of MapLibre that is not ours to touch, named so that touching it is visible.
 *
 * Its gesture handlers keep their own copy of the camera for the length of a gesture, the "requested"
 * state, and `transformCameraUpdate` only changes the camera that is drawn. A wheel zoom that began flat
 * would go on anchoring the ground under the pointer with a flat copy while the drawn camera tipped, and
 * the ground would slide out from under the pointer. So the copy's tilt is kept in step with the drawn
 * one. It is private, so it is reached for carefully: if a MapLibre ever renames it, the tilt is still
 * right and only the anchoring loses its precision, and the log says so once.
 */
interface HandlersCamera {
  _camera?: {
    _requestedCameraState?: { setPitch(pitch: number): void; setCenter(center: maplibregl.LngLat): void };
  };
}

interface MapViewProps {
  /** Where the world this page is drawing was cut to, as the root of a URL. See map/masters.ts. */
  worldRoot: string;
  /** Called once the map has a style and a camera, so that overlays can attach to it. */
  onReady?: (map: maplibregl.Map) => void;
}

/**
 * The map is the world, so it owns the camera and everything else follows it. This component is the only
 * place that talks to MapLibre imperatively; the rest of the interface reads state and draws over it.
 */
export function MapView({ worldRoot, onReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    // The window as the flat world sees it at a zoom: the rules for how far the camera may go and how far
    // back it may pull are the flat rules in a window taller by one over the lean at that zoom. The tilt
    // is worked out from the zoom rather than read off the map, because the edge rule is asked about a
    // zoom MapLibre is about to take, and a tilt read off the map would be the last frame's.
    const real = () => ({ width: container.clientWidth, height: container.clientHeight });
    const flatAt = (zoom: number) => flatWindow(real(), tiltAt(zoom));

    // MapLibre asks this from inside its constructor, before `map` exists, so it may reach for the
    // container and nothing else. It replaces MapLibre's rule that the world must fill the window with
    // ours, under which the world may shrink to a sheet on the desk. See docs/adr/0033.
    const keepOnTheSheet: Constrain = (lngLat, zoom) => {
      const kept = constrainCamera({ centre: toMercatorExact(lngLat), zoom }, flatAt(zoom), CAMERA.maxZoom);
      const centre = fromMercator(kept.centre);
      return { center: new maplibregl.LngLat(centre.lng, centre.lat), zoom: kept.zoom };
    };

    // Where the pointer is, for a zoom about it: the wheel's, or the middle of two fingers. MapLibre zooms
    // about exactly these points, so the tip is taken about them too while one of its zooms is running.
    let pointer: { x: number; y: number } | null = null;
    const onWheel = (event: WheelEvent) => {
      const box = container.getBoundingClientRect();
      pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    const onTouch = (event: TouchEvent) => {
      const [one, two] = [event.touches[0], event.touches[1]];
      if (one === undefined || two === undefined) {
        return;
      }
      const box = container.getBoundingClientRect();
      pointer = {
        x: (one.clientX + two.clientX) / 2 - box.left,
        y: (one.clientY + two.clientY) / 2 - box.top,
      };
    };
    container.addEventListener('wheel', onWheel, { capture: true, passive: true });
    container.addEventListener('touchmove', onTouch, { capture: true, passive: true });

    // Tipped by the zoom, on every move whatever made it: a wheel, a pinch, a flight, a jump. MapLibre's own
    // hook for adjusting the camera before it is drawn, so no gesture and no flight is interrupted to do it.
    // A flight or a jump is tipped about the middle of the window, which the tilt leaves where it is; a zoom
    // about the pointer is tipped about the pointer. See experiment 0011.
    let built: maplibregl.Map | null = null;
    let saidPrivate = false;
    const tipByZoom: NonNullable<maplibregl.MapOptions['transformCameraUpdate']> = (next) => {
      const pitch = tiltAt(next.zoom);
      const requested = (built as unknown as HandlersCamera | null)?._camera;
      if (built !== null && requested === undefined && !saidPrivate) {
        saidPrivate = true;
        note(
          'camera',
          'MapLibre keeps its camera somewhere new, so zooming about the pointer is no longer exact while it tips',
        );
      }
      const zoomingAbout =
        pointer !== null &&
        built !== null &&
        (built.scrollZoom.isActive() || built.touchZoomRotate.isActive());
      if (!zoomingAbout || pointer === null || pitch === next.pitch) {
        requested?._requestedCameraState?.setPitch(pitch);
        return { pitch };
      }
      const moved = tippedAbout(
        next.center,
        next.zoom,
        pointer,
        real(),
        { pitch: next.pitch, bearing: next.bearing },
        { pitch, bearing: next.bearing },
      );
      const center = new maplibregl.LngLat(moved.lng, moved.lat);
      requested?._requestedCameraState?.setPitch(pitch);
      requested?._requestedCameraState?.setCenter(center);
      return { pitch, center };
    };

    // A map link opens it over the place it names, and nothing else changes: the fog is the window's own.
    const linked = startAtIn(window.location.search);
    if (linked !== null && !linkSaid) {
      linkSaid = true;
      note(
        'camera',
        `opened at ${linked.lat.toFixed(3)}, ${linked.lon.toFixed(3)}, zoom ${linked.zoom}, as the link asked`,
      );
    }
    const startZoom = linked?.zoom ?? CAMERA.initialZoom;
    const map = new maplibregl.Map({
      container,
      style: resolveStyle(import.meta.env, worldRoot),
      center: linked === null ? [CAMERA.center.lng, CAMERA.center.lat] : [linked.lon, linked.lat],
      zoom: startZoom,
      minZoom: CAMERA.minZoom,
      maxZoom: CAMERA.maxZoom,
      transformConstrain: keepOnTheSheet,
      transformCameraUpdate: tipByZoom,
      // North-up and tipped by the zoom, which is the player's camera: decision record 0060 as amended by
      // experiment 0011. The lens that goes with it is set just below, because it is not a constructor
      // option.
      pitch: tiltAt(startZoom),
      bearing: CAMERA.bearing,
      // The ceiling, not the camera: what this opens is the debug panel's Camera section, the instrument
      // for experiment 0008. Eighty-five rather than the sixty MapLibre defaults to, so the lever can be
      // pushed past the angles worth looking at rather than stopping exactly on one of them.
      maxPitch: 85,
      renderWorldCopies: false,
      // No attribution control, and no controls at all: the map is the world rather than a map of it, and
      // a line of source credits along the bottom of the world is the one thing on the stage that says
      // otherwise. It never worked anyway - MapLibre credits the sources whose layers are showing, and a
      // painted renderer hides the flat tiles, so the line appeared on one renderer of six. Three of the
      // four sources are CC-BY and the credit is owed; `AUTHORING-THE-WORLD.md` says where it lives and
      // what the game still owes a player. See decision record 0050.
      attributionControl: false,
    });

    built = map;
    // Parallel, because it tips: the overlay is placed by a projection that is exact only for a parallel
    // camera, and a wide lens would slide every mark and tree off its ground. See `lensFor`.
    map.setVerticalFieldOfView(lensFor(tiltRamp().most));

    // Every way a player could turn or tip the world by hand stays closed. The camera's angle is the
    // world's, not a player's control; only the debug panel moves it, which is Adam's lever. Two fingers
    // dragged up a touch screen tip a MapLibre map by default, and that one was open until 0060.
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.touchPitch.disable();
    map.keyboard.disableRotation();

    // The wheel asks the rule below directly. There were two buttons here until 0049; the floor still moves
    // with the window, because the wheel and the pinch both read it.
    const settleFloor = () => {
      // The floor is measured in the flat window at the floor's own tilt, which is none unless the ramp
      // has been pulled out past it.
      const floor = floorZoom(flatAt(floorZoom(real())));
      if (map.getMinZoom() !== floor) {
        map.setMinZoom(floor);
      }
    };
    settleFloor();
    map.on('resize', settleFloor);

    if (import.meta.env.DEV) {
      // A handle for the browser console and for the end-to-end tests, which assert on the camera.
      (window as unknown as { villagesMap?: maplibregl.Map }).villagesMap = map;
    }

    const announce = () => onReady?.(map);
    if (map.loaded()) {
      announce();
    } else {
      map.once('load', announce);
    }

    return () => {
      container.removeEventListener('wheel', onWheel, { capture: true });
      container.removeEventListener('touchmove', onTouch, { capture: true });
      map.remove();
    };
  }, [worldRoot, onReady]);

  return <div className="map" ref={containerRef} data-testid="map" />;
}
