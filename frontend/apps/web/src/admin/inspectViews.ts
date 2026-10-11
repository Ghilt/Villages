/** Where the index of the pages that are not the game stands. */
export const INSPECT_INDEX = '/admin';

/** A page beside the game, for looking into it rather than playing it. */
export interface InspectView {
  readonly path: string;
  readonly title: string;
  /** What the page is for, in a sentence. */
  readonly what: string;
  /** What it needs running to show anything. */
  readonly needs: string;
}

/**
 * Every inspect view, in the order the index shows them. A new page beside the game is added here, and
 * `main.tsx` routes it; the index and the page's own way back read this list.
 */
export const INSPECT_VIEWS: readonly InspectView[] = [
  {
    path: '/admin/inspect-events',
    title: 'Events',
    what: 'Every event the world stores, as it is stored, and what happens next as it happens.',
    needs: 'the game server',
  },
  {
    path: '/admin/inspect-ui-components',
    title: 'Components',
    what: 'The component library: every part the interface is built from, in every variant and state.',
    needs: 'nothing',
  },
  {
    path: '/admin/inspect-architecture',
    title: 'Architecture',
    what: 'How the world is set up: what is baked beforehand, how long each step takes, and what the running game reads.',
    needs: 'nothing',
  },
];

/** Which inspect view an address is, or none. */
export function inspectViewAt(pathname: string): InspectView | undefined {
  return INSPECT_VIEWS.find((view) => pathname.startsWith(view.path));
}

/** Whether an address is the index itself. */
export function isInspectIndex(pathname: string): boolean {
  return pathname === INSPECT_INDEX || pathname === `${INSPECT_INDEX}/`;
}
