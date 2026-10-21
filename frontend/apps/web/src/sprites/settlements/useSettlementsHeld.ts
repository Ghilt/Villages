import { useEffect, useMemo, useState } from 'react';

import type { SettlementsMapFile } from '@villages/world';

import { heldStandsOf, onStandsArrived, onStandsFollowed } from '../../net/stands';
import { settlementsHeld, settlementsMap } from './settlementsHeld';
import type { HeldSettlement } from './settlementsHeld';

/**
 * The settlements the page holds, named by the master's settlements map under `tilesRoot`: worked out again when a
 * tile of the `settlements` layer comes or goes, and otherwise the very same list. See `settlementsHeld.ts`.
 */
export function useSettlementsHeld(tilesRoot: string): readonly HeldSettlement[] {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((was) => was + 1);
    const stopArriving = onStandsArrived((_, __, layer) => layer === 'settlements' && bump());
    const stopFollowing = onStandsFollowed(bump);
    return () => {
      stopArriving();
      stopFollowing();
    };
  }, []);
  const [map, setMap] = useState<SettlementsMapFile | null>(null);
  useEffect(() => {
    let live = true;
    void settlementsMap(tilesRoot).then((read) => live && setMap(read));
    return () => {
      live = false;
    };
  }, [tilesRoot]);
  return useMemo(() => {
    void version;
    return settlementsHeld(
      map,
      [...heldStandsOf('settlements')].flatMap((tile) =>
        tile.settlements === undefined ? [] : [tile.settlements],
      ),
    );
  }, [map, version]);
}
