import { useMemo } from 'react';

import { BottomBar } from '../ui/bar/BottomBar';
import type { Rect } from './bayBox';
import { baysStore } from './bays';
import type { Pane } from './panes';
import { barButtons, pressInTheBar } from './phone';
import { useStore } from '../store/useStore';

/**
 * The **bottom bar**, on a phone: a mark for every pane that stands below, the one standing there lit, and a
 * press puts its pane there. It replaced the compass, which Adam found too esoteric on 2026-10-08: a disc in the
 * corner that opened a list of ways on, where this is the ways on themselves. Along the bottom of an upright
 * phone and down the right of a turned one, where `stageLayout` carves its room; the library's `BottomBar`
 * draws it. See decision record 0109.
 */
export function PhoneBar({ panes, rect }: { panes: readonly Pane[]; rect: Rect }) {
  const below = useStore(baysStore, (state) => state.holding[1]);
  const buttons = useMemo(() => barButtons(panes), [panes]);
  return (
    <div
      className="phone-bar"
      style={{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` }}
    >
      <BottomBar
        buttons={buttons}
        chosen={below}
        onPress={pressInTheBar}
        label="What stands below"
        along={rect.w >= rect.h ? 'across' : 'down'}
      />
    </div>
  );
}
