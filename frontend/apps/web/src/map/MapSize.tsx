import { PaneSizeControl } from '../stage/PaneSizeControl';
import type { Room } from '../stage/panes';

/**
 * The map's size control, on a phone: the three marks in its top right corner over a little fade, and nothing
 * else. The size control is the top pane's alone, and the map had nowhere to put it; a bar across it saying
 * *the map* was too heavy in the picture, Adam's word of 2026-10-08, so the map keeps its whole width and the
 * marks lie on it with just enough shade under them to be read on any ground. Put away, the map is a strip of
 * itself with the marks in its corner, and turned, a sliver with the marks down the top of it.
 *
 * Over the map rather than taking room from it, because `MapView` throws away a camera, a style and a WebGL
 * context when it unmounts and the overlays over the map are laid out on the whole of its bay. Never in the
 * spread, where the map is the floor and has no size. See decision record 0109.
 */
export function MapSize({ room }: { room: Room }) {
  return (
    <div className="map-size dressed ui-on-night">
      <PaneSizeControl room={room} />
    </div>
  );
}
