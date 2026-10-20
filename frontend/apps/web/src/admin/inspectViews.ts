import type { ComponentType } from 'react';

import { INSPECT_INDEX } from './address';

export { INSPECT_INDEX };

/** A page beside the game, for looking into it rather than playing it. */
export interface InspectView {
  readonly path: string;
  readonly title: string;
  /** What the page is for, in a sentence. */
  readonly what: string;
  /** What it needs running to show anything. */
  readonly needs: string;
  /** The page, fetched with `import()` only when it is opened, so none of it is in the game's bundle (0091). */
  readonly load: () => Promise<ComponentType>;
  /**
   * The catalogue it shows and edits, by its name on the shelf, `world/catalogues/<name>.json` or the folder
   * `world/catalogues/<name>/`, when it shows one. Every catalogue has a page, which `catalogues.test.ts` holds.
   */
  readonly catalogue?: string;
}

/**
 * Every inspect view, in the order the index shows them. A new page beside the game is one entry here: `main.tsx`
 * routes by this list, and the index and each page's way back read it.
 */
export const INSPECT_VIEWS: readonly InspectView[] = [
  {
    path: '/admin/inspect-events',
    title: 'Events',
    what: 'Every type of event the world can record, as docs/EVENTS.md lists them: what each carries and means, what writes it and reads it, and a sample.',
    needs: 'nothing',
    load: () => import('./events/Events').then((page) => page.Events),
  },
  {
    path: '/admin/inspect-events-log',
    title: 'Events log',
    what: 'Every event the world stores, as it is stored, and what happens next as it happens.',
    needs: 'the game server',
    load: () => import('./EventLog').then((page) => page.EventLog),
  },
  {
    path: '/admin/inspect-logs',
    title: 'Logs',
    what: "The debug panel's log, from every window of the game open in this browser, as each writes it.",
    needs: 'the game open in this browser',
    load: () => import('./logs/Logs').then((page) => page.Logs),
  },
  {
    path: '/admin/inspect-ui-components',
    title: 'Components',
    what: 'The component library: every part the interface is built from, in every variant and state.',
    needs: 'nothing',
    // Fetched only here, so neither the library nor its fonts and pictures are part of the game's bundle.
    load: () => import('./UiComponents').then((page) => page.UiComponents),
  },
  {
    path: '/admin/inspect-structures',
    title: 'Structures',
    what: 'Every type of structure in world/catalogues/structures.json: what each gives its holder, sees, holds and is called.',
    needs: 'nothing to read, the game server to save',
    load: () => import('./Structures').then((page) => page.Structures),
    catalogue: 'structures',
  },
  {
    path: '/admin/inspect-balance',
    title: 'Balance',
    what: 'The numbers that belong to no one thing: what a roll costs and deals, when an omen is read, how old a newcomer is.',
    needs: 'nothing to read, the game server to save',
    load: () => import('./Balance').then((page) => page.Balance),
    catalogue: 'balance',
  },
  {
    path: '/admin/inspect-rolls',
    title: 'Rolls',
    what: 'The pools a choice roll opens and the actions it deals from them: what opens each, and what each deals.',
    needs: 'nothing to read, the game server to save',
    load: () => import('./rolls/Rolls').then((page) => page.Rolls),
    catalogue: 'fate',
  },
  {
    path: '/admin/inspect-character-names',
    title: 'Character names',
    what: 'The names a newcomer can be given: given names by sex, and family names.',
    needs: 'nothing to read, the game server to save',
    load: () => import('./CharacterNames').then((page) => page.CharacterNames),
    catalogue: 'character-names',
  },
  {
    path: '/admin/inspect-dialogues',
    title: 'Dialogues',
    what: 'Every dialogue there is to offer, a file each: who speaks, what is said, and where each line leads.',
    needs: 'nothing to read, the game server to save',
    load: () => import('./dialogues/Dialogues').then((page) => page.Dialogues),
    catalogue: 'dialogues',
  },
  {
    path: '/admin/inspect-quests',
    title: 'Quests',
    what: 'Every quest there is to offer, a file each: its road of nodes, the dialogues they offer, their objectives and rewards.',
    needs: 'nothing to read, the game server to save',
    load: () => import('./quests/Quests').then((page) => page.Quests),
    catalogue: 'quests',
  },
  {
    path: '/admin/inspect-challenges',
    title: 'Challenges',
    what: 'Every effect a slice can carry, in the five pairs of aspects, the summons they bring, and the kinds of challenge.',
    needs: 'nothing to read, the game server to save',
    load: () => import('./challenges/Challenges').then((page) => page.Challenges),
    catalogue: 'challenges',
  },
  {
    path: '/admin/inspect-story',
    title: 'Story',
    what: "The world's history as a timeline, docs/STORY.md drawn: the gods, the ritual, and the day the houses begin.",
    needs: 'nothing',
    load: () => import('./story/Story').then((page) => page.Story),
  },
  {
    path: '/admin/inspect-pictures',
    title: 'Pictures',
    what: 'Every picture the world is drawn with - scenery, structures, marks, portraits, scenes - painted or a placeholder.',
    needs: 'nothing',
    load: () => import('./pictures/Pictures').then((page) => page.Pictures),
  },
  {
    path: '/admin/inspect-renders',
    title: 'Renders',
    what: "A square of every kind of land and of every critter, drawn by the map's own shaders side by side at one zoom.",
    needs: 'nothing',
    load: () => import('./renders/InspectRenders').then((page) => page.InspectRenders),
  },
  {
    path: '/admin/inspect-performance',
    title: 'Performance',
    what: 'What the game costs to run, as it is built: what the shaders cost the graphics card at fixed places, how long the game takes to start and where that time goes, how smoothly the camera zooms in and what the sprites cost it, how long the tests take, and how many players one game server carries before it bends.',
    needs: 'nothing',
    load: () => import('./performance/Performance').then((page) => page.Performance),
  },
  {
    path: '/admin/inspect-architecture',
    title: 'Architecture',
    what: 'How the world is set up: what is baked beforehand, how long each step takes, and what the running game reads.',
    needs: 'nothing',
    load: () => import('./architecture/InspectArchitecture').then((page) => page.InspectArchitecture),
  },
];

/** Which inspect view an address is - its own path or one under it - or none. */
export function inspectViewAt(pathname: string): InspectView | undefined {
  return INSPECT_VIEWS.find((view) => pathname === view.path || pathname.startsWith(`${view.path}/`));
}

/** Whether an address is the index itself. */
export function isInspectIndex(pathname: string): boolean {
  return pathname === INSPECT_INDEX || pathname === `${INSPECT_INDEX}/`;
}
