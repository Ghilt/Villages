import { PaneSizeControl } from '../stage/PaneSizeControl';
import type { Room } from '../stage/panes';
import { TopBar } from '../ui/bar/TopBar';

/**
 * The map's top bar, on a phone: the map's mark, its name and the size control, in the band a window on top
 * wears too, so the top of a phone reads the same whichever of the two is up. Adam's word of 2026-10-08: the
 * size control is the top pane's alone, and the map had nowhere to put it.
 *
 * **It lies over the map rather than taking room from it.** `MapView` throws away a camera, a style and a
 * WebGL context when it unmounts, which is why nothing on this stage is unmounted to move it, and the
 * overlays over the map are laid out on the whole of its bay; so the bar is a lid along the top of a map
 * still running underneath, opaque and taking the pointer. Put away, the bay is a strip and the bar is all
 * of it, a sliver down the side when the phone is turned. See decision record 0109.
 *
 * Never in the spread, where the map is the floor and has no size.
 */
export function MapBar({ room, along }: { room: Room; along: 'rows' | 'columns' }) {
  return (
    <div
      className={
        room.size === 'strip' ? 'map-bar map-bar--away ui-on-night dressed' : 'map-bar ui-on-night dressed'
      }
    >
      <TopBar
        mark="map"
        kind="The map"
        name="The map"
        end={<PaneSizeControl room={room} />}
        turned={along === 'columns' && room.size === 'strip'}
      />
    </div>
  );
}
