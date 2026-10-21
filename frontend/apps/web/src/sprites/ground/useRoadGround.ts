import { useEffect, useMemo, useRef, useState } from 'react';

import type { RoadsMapFile } from '@villages/world';

import { heldStandsOf, onStandsArrived, onStandsFollowed } from '../../net/stands';
import { useStore } from '../../store/useStore';
import type { GroundOf } from './paths';
import { piecesHeld, roadsMap, wearRoads } from './roads';
import { workedGroundStore } from './settings';
import type { Worked } from './worked';

const NOTHING_WORN: ReadonlyMap<number, Worked> = new Map();

/**
 * The roads worn into the ground from the pieces of the `roads` layer the page holds, as wide as the master's roads map
 * says each grade is drawn times the width lever, over `ground` and only where `revealed` says: worked out again when a
 * tile of roads comes or goes, the ground known grows (`known`), the sight changes or a lever moves, and otherwise the
 * very same map, so the scenery is not sorted again for nothing. See `roads.ts`.
 */
export function useRoadGround(
  tilesRoot: string,
  ground: GroundOf,
  known: number,
  revealed: ((x: number, y: number) => boolean) | null,
): { worn: ReadonlyMap<number, Worked>; pieces: number } {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((was) => was + 1);
    const stopArriving = onStandsArrived((_, __, layer) => layer === 'roads' && bump());
    const stopFollowing = onStandsFollowed(bump);
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

  const pieces = useMemo(() => {
    void version;
    return piecesHeld(
      [...heldStandsOf('roads')].flatMap((tile) => (tile.roads === undefined ? [] : [tile.roads])),
    );
  }, [version]);
  // The ground known grows as its tiles come, which seldom changes a road: the map before it is kept when it is the same.
  const last = useRef<ReadonlyMap<number, Worked>>(NOTHING_WORN);
  const worn = useMemo(() => {
    void known;
    const now =
      wearing && widths !== null ? wearRoads(pieces, widths, scale, ground, revealed) : NOTHING_WORN;
    const was = last.current;
    if (now.size === was.size && [...now].every(([key, kind]) => was.get(key) === kind)) return was;
    last.current = now;
    return now;
  }, [wearing, widths, pieces, scale, ground, revealed, known]);
  return { worn, pieces: pieces.length };
}
