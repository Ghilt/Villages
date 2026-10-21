import type { ReactNode } from 'react';

import type { BayLayout, Box } from './bayBox';
import type { StageLayout } from './stageLayout';

/**
 * How far in from the stage's right edge the corner's mark stands, the settings', in the spread: just clear of the
 * column down the right edge when one is up, so it never stands on the column's tabs.
 */
export function cornerRight(stage: Box, box: BayLayout): number {
  return box.form === 'spread' ? stage.w - (box.bays.right?.x ?? stage.w) : 0;
}

/**
 * The stage's top right corner, in no bay, where the settings' mark stands in the spread. Only where there is no
 * bottom bar: on a phone the settings are a pane, chosen in the bar like any other.
 */
export function Corner({ stage, box, children }: { stage: Box; box: StageLayout; children?: ReactNode }) {
  if (box.bar !== null || children === undefined) {
    return null;
  }
  return (
    <div className="stage__corner" style={{ right: cornerRight(stage, box) }}>
      {children}
    </div>
  );
}
