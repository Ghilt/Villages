import { useEffect, useMemo, useRef, useState } from 'react';

import type { RoadsMapFile } from '@villages/world';

import { onStandsArrived, onStandsFollowed, standsVersion } from '../../net/stands';
import { useStore } from '../../store/useStore';
import type { GroundOf } from './paths';
import { rememberingWornRoads, roadsHeld, roadsMap } from './roads';
import { workedGroundStore } from './settings';
import type { Worked } from './worked';

const NOTHING_WORN: ReadonlyMap<number, Worked> = new Map();

/**
 * The roads worn into the ground from the pieces of the `roads` layer the page holds, as wide as the master's roads map
 * says each grade is drawn times the width lever, over `ground` and only where `revealed` says: worked out again when the
 * roads held change (their layer's version), the ground known grows under a road still waiting on it (`known`), the
 * sight changes or a lever moves, and otherwise the very same map, so the scenery is not asked again for nothing. See
 * `roads.ts`.
 */
export function useRoadGround(
  tilesRoot: string,
  ground: GroundOf,
  known: number,
  revealed: ((x: number, y: number) => boolean) | null,
): { worn: ReadonlyMap<number, Worked>; pieces: number } {
  // The version alone, so a step of the camera over the same tiles renders nothing again.
  const [version, setVersion] = useState(() => standsVersion('roads'));
  useEffect(() => {
    const look = () => setVersion(standsVersion('roads'));
    const stopArriving = onStandsArrived((_, __, layer) => layer === 'roads' && look());
    const stopFollowing = onStandsFollowed(look);
    look();
    return () => {
      stopArriving();
      stopFollowing();
    };
  }, []);
  const [widths, setWidths] = useState<RoadsMapFile['widths'] | null>(null);
  useEffect(() => {
    let current = true;
    void roadsMap(tilesRoot).then((file) => current && setWidths(file?.widths ?? null));
    return () => {
      current = false;
    };
  }, [tilesRoot]);
  const wearing = useStore(workedGroundStore, (state) => state.on);
  const scale = useStore(workedGroundStore, (state) => state.roadWidth);
  const [wear] = useState(rememberingWornRoads);

  const pieces = useMemo(() => {
    void version;
    return roadsHeld();
  }, [version]);
  // The ground known grows as its tiles come, which seldom changes a road: the map before it is kept when it is the same.
  const last = useRef<ReadonlyMap<number, Worked>>(NOTHING_WORN);
  const worn = useMemo(() => {
    const now =
      wearing && widths !== null ? wear(pieces, widths, scale, ground, revealed, known) : NOTHING_WORN;
    const was = last.current;
    if (now === was || (now.size === was.size && [...now].every(([key, kind]) => was.get(key) === kind))) {
      return was;
    }
    last.current = now;
    return now;
  }, [wearing, widths, wear, pieces, scale, ground, revealed, known]);
  return { worn, pieces: pieces.length };
}
