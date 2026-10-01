/**
 * Where a tooltip goes: centred over what it is about, above it unless there is no room above and there is
 * room below, and never past the window's edge. Pure, so that where it lands is a test.
 */

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export type Side = 'above' | 'below';

/** How far a tooltip stands off what it is about, and off the window's edge, in pixels. */
export const TOOLTIP_GAP = 8;
export const TOOLTIP_MARGIN = 8;

/**
 * Whether any of what a tooltip is about is in the window. One about something scrolled out of sight is not
 * drawn, rather than turned to whichever side has room, which would bring it back into sight about nothing.
 */
export function inWindow(anchor: Rect, window: { readonly width: number; readonly height: number }): boolean {
  return (
    anchor.top + anchor.height > 0 &&
    anchor.top < window.height &&
    anchor.left + anchor.width > 0 &&
    anchor.left < window.width
  );
}

export function placeTooltip(
  anchor: Rect,
  box: { readonly width: number; readonly height: number },
  window: { readonly width: number; readonly height: number },
  prefer: Side = 'above',
): { left: number; top: number; side: Side } {
  const fitsAbove = anchor.top - TOOLTIP_GAP - box.height >= TOOLTIP_MARGIN;
  const fitsBelow = anchor.top + anchor.height + TOOLTIP_GAP + box.height <= window.height - TOOLTIP_MARGIN;
  const side: Side =
    prefer === 'above'
      ? fitsAbove || !fitsBelow
        ? 'above'
        : 'below'
      : fitsBelow || !fitsAbove
        ? 'below'
        : 'above';
  const top =
    side === 'above' ? anchor.top - TOOLTIP_GAP - box.height : anchor.top + anchor.height + TOOLTIP_GAP;
  const centred = anchor.left + anchor.width / 2 - box.width / 2;
  const left = Math.max(TOOLTIP_MARGIN, Math.min(window.width - TOOLTIP_MARGIN - box.width, centred));
  return { left: Math.round(left), top: Math.round(top), side };
}
