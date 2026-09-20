import type { Room } from '../stage/panes';

/**
 * The map put away: a lid over a map that is still running underneath.
 *
 * **The whole strip is the way back**, and there is no pane size control on it. A map is the one pane
 * whose strip has nothing to say - no name worth reading twice, nothing to scroll, no state to report -
 * so three marks in 44 pixels of it would be three things to aim at instead of one, and the one thing a
 * put-away map has to offer is itself. Pressing it asks for the middle size, which is half the stage.
 *
 * That is the map's whole exception, and it is in the drawing rather than in the model: a pane renders its
 * own chrome, so a pane that renders no control has none, and nothing in the layout had to learn about it.
 *
 * **It lies over the map rather than instead of it.** `MapView` throws away a camera, a style and a WebGL
 * context when it unmounts, which is why nothing on this stage is unmounted to move it; so the map goes on
 * running behind an opaque strip and comes back exactly where it was. It takes the pointer, so the map
 * underneath cannot be dragged by somebody aiming at the strip.
 *
 * See decision record 0046.
 */
export function MapStrip({ room }: { room: Room }) {
  return (
    <button
      type="button"
      className="map-strip"
      aria-label="bring the map back"
      title="bring the map back"
      onClick={() => room.ask('small')}
    >
      <span className="map-strip__name">Map</span>
    </button>
  );
}
