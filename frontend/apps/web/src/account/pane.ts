import type { Pane } from '../stage/panes';

/**
 * **The settings**, on a phone: a pane below, chosen by the gear at the far end of the bottom bar like any other, and
 * in no tile of the spread, where the gear in the stage's corner opens them in a dialog instead. Adam's word of
 * 2026-10-21: the dialog over the whole window was the desktop's size on a phone. See docs/plans/accounts.md.
 */
export const SETTINGS_PANE: Pane = {
  id: 'settings',
  title: 'settings',
  spread: null,
  tall: null,
  icon: 'settings',
  needs: null,
};
