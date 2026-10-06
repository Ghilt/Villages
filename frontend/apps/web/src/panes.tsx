import type { ReactNode } from 'react';

import type { SessionState } from '@villages/client-core';

import { CHOICE_PANE } from './choice/pane';
import { Choosing } from './choice/Choosing';
import { lookingNow } from './looking';
import { DIALOGUE_PANE } from './dialogues/pane';
import { Dialogues } from './dialogues/Dialogues';
import { KEY_FIGURES_PANE } from './figures/pane';
import { KeyFigures } from './figures/KeyFigures';
import { HOUSE_PANE } from './house/pane';
import { HouseStatus } from './house/HouseStatus';
import { Inspecting } from './inspect/Inspecting';
import { inspectBeside } from './inspect/opening';
import { Navigating } from './inspect/Navigating';
import { inspectPane } from './inspect/pane';
import { subjectsStore, type Subject } from './inspect/subjects';
import { sessionStore } from './net/gateway';
import type { BaysConfig } from './stage/bays';
import { type Along, MAP_PANE, NAVIGATION_PANE, type Pane, type PaneDef, type Room } from './stage/panes';

/**
 * Which panes stand on the stage, in which order, and what draws each.
 *
 * Each pane is declared by its feature, in its own folder, and named here once: the house status, the key
 * figures and navigation, which share the corner and stand in it in this order; the choice roll while a
 * question does; and character dialogue from the house's first dialogue on. The map comes first, because it
 * is the floor, and its contents are App's, which holds the map; a window per subject open comes last,
 * newest first. A new mechanic's pane is a declaration in its folder and a line here. The stage is handed
 * the list and reads nothing of the game. See ARCHITECTURE's "The stage is handed its panes".
 */

interface Standing {
  pane: Pane;
  /** Whether it stands, read off what the gateway has heard. Always, when absent. */
  stands?: (session: SessionState) => boolean;
  /** What draws it. Navigation is handed the panes there are to go to. */
  draw: (room: Room, along: Along, going: readonly Pane[]) => ReactNode;
}

const STANDING: readonly Standing[] = [
  { pane: HOUSE_PANE, draw: (room) => <HouseStatus room={room} /> },
  { pane: KEY_FIGURES_PANE, draw: (room) => <KeyFigures room={room} /> },
  {
    pane: NAVIGATION_PANE,
    draw: (room, along, going) => <Navigating room={room} along={along} going={going} />,
  },
  {
    pane: CHOICE_PANE,
    // At rest it is Take action, so it stands once there is a house to take it; before then only a question
    // raises it. See decision record 0083.
    stands: (session) => session.yourChoice !== null || (session.yourHouse ?? null) !== null,
    draw: (room, along) => <Choosing room={room} along={along} looking={lookingNow} />,
  },
  {
    pane: DIALOGUE_PANE,
    stands: (session) => (session.yourDialogues?.length ?? 0) > 0,
    draw: (room) => <Dialogues room={room} inspect={(thing) => inspectBeside(thing, room)} />,
  },
];

/**
 * Which of them stand, as a one or a nought each, in order: the same string for as long as nothing comes or
 * goes, so that a component can pick it from the session and be drawn again only when it changes.
 */
export function standingIn(session: SessionState): string {
  return STANDING.map((one) => ((one.stands?.(session) ?? true) ? '1' : '0')).join('');
}

/** Every pane on the stage, in order: the map, those standing, and a window per subject open, newest first. */
export function panesOn(
  standing: string,
  open: readonly Subject[],
  drawMap: PaneDef['draw'],
): readonly PaneDef[] {
  const up = STANDING.filter((_, at) => standing[at] === '1');
  // What navigation offers to go to: everything standing, the map first, and not the windows, which are in
  // the trail under their own names.
  const going = [MAP_PANE, ...up.map((one) => one.pane)];
  return [
    { ...MAP_PANE, draw: drawMap },
    ...up.map((one) => ({ ...one.pane, draw: (room: Room, along: Along) => one.draw(room, along, going) })),
    ...open.map((subject) => ({
      ...inspectPane(subject),
      draw: (room: Room, along: Along) => <Inspecting subject={subject} room={room} along={along} />,
    })),
  ];
}

/** The same now, for the bay manager, which asks what there is and not how it is drawn. */
function panesNow(): readonly Pane[] {
  return panesOn(standingIn(sessionStore.get()), subjectsStore.get().open, () => null);
}

/**
 * What the bay manager is configured with, from `main.tsx`: the panes there are, told whenever the session or
 * the subjects change - which is when one can come or go - and what the two bays hold when the page opens,
 * the map above the house.
 */
export const STAGE_PANES: BaysConfig = {
  panes: panesNow,
  watch: (listener) => {
    const session = sessionStore.watch(listener);
    const subjects = subjectsStore.watch(listener);
    return () => {
      session();
      subjects();
    };
  },
  opensOn: [MAP_PANE.id, HOUSE_PANE.id],
};
