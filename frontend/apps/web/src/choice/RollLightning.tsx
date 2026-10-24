import { useMemo, useRef } from 'react';

import { useStore } from '../store/useStore';
import { Lightning } from '../ui/lightning/Lightning';
import type { Box, Strike } from '../ui/lightning/Lightning';
import { rollStrike } from './rolling';

/**
 * The lightning of a choice roll, laid over the whole stage: once a die of an uncommon, rare or legendary roll has
 * glowed at rest, a bolt in its rarity's colour from where it lies to the hand it drew, following the hand's pane as it
 * opens out so the crackle runs round its edges as they grow. The challenges' look, a leader drawn by the shader. Lets
 * the pointer through. Adam's word of 2026-10-24; see decision record 0118.
 */
export function RollLightning() {
  const strike = useStore(rollStrike, (state) => state.strike);
  const box = useRef<HTMLDivElement>(null);
  const strikes = useMemo((): readonly Strike[] => {
    const frame = box.current?.getBoundingClientRect();
    if (strike === null || frame === undefined) return [];
    // The hand once it is shown, and Take action's pane until then: where the bolt comes down, read every frame.
    const follow = (): Box | null => {
      const edges = box.current?.getBoundingClientRect();
      const pane = document.querySelector('.choice--hand') ?? document.querySelector('.choice');
      const rect = pane?.getBoundingClientRect();
      if (edges === undefined || rect === undefined) return null;
      return { x: rect.left - edges.left, y: rect.top - edges.top, width: rect.width, height: rect.height };
    };
    return [
      {
        key: strike.key,
        from: { x: strike.from.x - frame.left, y: strike.from.y - frame.top },
        to: follow() ?? { x: frame.width / 2, y: frame.height, width: 1, height: 1 },
        colour: strike.colour,
        follow,
      },
    ];
  }, [strike]);
  return (
    <div ref={box} className="choice-lightning" aria-hidden="true" data-strike={strike?.key}>
      {strikes.length > 0 && <Lightning strikes={strikes} look="leader" glow="shader" />}
    </div>
  );
}
