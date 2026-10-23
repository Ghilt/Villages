import type { Looking } from '@villages/client-core';

import { openDialogueStore } from './dialogues/openDialogue';
import { focusedFigureStore } from './figures/focus';
import { isWaterKind, subjectsStore } from './inspect/subjects';
import { watersStore } from './inspect/waters';

/**
 * What the page is looking at as the player takes action, gathered from the surfaces that know: the houses and
 * characters with inspect windows open on them, where each window on water was opened, the dialogue being read, and the
 * key figure open. Where the roll's die landed is the die's, and Take action adds it. Nothing it could work out for
 * itself - no terrain, no names - because every field is a claim the server checks and the omens are the server's to
 * work out. Gathered here at the root, which may read every surface, and handed down to the choice roll. See decision
 * records 0083, 0084 and 0118.
 */
export function lookingNow(): Looking {
  const open = subjectsStore.get().open;
  return {
    inspectingHouses: open.filter((one) => one.kind === 'house').map((one) => one.id),
    inspectingCharacters: open.filter((one) => one.kind === 'character').map((one) => one.id),
    // Where, and never what: the server reads the place again for the water there (0087).
    inspectingWaters: open.flatMap((one) => {
      const seen = isWaterKind(one.kind) ? watersStore.get().seen.get(one.id) : undefined;
      return seen === undefined ? [] : [{ lat: seen.at.lat, lon: seen.at.lon }];
    }),
    ...(openDialogueStore.get().id === null ? {} : { dialogue: openDialogueStore.get().id! }),
    ...(focusedFigureStore.get().id === null ? {} : { figure: focusedFigureStore.get().id! }),
  };
}
