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
}

/**
 * Every inspect view, in the order the index shows them. A new page beside the game is one entry here: `main.tsx`
 * routes by this list, and the index and each page's way back read it.
 */
export const INSPECT_VIEWS: readonly InspectView[] = [
  {
    path: '/admin/inspect-events',
    title: 'Events',
    what: 'Every event the world stores, as it is stored, and what happens next as it happens.',
    needs: 'the game server',
    load: () => import('./EventLog').then((page) => page.EventLog),
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
    what: 'Every type of structure in world/structures.json: what each gives its holder, sees, holds and is called.',
    needs: 'nothing',
    load: () => import('./Structures').then((page) => page.Structures),
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
