import { useEffect, useMemo, useRef, useState } from 'react';

import { GROUND_LATTICE, alongU, alongV, frameOf, settlementIn } from '@villages/world';
import type { LaidOut } from '@villages/world';

import { toMercatorExact } from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import { note } from '../../log/log';
import { createGroundTiles } from '../ground/groundTiles';
import type { MapSprite } from '../SpriteRenderer';

const FRAME = frameOf(GROUND_LATTICE);

/**
 * The map's sprites with every settlement among them laid out in its buildings, over the ground the flat tiles under
 * `tilesRoot` say: by `settlementIn`, from the structure's id, type and level and the culture under it, so every page
 * holding it lays it out alike (decision record 0114). One whose ground has not all come yet is left as it is, its one
 * picture, and laid out once it has. A layout is kept while its settlement is unchanged, so a sprite keeps its identity
 * and the marks keep their sprites. See docs/plans/settlements-and-roads.md.
 */
export function useSettlementLayouts(sprites: readonly MapSprite[], tilesRoot: string): readonly MapSprite[] {
  const [known, setKnown] = useState(0);
  const ground = useMemo(() => createGroundTiles(tilesRoot, () => setKnown((was) => was + 1)), [tilesRoot]);
  const laid = useRef(new Map<string, LaidOut>());
  const withLayouts = useMemo(() => {
    void known;
    const seen = new Set<string>();
    const out = sprites.map((sprite) => {
      const settlement = sprite.structure?.settlement;
      if (settlement === undefined) return sprite;
      const key = `${sprite.id}|${settlement.type}|${settlement.level}|${settlement.culture}`;
      seen.add(key);
      let layout = laid.current.get(key);
      if (layout === undefined) {
        const at = toMercatorExact(sprite.at);
        const x = at.x * WORLD_MASTER_WIDTH;
        const y = at.y * WORLD_MASTER_WIDTH;
        const u = Math.round(alongU(FRAME, x, y));
        const v = Math.round(alongV(FRAME, x, y));
        const made = settlementIn(
          sprite.id,
          settlement.type,
          settlement.level,
          settlement.culture,
          u,
          v,
          ground,
        );
        if (made === 'unknown') return sprite;
        layout = made;
        laid.current.set(key, layout);
      }
      return { ...sprite, structure: { ...sprite.structure!, laid: layout } };
    });
    for (const key of [...laid.current.keys()]) if (!seen.has(key)) laid.current.delete(key);
    return out;
  }, [sprites, ground, known]);

  const said = useRef('');
  useEffect(() => {
    const settlements = withLayouts.filter((one) => one.structure?.settlement !== undefined);
    const ready = settlements.filter((one) => one.structure?.laid !== undefined);
    const buildings = ready.reduce((sum, one) => sum + (one.structure?.laid?.buildings.length ?? 0), 0);
    const now = `${ready.length} of ${settlements.length} settlements laid out, ${buildings} buildings`;
    if (now !== said.current) {
      said.current = now;
      note('settlements', now);
    }
  }, [withLayouts]);
  return withLayouts;
}
