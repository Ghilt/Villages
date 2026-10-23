import { useEffect, useMemo, useRef, useState } from 'react';

import type { SettlementsMapFile } from '@villages/world';

import { heldStandsOf, onStandsArrived, onStandsFollowed, standsVersion } from '../../net/stands';
import { sameSettlement, settlementsHeld, settlementsMap } from './settlementsHeld';
import type { HeldSettlement } from './settlementsHeld';

/** The same list again when it holds the same settlements, so nothing downstream works them out again for nothing. */
function sameAs(was: readonly HeldSettlement[], now: readonly HeldSettlement[]): boolean {
  return was.length === now.length && was.every((one, at) => sameSettlement(one, now[at]!));
}

/**
 * The settlements the page holds, named by the master's settlements map under `tilesRoot`: worked out again when a
 * tile of the `settlements` layer comes or goes - its version, not every step of the camera - and otherwise the very
 * same list. See `settlementsHeld.ts`.
 */
export function useSettlementsHeld(tilesRoot: string): readonly HeldSettlement[] {
  const [version, setVersion] = useState(() => standsVersion('settlements'));
  useEffect(() => {
    const bump = () => setVersion(standsVersion('settlements'));
    const stopArriving = onStandsArrived((_, __, layer) => layer === 'settlements' && bump());
    const stopFollowing = onStandsFollowed(bump);
    bump();
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
  const last = useRef<readonly HeldSettlement[]>([]);
  return useMemo(() => {
    void version;
    const now = settlementsHeld(
      map,
      [...heldStandsOf('settlements')].flatMap((tile) =>
        tile.settlements === undefined ? [] : [tile.settlements],
      ),
    );
    if (sameAs(last.current, now)) return last.current;
    last.current = now;
    return now;
  }, [map, version]);
}
