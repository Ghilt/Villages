import { useEffect, useMemo, useRef, useState } from 'react';

import { note } from '../../log/log';
import { useStore } from '../../store/useStore';
import type { MapSprite } from '../SpriteRenderer';
import { createGroundTiles } from './groundTiles';
import { rememberingPaths, wearPaths } from './paths';
import { rememberingSettlementGround, rememberingWornTogether } from './settlementGround';
import { useRoadGround } from './useRoadGround';
import type { Path } from './paths';
import { workedGroundStore } from './settings';
import type { Worked } from './worked';
import { rememberingWorkedGround, yardOf } from './workedGround';

/** The worked ground with its switch off, and no paths. */
const NOTHING_WORN: ReadonlyMap<number, Worked> = new Map();
const NO_PATHS: readonly Path[] = [];

/**
 * The ground worn bare by the buildings on the map: each one's yard, each settlement's ground, streets and lanes, and
 * the paths between those nearer each other than the reach, walked over the ground the flat tiles under `tilesRoot`
 * say and worn only where `revealed` says the house has seen. Worked out again only when the buildings, the reach, the switch, the ground known or the sight
 * change, so it keeps its identity while a person on the map walks; said in the log when how much there is changes.
 * See docs/plans/worked-ground.md.
 */
export function useWorkedGround(
  sprites: readonly MapSprite[],
  tilesRoot: string,
  revealed: ((x: number, y: number) => boolean) | null,
): ReadonlyMap<number, Worked> {
  const [work] = useState(rememberingWorkedGround);
  const [walk] = useState(rememberingPaths);
  const [settle] = useState(rememberingSettlementGround);
  const [together] = useState(rememberingWornTogether);
  const [withRoads] = useState(rememberingWornTogether);
  const [known, setKnown] = useState(0);
  const ground = useMemo(() => createGroundTiles(tilesRoot, () => setKnown((was) => was + 1)), [tilesRoot]);
  const wearing = useStore(workedGroundStore, (state) => state.on);
  const reach = useStore(workedGroundStore, (state) => state.reach);

  const yards = useMemo(() => sprites.flatMap((sprite) => yardOf(sprite) ?? []), [sprites]);
  // With the switch off there is no worked ground at all: nothing drawn, and the trees grow back.
  const settled = useMemo(
    () => (wearing ? settle(sprites, ground) : null),
    [wearing, settle, sprites, ground],
  );
  const roads = useRoadGround(tilesRoot, ground, known, revealed);
  const worn = useMemo(
    () =>
      wearing ? withRoads(together(work(yards), settled?.worked ?? NOTHING_WORN), roads.worn) : NOTHING_WORN,
    [wearing, work, together, withRoads, yards, settled, roads.worn],
  );
  const paths = useMemo(
    () => (wearing && reach > 0 ? walk(yards, reach, ground, known) : NO_PATHS),
    [wearing, reach, walk, yards, ground, known],
  );
  const worked = useMemo(() => wearPaths(worn, paths, revealed), [worn, paths, revealed]);

  const said = useRef('');
  useEffect(() => {
    const settlements = yards.filter((yard) => yard.settlement).length;
    const now =
      `${worked.size} diamonds of worked ground under ${yards.length - settlements} buildings and ${settlements} ` +
      `settlements, ${paths.length} paths and ${settled?.lanes ?? 0} lanes, and ${roads.pieces} pieces of road`;
    if (now !== said.current) {
      said.current = now;
      note('ground', now);
    }
  }, [worked, yards, paths, settled, roads.pieces]);
  return worked;
}
