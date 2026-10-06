/**
 * What a press on a pane put away does: opens it out, wherever on its strip it lands, unless it lands on a button
 * of its own - Take action, the size control, a window's close - which does what it says. In the spread the stage
 * does it for every pane put away, Adam's word of 2026-10-06; on a phone the letter's strip does it for itself.
 */
export function openingOut(open: () => void): (event: { target: EventTarget | null }) => void {
  return (event) => {
    if (!(event.target instanceof Element && event.target.closest('button') !== null)) open();
  };
}
