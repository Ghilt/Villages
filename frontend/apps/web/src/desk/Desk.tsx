import { useEffect, useRef } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { drawnAt, flatWindow, sheetCoversView, sheetOnScreen } from '../map/sheet';
import { SEA } from '../map/worldStyle';

import { deskOnScreen } from './deskTop';
import { deskGrain } from './deskTexture';

interface DeskProps {
  map: maplibregl.Map | null;
}

/** How many times the grain repeats across the sheet's side, so it scales with the sheet and not the window. */
const GRAINS_ACROSS_THE_SHEET = 4;

/**
 * The surface the map lies on. Seen once the camera is pulled back past the point where the world's
 * square covers the window, and hidden above that, where it would cost a repaint for nothing.
 *
 * It follows the camera by writing styles as the map moves, in the same frame MapLibre paints, so the
 * sheet and its shadow never part from the tiles. The sheet element sits under the transparent canvas in
 * the sea's colour, so the half pixel between MapLibre's tiles and this edge never shows as a hairline.
 * See docs/adr/0033.
 *
 * The desk has edges now, because something can see past them: pulled back further still it stands in a
 * room, and a surface with no end would have been a backdrop rather than a thing. They are off the screen
 * with the sheet anywhere near the middle, so nothing about the floor has changed; shove the sheet hard
 * against one side of the window and the far edge comes into view, which is the desk being an object.
 * See `deskTop.ts` and experiment 0009.
 *
 * It lies on the same tipped ground the world does. Everything is laid out as if the camera looked
 * straight down, in the flat window `flatWindow` gives, and squashed by the tip only as it is drawn, so the
 * sheet, its shadow and the grain are foreshortened exactly as the tiles are. See decision record 0058.
 */
export function Desk({ map }: DeskProps) {
  const deskRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const desk = deskRef.current;
    const top = topRef.current;
    const sheet = sheetRef.current;
    if (map === null || desk === null || top === null || sheet === null) {
      return;
    }

    const place = () => {
      const container = map.getContainer();
      const pitch = map.getPitch();
      const viewport = flatWindow({ width: container.clientWidth, height: container.clientHeight }, pitch);
      const centre = map.getCenter();
      const lying = sheetOnScreen({
        center: { lng: centre.lng, lat: centre.lat },
        zoom: map.getZoom(),
        ...viewport,
      });
      const covered = sheetCoversView(lying, viewport);
      desk.hidden = covered;
      if (covered) {
        return;
      }
      const standing = drawnAt(deskOnScreen(lying, viewport), pitch);
      const paper = drawnAt(
        { left: lying.left, top: lying.top, width: lying.size, height: lying.size },
        pitch,
      );
      const grain = drawnAt({ top: 0, height: lying.size / GRAINS_ACROSS_THE_SHEET }, pitch).height;
      top.style.transform = `translate(${standing.left}px, ${standing.top}px)`;
      top.style.width = `${standing.width}px`;
      top.style.height = `${standing.height}px`;
      top.style.backgroundSize = `${lying.size / GRAINS_ACROSS_THE_SHEET}px ${grain}px`;
      top.style.backgroundPosition = `${paper.left - standing.left}px ${paper.top - standing.top}px`;
      sheet.style.transform = `translate(${paper.left}px, ${paper.top}px)`;
      sheet.style.width = `${paper.width}px`;
      sheet.style.height = `${paper.height}px`;
    };

    place();
    map.on('move', place);
    map.on('resize', place);
    map.on('pitch', place);
    return () => {
      map.off('move', place);
      map.off('resize', place);
      map.off('pitch', place);
    };
  }, [map]);

  return (
    <div className="desk" ref={deskRef} hidden>
      <div className="desk__top" ref={topRef} style={{ backgroundImage: deskGrain }} />
      <div className="desk__sheet" ref={sheetRef} style={{ background: SEA }} />
    </div>
  );
}
