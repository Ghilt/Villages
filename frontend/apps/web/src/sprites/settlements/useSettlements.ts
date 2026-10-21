import { useEffect, useMemo, useRef, useState } from 'react';

import { GROUND_LATTICE, SETTLEMENT_SIDES, alongU, alongV, frameOf, settlementIn } from '@villages/world';
import type { LaidOut } from '@villages/world';

import { fromMercator, toMercatorExact } from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import { note } from '../../log/log';
import { cultureOfPlace, useCultureMap } from '../../map/culture';
import { createGroundTiles } from '../ground/groundTiles';
import type { MapSprite } from '../SpriteRenderer';
import { settlementAt } from './settlementsHeld';
import type { HeldSettlement } from './settlementsHeld';
import { useSettlementsHeld } from './useSettlementsHeld';

const FRAME = frameOf(GROUND_LATTICE);
const UNTINTED = 0xffffff;

/** The map's name for a settlement, which no structure is called: `settlement:` and its number. */
export function settlementSpriteId(index: number): string {
  return `settlement:${index}`;
}

/**
 * The map's sprites with the settlements the page holds among them, and every structure inside one told which: each
 * settlement a sprite of its own, laid out over the ground the flat tiles under `tilesRoot` say by `settlementIn`,
 * from its site's id, type and level and the culture under it - its square, its streets, its jetties, net racks and
 * boats, which are no structures - and drawn as its ground and that dress; every structure whose place its radius
 * holds, the nearest middle's where two do, stands among the trees together with it (decision record 0117). A
 * settlement whose ground has not all come yet has no layout until it has. Sprites keep their identity while nothing
 * about them changes, so the marks keep their sprites.
 */
export function useSettlements(given: readonly MapSprite[], tilesRoot: string): readonly MapSprite[] {
  const [known, setKnown] = useState(0);
  const ground = useMemo(() => createGroundTiles(tilesRoot, () => setKnown((was) => was + 1)), [tilesRoot]);
  const cultures = useCultureMap();
  const held = useSettlementsHeld(tilesRoot);

  const laid = useRef(new Map<string, LaidOut>());
  const made = useRef(new Map<string, MapSprite>());
  const marked = useRef(new WeakMap<MapSprite, { partOf: string | null; sprite: MapSprite }>());

  const out = useMemo(() => {
    void known;
    const seen = new Set<string>();
    const settlements = held.map((one) => {
      const at = fromMercator({ x: one.x / WORLD_MASTER_WIDTH, y: one.y / WORLD_MASTER_WIDTH });
      const culture = cultureOfPlace(cultures, { lat: at.lat, lon: at.lng }) ?? 'european';
      const key = `${one.id}|${one.type}|${one.level}|${culture}`;
      seen.add(key);
      let layout = laid.current.get(key);
      if (layout === undefined) {
        const u = Math.round(alongU(FRAME, one.x, one.y));
        const v = Math.round(alongV(FRAME, one.x, one.y));
        const next = settlementIn(one.id, one.type, one.level, culture, u, v, ground);
        if (next !== 'unknown') {
          layout = next;
          laid.current.set(key, next);
        }
      }
      const spriteKey = `${key}|${layout === undefined ? 'waiting' : 'laid'}|${one.name}`;
      const was = made.current.get(spriteKey);
      if (was !== undefined) return was;
      const sprite = settlementSprite(one, at, culture, layout);
      made.current.set(spriteKey, sprite);
      return sprite;
    });
    for (const key of [...laid.current.keys()]) if (!seen.has(key)) laid.current.delete(key);
    for (const key of [...made.current.keys()]) {
      if (!seen.has(key.split('|').slice(0, 4).join('|'))) made.current.delete(key);
    }
    const inside = given.map((sprite) => {
      if (sprite.kind !== 'structure') return sprite;
      const at = toMercatorExact(sprite.at);
      const one = settlementAt(held, at.x * WORLD_MASTER_WIDTH, at.y * WORLD_MASTER_WIDTH);
      const partOf = one === null ? null : `${settlementSpriteId(one.index)}|${one.name}`;
      const was = marked.current.get(sprite);
      if (was !== undefined && was.partOf === partOf) return was.sprite;
      const next =
        one === null ? sprite : { ...sprite, partOf: { id: settlementSpriteId(one.index), name: one.name } };
      marked.current.set(sprite, { partOf, sprite: next });
      return next;
    });
    return [...settlements, ...inside];
  }, [given, held, cultures, ground, known]);

  const said = useRef('');
  useEffect(() => {
    const ready = out.filter((one) => one.structure?.laid !== undefined).length;
    const parts = out.filter((one) => one.partOf !== undefined).length;
    const now = `${held.length} settlements held, ${ready} laid out, ${parts} structures standing in them`;
    if (now !== said.current) {
      said.current = now;
      note('settlements', now);
    }
  }, [out, held]);
  return out;
}

/** A settlement as the map draws it: no picture of its own, its square of ground, and its dress once laid out. */
function settlementSprite(
  one: HeldSettlement,
  at: { lng: number; lat: number },
  culture: NonNullable<ReturnType<typeof cultureOfPlace>>,
  laid: LaidOut | undefined,
): MapSprite {
  return {
    id: settlementSpriteId(one.index),
    at,
    tint: UNTINTED,
    kind: 'structure',
    significance: 0,
    name: one.name,
    structure: {
      picture: '',
      footprint: SETTLEMENT_SIDES[Math.max(0, Math.min(2, one.level - 1))],
      settlement: { type: one.type, level: one.level, culture },
      ...(laid === undefined ? {} : { laid }),
    },
  };
}
