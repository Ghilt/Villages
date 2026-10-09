/**
 * What a press on a pane put away does, wherever on its strip it lands, unless it lands on a button of its own -
 * Take action, the size control, a window's close - which does what it says. In the spread the stage opens out
 * every pane put away, Adam's word of 2026-10-06; on a phone it gives the pane below, put away and with no
 * control of its own, half each, his word of 2026-10-08. See decision record 0109.
 */
export function openingOut(open: () => void): (event: { target: EventTarget | null }) => void {
  return (event) => {
    if (!(event.target instanceof Element && event.target.closest('button') !== null)) open();
  };
}
