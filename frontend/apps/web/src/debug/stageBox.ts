/**
 * How big the stage is, and what is left over for the debug panel and the blank around it.
 *
 * The debug panel is not a card floating over the world. It takes room from it, so that narrowing the
 * panel restricts the play area exactly as a smaller screen would, and Adam can see what a mechanic
 * looks like at a shape he has not got a monitor for. See decision record 0039.
 *
 * Pure arithmetic, no DOM, so the one thing the whole feel rests on can be checked by a test.
 */

/** What the debug panel is wide when nobody has dragged it: enough for its sections and no more. */
export const PANEL_WANTS = 352;

/** A typical phone in portrait, in the pixels a phone's own browser would report. A matter of taste. */
export const PHONE = { w: 390, h: 844 };

/**
 * The same phone on its side.
 *
 * A second shape rather than a rotate button, because it is checked against the portrait one rather than
 * instead of it. It is the shape that folds the stage into a **left and a right** instead of a top and a
 * bottom, which is the half of the two-bay form that a portrait phone never exercises - and it is short,
 * so it is where a pane finds out whether it can live in 390 pixels of height.
 */
export const PHONE_LANDSCAPE = { w: PHONE.h, h: PHONE.w };

/** Smaller than the narrowest phone worth designing for, and there would be nothing to look at. */
export const STAGE_LEAST = { w: 320, h: 240 };

/**
 * What the stage is being asked to be.
 *
 * `fill` is the default: the panel at the width it wants and the stage taking everything else.
 * `phone` confines the stage to {@link PHONE}. A pair of numbers is a size Adam dragged it to.
 */
export type StageMode = 'fill' | 'phone' | 'landscape' | { w: number; h: number };

/** The two shapes the toggles confine the stage to. */
export const SHAPES = { phone: PHONE, landscape: PHONE_LANDSCAPE } as const;

/** Whether a mode is one of the named shapes rather than `fill` or a size Adam dragged it to. */
export function isShape(mode: StageMode): mode is keyof typeof SHAPES {
  return mode === 'phone' || mode === 'landscape';
}

export interface Window {
  width: number;
  height: number;
}

export interface StageBox {
  /** Dead space to the left of the stage, mirroring how far past its wanted width the panel is. */
  blank: number;
  stage: { w: number; h: number };
  /** The column on the right: the panel's width, or half the leftover once it is a badge. */
  panel: number;
  /** Dead space above the stage, and the same again below it. */
  inset: number;
}

function clamp(value: number, least: number, most: number): number {
  return Math.max(least, Math.min(most, value));
}

/**
 * The panel that goes with a stage of this width.
 *
 * The rule Adam asked for: the panel has a width it wants, and every pixel it is dragged past that is
 * mirrored as blank on the other side of the stage. So `blank = panel - PANEL_WANTS`, and since
 * `blank + stage + panel = width`, the panel is half of what is left once the wanted width is put back.
 *
 * The mirror is what makes it usable. The stage's centre works out to `(width - PANEL_WANTS) / 2`
 * whatever the panel is, so dragging narrows the stage in place rather than sliding it sideways, and a
 * layout can be watched as it gives way instead of being chased across the screen.
 */
function panelFor(width: number, stage: number): number {
  const roomy = width - stage;
  return roomy >= PANEL_WANTS ? (roomy + PANEL_WANTS) / 2 : roomy;
}

/**
 * Where everything sits, given the window, what the stage is being asked to be, and whether the panel
 * is minimised to its badge.
 *
 * A shut panel takes no room, so in `fill` the stage gets the whole window. At any other size it keeps
 * that size and the leftover splits evenly either side, the way the inset already splits above and
 * below: with nothing beside it to be pushed away from, a stage jammed against one edge would read as a
 * mistake. That is the case Adam minimises for - a phone-shaped stage with nothing at all over it.
 */
export function stageBox(window: Window, mode: StageMode, panelShut: boolean): StageBox {
  const wants = panelShut ? 0 : PANEL_WANTS;
  const widest = Math.max(0, window.width - wants);

  const asked = mode === 'fill' ? { w: widest, h: window.height } : isShape(mode) ? SHAPES[mode] : mode;

  const stage = {
    w: clamp(asked.w, Math.min(STAGE_LEAST.w, window.width), widest),
    h: clamp(asked.h, Math.min(STAGE_LEAST.h, window.height), window.height),
  };

  const panel = panelShut ? (window.width - stage.w) / 2 : panelFor(window.width, stage.w);

  return {
    blank: window.width - stage.w - panel,
    stage,
    panel,
    inset: (window.height - stage.h) / 2,
  };
}

/**
 * The size a drag of the side grip is asking for.
 *
 * The grip sits on the boundary between the stage and the panel, so where it is put is where the
 * stage's right edge goes - but the blank on the left moves in with it, so the stage loses twice what
 * the pointer travelled. Reading the width off the boundary rather than off the pointer's movement is
 * what keeps the grip under the finger.
 *
 * It only ever takes room away. Dragged the other way it stops once the panel is the width it wants,
 * because that is what wanting a width means; the badge is how the stage is given the whole window.
 */
export function stageFromSideGrip(window: Window, at: number, height: number): { w: number; h: number } {
  const panel = Math.max(0, window.width - at);
  const stage = panel >= PANEL_WANTS ? window.width - panel * 2 + PANEL_WANTS : at;
  return { w: clamp(stage, STAGE_LEAST.w, Math.max(STAGE_LEAST.w, window.width - PANEL_WANTS)), h: height };
}

/**
 * The size a drag of the top grip is asking for.
 *
 * Symmetric from the first pixel, unlike the side: there is no wanted height to be eaten through first,
 * because the panel is the full height of the window whatever the stage does.
 */
export function stageFromTopGrip(window: Window, at: number, width: number): { w: number; h: number } {
  return { w: width, h: Math.max(STAGE_LEAST.h, window.height - at * 2) };
}
