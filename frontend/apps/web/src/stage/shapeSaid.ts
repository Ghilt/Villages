import { useEffect, useRef } from 'react';

import { note } from '../log/log';
import type { Box } from './bayBox';

/**
 * One line when the stage crosses the fold or turns on its side, and none while it is merely being resized: a drag
 * that changes nothing is not news. See decision record 0023.
 */
export function useShapeSaid(form: 'spread' | 'bays', along: 'rows' | 'columns', stage: Box): void {
  const said = useRef('');
  useEffect(() => {
    const now = `${form}/${along}`;
    if (said.current !== now) {
      said.current = now;
      const cut = along === 'rows' ? 'a top and a bottom' : 'a left and a right';
      note(
        'shape',
        form === 'bays'
          ? `two bays, ${cut}, stage ${stage.w} by ${stage.h}`
          : `the spread, stage ${stage.w} by ${stage.h}`,
      );
    }
  }, [form, along, stage.w, stage.h]);
}
