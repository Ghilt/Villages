import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';

import { fromMercator, toMercatorExact } from '../sprites/cameraMath';

import { CAMERA, lensFor, resolveStyle } from './mapConfig';
import { constrainCamera, flatWindow, floorZoom } from './sheet';

import 'maplibre-gl/dist/maplibre-gl.css';

type Constrain = NonNullable<maplibregl.MapOptions['transformConstrain']>;

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

    // The window as the flat world sees it, because the camera is tipped: the rules for how far it may
    // go and how far back it may pull are the flat rules in a window taller by one over the lean. The
    // tip is read off the map once there is one, so the debug panel's slider moves the edges with it;
    // inside the constructor there is not, and the tip it is being built with is the player's.
    let built: maplibregl.Map | null = null;
    const viewport = () =>
      flatWindow(
        { width: container.clientWidth, height: container.clientHeight },
        built?.getPitch() ?? CAMERA.pitch,
      );

    // MapLibre asks this from inside its constructor, before `map` exists, so it may reach for the
    // container and nothing else. It replaces MapLibre's rule that the world must fill the window with
    // ours, under which the world may shrink to a sheet on the desk. See docs/adr/0033.
    const keepOnTheSheet: Constrain = (lngLat, zoom) => {
      const kept = constrainCamera({ centre: toMercatorExact(lngLat), zoom }, viewport(), CAMERA.maxZoom);
      const centre = fromMercator(kept.centre);
      return { center: new maplibregl.LngLat(centre.lng, centre.lat), zoom: kept.zoom };
    };

    const map = new maplibregl.Map({
      container,
      style: resolveStyle(import.meta.env, worldRoot),
      center: [CAMERA.center.lng, CAMERA.center.lat],
      zoom: CAMERA.initialZoom,
      minZoom: CAMERA.minZoom,
      maxZoom: CAMERA.maxZoom,
      transformConstrain: keepOnTheSheet,
      // Tipped back and north-up, which is the player's camera and decision record 0058. The lens that
      // goes with it is set just below, because it is not a constructor option.
      pitch: CAMERA.pitch,
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
    // Parallel, because it is tipped: the overlay is placed by a projection that is exact only for a
    // parallel camera, and a wide lens would slide every mark and tree off its ground. See `lensFor`.
    map.setVerticalFieldOfView(lensFor(CAMERA.pitch));

    // Every way a player could turn or tip the world by hand stays closed. The camera's angle is the
    // world's, not a player's control; only the debug panel moves it, which is Adam's lever. Two fingers
    // dragged up a touch screen tip a MapLibre map by default, and that one was open until 0058.
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.touchPitch.disable();
    map.keyboard.disableRotation();

    // The wheel asks the rule below directly. There were two buttons here until 0049, in the corner the
    // compass now stands in; the floor still moves with the window, because the wheel and the pinch both
    // read it.
    const settleFloor = () => {
      const floor = floorZoom(viewport());
      if (map.getMinZoom() !== floor) {
        map.setMinZoom(floor);
      }
    };
    settleFloor();
    map.on('resize', settleFloor);
    // The floor is measured in the flat window, which grows as the camera tips.
    map.on('pitch', settleFloor);

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
      map.remove();
    };
  }, [worldRoot, onReady]);

  return <div className="map" ref={containerRef} data-testid="map" />;
}
