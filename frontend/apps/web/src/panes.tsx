import type { ReactNode } from 'react';

import type { SessionState } from '@villages/client-core';

import { SETTINGS_PANE } from './account/pane';
import { SettingsPane } from './account/SettingsPane';
import { CHALLENGE_PANE } from './challenges/pane';
import { Challenges } from './challenges/Challenges';
import { anyWaiting } from './challenges/describe';
import { chooseFor } from './challenges/toChoose';
import { CHOICE_AT_REST, CHOICE_PANE } from './choice/pane';
import { Choosing } from './choice/Choosing';
import { lookingNow } from './looking';
import { DIALOGUE_PANE } from './dialogues/pane';
import { QUEST_PANE } from './quests/pane';
import { Quests } from './quests/Quests';
import { openQuest } from './quests/toOpen';
import { arrive } from './stage/arrive';
import { Dialogues } from './dialogues/Dialogues';
import { KEY_FIGURES_PANE } from './figures/pane';
import { KeyFigures } from './figures/KeyFigures';
import { HOLDINGS_PANE } from './holdings/pane';
import { Holdings } from './holdings/Holdings';
import { HOUSE_PANE } from './house/pane';
import { HouseStatus } from './house/HouseStatus';
import { Inspecting } from './inspect/Inspecting';
import { inspectBeside, sizeWindow } from './inspect/opening';
import { Navigating } from './inspect/Navigating';
import { inspectPane } from './inspect/pane';
import { subjectsStore, type Subject } from './inspect/subjects';
import { sessionStore } from './net/gateway';
import type { BaysConfig } from './stage/bays';
import {
  type Along,
  MAP_PANE,
  NAVIGATION_PANE,
  type Pane,
  type PaneDef,
  type PaneSize,
  type Room,
} from './stage/panes';

/**
 * Which panes stand on the stage, in which order, and what draws each.
 *
 * Each pane is declared by its feature, in its own folder, and named here once: the house status, the key
 * figures and the holdings, which share the corner; the choice roll while a question does, and at rest once there
 * is a house; character dialogue from the house's first dialogue on, the quests from the first quest on, and the
 * challenges while one waits to be chosen for and from the first fought on, which take turns in the column down the
 * right; Recent, last in the corner; and on a phone the settings, last of the
 * bottom bar, whose marks stand in this order, and in no tile of the spread. The map comes first, because it
 * is the floor, and its contents are App's, which holds the map; a window per subject open comes last,
 * newest first. A new mechanic's pane is a declaration in its folder and a line here. The stage is handed
 * the list and reads nothing of the game. See ARCHITECTURE's "The stage is handed its panes".
 */

interface Standing {
  pane: Pane;
  /** Whether it stands, read off what the gateway has heard. Always, when absent. */
  stands?: (session: SessionState) => boolean;
  /** What draws it. */
  draw: (room: Room, along: Along) => ReactNode;
}

/** Turn to a quest from a conversation that is part of it: its tab comes up, on the quest's map. See 0096. */
function turnToQuest(questId: string): void {
  openQuest(questId);
  arrive(QUEST_PANE.id, { inTheSpread: 'small' });
}

/**
 * Turn to the challenge a quest's node puts: the challenges' tab comes up on its choosing, the house's slices to bring.
 * See decision record 0107, amended.
 */
function turnToChallenge(questId: string, nodeId: string): void {
  chooseFor({ questId, nodeId });
  arrive(CHALLENGE_PANE.id, { inTheSpread: 'small' });
}

const STANDING: readonly Standing[] = [
  { pane: HOUSE_PANE, draw: (room) => <HouseStatus room={room} /> },
  { pane: KEY_FIGURES_PANE, draw: (room) => <KeyFigures room={room} /> },
  { pane: HOLDINGS_PANE, draw: (room) => <Holdings room={room} /> },
  {
    pane: CHOICE_PANE,
    // A question asked, or a hand dealt; before there is a house only a question raises it. See 0083.
    stands: (session) => session.yourChoice !== null,
    draw: (room, along) => <Choosing room={room} along={along} looking={lookingNow} />,
  },
  {
    // At rest it is Take action, so it stands once there is a house to take it: the same pane, shorter opened
    // out, because all it has to say is the button. See decision record 0085.
    pane: CHOICE_AT_REST,
    stands: (session) => session.yourChoice === null && (session.yourHouse ?? null) !== null,
    draw: (room, along) => <Choosing room={room} along={along} looking={lookingNow} />,
  },
  {
    pane: DIALOGUE_PANE,
    stands: (session) => (session.yourDialogues?.length ?? 0) > 0,
    draw: (room) => (
      <Dialogues room={room} inspect={(thing) => inspectBeside(thing, room)} toQuest={turnToQuest} />
    ),
  },
  {
    // Beside the dialogues, taking turns with them in the column down the right edge. See decision record 0096.
    pane: QUEST_PANE,
    stands: (session) => (session.yourQuests?.length ?? 0) > 0,
    draw: (room) => <Quests room={room} toChallenge={turnToChallenge} />,
  },
  {
    // Beside the quests, while one stands at a challenge to be chosen for, and from the first challenge fought on,
    // because the fought ones are kept to be looked back on. See decision record 0107, amended.
    pane: CHALLENGE_PANE,
    stands: (session) => anyWaiting(session.yourQuests ?? []) || (session.yourChallenges?.length ?? 0) > 0,
    draw: (room) => <Challenges room={room} toQuest={turnToQuest} />,
  },
  { pane: NAVIGATION_PANE, draw: (room) => <Navigating room={room} /> },
  { pane: SETTINGS_PANE, draw: (room) => <SettingsPane room={room} /> },
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
  return [
    { ...MAP_PANE, draw: drawMap },
    ...up.map((one) => ({ ...one.pane, draw: one.draw })),
    ...open.map((subject) => ({
      ...inspectPane(subject),
      // Opened in the spread, a window comes to the top of the rail, as asking for it from the map does.
      ask: (size: PaneSize) => sizeWindow(subject, size),
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
