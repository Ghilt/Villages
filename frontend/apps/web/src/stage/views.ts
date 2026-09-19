import { subjectOfView, subjectsNow, viewIdOf } from '../inspect/subjects';
import type { Subject } from '../inspect/subjects';
import type { Asking } from './paneBox';

/**
 * What can occupy a pane, and what each one asks for.
 *
 * A view is declared here and placed by the layout. Nothing in the layout knows what a map is, and no view
 * learns which pane it is in beyond the room it was given - which is what lets a mechanic be written once
 * and drawn at up to three sizes. See decision record 0040.
 *
 * Two of them are fixed and the rest come and go: an **inspect window** is a view per subject, so the list
 * grows as the player opens them. Character dialogue will be another fixed one.
 */

export interface View {
  /** What the pane manager addresses it by, and what the debug log says. */
  id: string;
  /** What the kebab calls it, and what a minimised strip has written on it. */
  title: string;
  /** What its pane asks for when it is not minimised. */
  wants: 'big' | 'small';
  /** The pixels it needs when its pane is the small one. Unread when it wants to be big. */
  small: number;
  /** The pixels its strip is when minimised, or null when minimising it would leave nothing worth seeing. */
  strip: number | null;
}

export const MAP_VIEW: View = {
  id: 'map',
  title: 'the map',
  wants: 'big',
  small: 200,
  // A strip of map is not a map. Whether the player should be able to put the world away entirely to read
  // something long is a real question and `RESPONSIVE-DESIGN.md` has it open; until then, no.
  strip: null,
};

export const HOUSE_VIEW: View = {
  id: 'house',
  title: 'your house',
  wants: 'small',
  // Enough for one line of the house and the bar of its levers beneath. The bar is 2.6rem of it.
  small: 132,
  // The name and nothing else, so the player knows where it went.
  strip: 44,
};

export const FIXED_VIEWS: readonly View[] = [MAP_VIEW, HOUSE_VIEW];

/**
 * The view that holds a window on one subject.
 *
 * It **wants to be big**, which is what makes Adam's example come out right: the map wants to be big too,
 * so two panes asking the same thing get half each and an opened window takes half the screen with the
 * thing it is about still on the map above it.
 */
export function inspectView(subject: Subject): View {
  return {
    id: viewIdOf(subject),
    title: subject.kind === 'house' ? 'a house' : 'an area',
    wants: 'big',
    small: 220,
    strip: 44,
  };
}

/**
 * Every view there is: the two fixed ones, then a window per subject, newest first.
 *
 * Takes the subjects rather than reading them, so that it is pure and a component can memoise it against
 * exactly what it depends on.
 */
export function viewsFor(open: readonly Subject[]): readonly View[] {
  return [...FIXED_VIEWS, ...open.map(inspectView)];
}

/** The same, for callers outside a render that have no subjects in hand. */
export function viewsNow(): readonly View[] {
  return viewsFor(subjectsNow().open);
}

export function viewById(id: string): View | undefined {
  const fixed = FIXED_VIEWS.find((view) => view.id === id);
  if (fixed !== undefined) {
    return fixed;
  }
  const subject = subjectOfView(id);
  // Built rather than looked up: a window's view is a description of its subject, and the subject store is
  // the only place that knows whether it is still open.
  return subject !== null && subjectsNow().open.some((one) => viewIdOf(one) === id)
    ? inspectView(subject)
    : undefined;
}

/** The three sizes a view can be drawn at. Not every view has all three. */
export type ViewSize = 'full' | 'small' | 'strip';

/** What a view is handed: the room it got, and the way to give it back. Nothing about which pane it is in. */
export interface Room {
  size: ViewSize;
  /** Collapse to a strip, or open back up. Null when this view has no strip to collapse to. */
  minimise: (() => void) | null;
}

/**
 * What a pane holding this view asks the layout for.
 *
 * Minimising is not a case the arithmetic knows about: a minimised view asks for a smaller number than a
 * small one does, and that is the whole of it. A view that cannot be minimised asks for what it wanted.
 */
export function askingOf(view: View | undefined, minimised: boolean): Asking {
  if (view === undefined) {
    return 'big';
  }
  if (minimised && view.strip !== null) {
    return { small: view.strip };
  }
  return view.wants === 'small' ? { small: view.small } : 'big';
}

/**
 * How big a view draws itself, given the form, what its pane asked for and whether it is collapsed.
 *
 * In the spread everything is full, because nothing is competing for the room: a view asks to be small so
 * that the *other* pane can have the rest, and in the spread there is no other pane. That is why the house
 * card in the corner is the same card it always was, and only a phone ever sees the small one.
 */
export function sizeOf(form: 'spread' | 'panes', asking: Asking, minimised: boolean): ViewSize {
  if (minimised) {
    return 'strip';
  }
  if (form === 'spread') {
    return 'full';
  }
  return typeof asking === 'object' ? 'small' : 'full';
}
