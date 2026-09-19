import { isShape, type StageMode } from './stageBox';

/**
 * How the debug panel and the stage are arranged, remembered between reloads.
 *
 * A module store in the same shape as the eye, the log and the selection, so that the panel's header
 * can set it and the app can read it without either knowing about the other. Whether the panel is
 * shut lives here rather than inside the panel because the stage's size depends on it: a panel
 * minimised to its badge is a panel of no width, and the room has to go somewhere.
 */

const REMEMBERED = 'villages.debug.stage';
const OPEN_KEY = 'villages.debug.open';

function readBack(): StageMode {
  try {
    const kept = localStorage.getItem(REMEMBERED);
    if (kept !== null && isShape(kept as StageMode)) {
      return kept as StageMode;
    }
    const dragged = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(kept ?? '');
    return dragged === null ? 'fill' : { w: Number(dragged[1]), h: Number(dragged[2]) };
  } catch {
    // A browser that will not remember the size is not a reason to fail.
    return 'fill';
  }
}

function shutToBegin(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === 'no';
  } catch {
    // Not being able to read the choice means showing the panel, which is the safer of the two.
    return false;
  }
}

let mode: StageMode = readBack();
let shut = shutToBegin();
let listeners: Array<() => void> = [];

export function stageMode(): StageMode {
  return mode;
}

export function panelIsShut(): boolean {
  return shut;
}

export function watchStage(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((kept) => kept !== listener);
  };
}

function tellThem(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function setStage(next: StageMode): void {
  mode = next;
  try {
    localStorage.setItem(
      REMEMBERED,
      typeof next === 'string' ? next : `${Math.round(next.w)}x${Math.round(next.h)}`,
    );
  } catch {
    // As above: the size not surviving a reload is a smaller loss than not being able to set it.
  }
  tellThem();
}

/**
 * Minimise the panel to its badge, or bring it back.
 *
 * The stage keeps whatever size it had. In `fill` that means it takes the whole window, and at any
 * other size it stays that size with the room around it blank - which is the case this is for: a
 * phone-shaped stage with nothing whatever over it.
 */
export function setPanelShut(next: boolean): void {
  shut = next;
  try {
    localStorage.setItem(OPEN_KEY, next ? 'no' : 'yes');
  } catch {
    // A browser that will not remember the choice is not a reason to fail.
  }
  tellThem();
}

/**
 * The toggles in the very top right: a phone shape, or back to whatever the stage was before.
 *
 * Two of them, a phone and the same phone in landscape. Pressing one while the other is on switches between
 * shapes rather than going back to `fill`, which is the comparison they are there to make. Leaving a shape
 * goes back to `fill` rather than to the last dragged size, because each toggle is asked for as two states
 * and a third remembered one would make it read as three.
 */
export function toggleShape(shape: 'phone' | 'landscape'): void {
  setStage(mode === shape ? 'fill' : shape);
}
