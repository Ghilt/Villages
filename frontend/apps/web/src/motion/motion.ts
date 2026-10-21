/**
 * Whether the world moves: the clouds, the water, the creatures, the trees and the grass in the wind, the haze, the
 * pulse round an area and the light that runs along water a click picked. As the device asks unless the player has
 * said otherwise in the settings, still or moving, and read afresh every time it is asked, so a change shows on the
 * next frame. The interface's own short transitions follow the device alone: a stylesheet's media query cannot be
 * told otherwise from here. See docs/plans/accounts.md.
 */

/** How the player asked the world to move: as their device asks, still, or moving whatever the device asks. */
export type Motion = 'device' | 'still' | 'moving';

let asked: Motion = 'device';

/** The player's choice, as their settings say it. */
export function moveAs(motion: Motion): void {
  asked = motion;
}

/** Whether the world is to hold still now. */
export function worldStill(): boolean {
  if (asked === 'still') return true;
  if (asked === 'moving') return false;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
