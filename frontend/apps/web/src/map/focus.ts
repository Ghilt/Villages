import { note } from '../log/log';

/**
 * Taking the camera somewhere, from a part of the interface that has no business holding a map.
 *
 * An inspect window's "show it on the map" link has to move the camera, and an inspect window is drawn in a
 * pane that may not even have the map in it. Rather than passing MapLibre down to everything that might one
 * day want to point at something, the map leaves a way to be asked here and whoever wants it calls that.
 *
 * A registered function rather than a store, because nothing renders from this: it is an instruction, not a
 * piece of state, and a store would make every window re-render whenever the camera was asked to move.
 */

export interface Place {
  lat: number;
  lon: number;
}

type Fly = (place: Place) => void;

let fly: Fly | null = null;

/** The map saying it is here and can be asked. Null when it goes away. */
export function flyWith(how: Fly | null): void {
  fly = how;
}

/**
 * Put the camera on a place.
 *
 * Silent when there is no map to ask - a link followed before the map has loaded is a link that does
 * nothing, which is better than one that throws.
 */
export function focusOn(place: Place): void {
  if (fly === null) {
    note('inspect', 'nothing to show it on; the map is not up');
    return;
  }
  fly(place);
}
