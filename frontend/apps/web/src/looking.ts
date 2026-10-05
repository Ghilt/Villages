import type { Looking } from '@villages/client-core';
import type * as maplibregl from 'maplibre-gl';

import { openDialogueStore } from './dialogues/openDialogue';
import { focusedFigureStore } from './figures/focus';
import { subjectsStore } from './inspect/subjects';

/**
 * What the page is looking at as the player presses Take action, gathered from the surfaces that know: where the
 * camera is centred and how close, the houses and characters with inspect windows open on them, the dialogue being
 * read, and the key figure open. Nothing it could work out for itself - no terrain, no names - because every field
 * is a claim the server checks and the omens are the server's to work out. Gathered here at the root, which may
 * read every surface, and handed down to the choice roll. See decision records 0083 and 0084.
 */
let camera: maplibregl.Map | null = null;

/** The map the camera is read off, or null while there is none. Set by the app as the map is ready. */
export function lookThrough(map: maplibregl.Map | null): void {
  camera = map;
}

export function lookingNow(): Looking {
  const open = subjectsStore.get().open;
  const centre = camera?.getCenter().wrap();
  return {
    ...(centre === undefined || camera === null
      ? {}
      : { centre: { lat: centre.lat, lon: centre.lng }, zoom: camera.getZoom() }),
    inspectingHouses: open.filter((one) => one.kind === 'house').map((one) => one.id),
    inspectingCharacters: open.filter((one) => one.kind === 'character').map((one) => one.id),
    ...(openDialogueStore.get().id === null ? {} : { dialogue: openDialogueStore.get().id! }),
    ...(focusedFigureStore.get().id === null ? {} : { figure: focusedFigureStore.get().id! }),
  };
}
