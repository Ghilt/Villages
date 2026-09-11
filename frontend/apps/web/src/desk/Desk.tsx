import { useEffect, useRef } from 'react';
import type * as maplibregl from 'maplibre-gl';

import { sheetCoversView, sheetOnScreen } from '../map/sheet';
import { SEA } from '../map/worldStyle';

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
 */
export function Desk({ map }: DeskProps) {
  const deskRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const desk = deskRef.current;
    const sheet = sheetRef.current;
    if (map === null || desk === null || sheet === null) {
      return;
    }

    const place = () => {
      const container = map.getContainer();
      const viewport = { width: container.clientWidth, height: container.clientHeight };
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
      desk.style.backgroundSize = `${lying.size / GRAINS_ACROSS_THE_SHEET}px`;
      desk.style.backgroundPosition = `${lying.left}px ${lying.top}px`;
      sheet.style.transform = `translate(${lying.left}px, ${lying.top}px)`;
      sheet.style.width = `${lying.size}px`;
      sheet.style.height = `${lying.size}px`;
    };

    place();
    map.on('move', place);
    map.on('resize', place);
    return () => {
      map.off('move', place);
      map.off('resize', place);
    };
  }, [map]);

  return (
    <div className="desk" ref={deskRef} hidden style={{ backgroundImage: deskGrain }}>
      <div className="desk__sheet" ref={sheetRef} style={{ background: SEA }} />
    </div>
  );
}
