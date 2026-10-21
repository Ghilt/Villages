import { useState } from 'react';

import { CULTURES, jettyKey, onStreet, settlementIn, settlementPieceKey } from '@villages/world';
import type { Culture, FootingOf, SettlementType } from '@villages/world';

import { onScreen } from './footing';
import { useAtlas } from './frame/Atlas';
import type { StructuresAtlas } from './Standing';

/** The settlements' atlas, which `world:structures` cuts beside the structures'. */
const IMAGE = '/art/settlements.webp';
/** How many pixels a world unit is drawn here. */
const UNIT = 7;

/** Made-up ground to lay one out on: land all round a village, and a shore across a fishing village's front. */
const LAND: FootingOf = () => 'land';
const SHORE: FootingOf = (u, v) => (u + v > 5 ? 'water' : 'land');

/**
 * Every settlement laid out as the map will lay it out - a village and a fishing village, a hamlet, a village and a
 * large village, in every culture - on made-up ground, its square's diamonds under it, its streets and green worn, and
 * its buildings from the settlements' atlas standing on their feet, the farthest first. What a change to the layout
 * looks like before any of it is on the map. See docs/plans/settlements-and-roads.md.
 */
export function SettlementLayouts() {
  const atlas = useAtlas<StructuresAtlas>('settlements');
  const [type, setType] = useState<SettlementType>('village');
  if (atlas === null || atlas === 'missing') return null;
  return (
    <section className="inspect-group" aria-label="settlements laid out">
      <h2 className="inspect-group__title">Settlements laid out</h2>
      <p className="inspect-note structures-levels">
        {(['village', 'fishingVillage'] as const).map((one) => (
          <button
            key={one}
            type="button"
            className="inspect-button"
            aria-pressed={one === type}
            onClick={() => setType(one)}
          >
            {one === 'village' ? 'village' : 'fishing village'}
          </button>
        ))}
      </p>
      <div className="inspect-scroll">
        <table className="inspect-table">
          <thead>
            <tr>
              <th>level</th>
              {CULTURES.map((culture) => (
                <th key={culture}>{culture}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map((level) => (
              <tr key={level}>
                <td>{['a hamlet', 'a village', 'a large village'][level - 1]}</td>
                {CULTURES.map((culture) => (
                  <td key={culture}>
                    <Laid atlas={atlas} type={type} level={level} culture={culture} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Laid({
  atlas,
  type,
  level,
  culture,
}: {
  atlas: StructuresAtlas;
  type: SettlementType;
  level: number;
  culture: Culture;
}) {
  const ground = type === 'fishingVillage' ? SHORE : LAND;
  const laid = settlementIn(`${type}-${culture}`, type, level, culture, 0, 0, ground);
  if (laid === 'unknown') return null;
  const { square } = laid;
  const diamonds: { u: number; v: number; kind: string }[] = [];
  for (let u = square.fromU - 2; u < square.fromU + square.side + 2; u += 1) {
    for (let v = square.fromV - 2; v < square.fromV + square.side + 2; v += 1) {
      const inside =
        u >= square.fromU &&
        u < square.fromU + square.side &&
        v >= square.fromV &&
        v < square.fromV + square.side;
      const kind =
        ground(u, v) === 'water' ? 'water' : onStreet(square, u, v) ? 'street' : inside ? 'square' : 'land';
      diamonds.push({ u, v, kind });
    }
  }
  const corners = (u: number, v: number) =>
    [onScreen(u + 1, v + 1), onScreen(u, v + 1), onScreen(u, v), onScreen(u + 1, v)]
      .map((p) => `${p.x},${p.y}`)
      .join(' ');
  const standing = [
    ...laid.jetties.map((jetty) => {
      const frame = atlas.frames[jettyKey(jetty.axis)];
      const at = onScreen(jetty.u, jetty.v);
      return { frame, at, footX: frame?.footX ?? 0.5, footY: frame?.footY ?? 0.5, low: true };
    }),
    ...laid.buildings.map((building) => {
      const frame = atlas.frames[settlementPieceKey(building.piece, building.culture)];
      const at = onScreen(building.u, building.v);
      return { frame, at, footX: frame?.footX ?? 0.5, footY: 1, low: building.piece === 'boat' };
    }),
  ].sort((a, b) => Number(b.low) - Number(a.low) || a.at.y - b.at.y);
  const all = diamonds.flatMap(({ u, v }) => [
    onScreen(u, v),
    onScreen(u + 1, v + 1),
    onScreen(u + 1, v),
    onScreen(u, v + 1),
  ]);
  const left = Math.min(...all.map((p) => p.x));
  const right = Math.max(...all.map((p) => p.x));
  const top = Math.min(...all.map((p) => p.y)) - 6;
  const bottom = Math.max(...all.map((p) => p.y));
  return (
    <svg
      className="structures-footing"
      role="img"
      aria-label={`${type} at level ${level} in ${culture}`}
      width={(right - left) * UNIT}
      height={(bottom - top) * UNIT}
      viewBox={`${left} ${top} ${right - left} ${bottom - top}`}
    >
      {diamonds.map(({ u, v, kind }) => (
        <polygon key={`${u}:${v}`} className={`settlements-ground is-${kind}`} points={corners(u, v)} />
      ))}
      {standing.map(({ frame, at, footX, footY }, index) => {
        if (frame === undefined) return null;
        const tall = frame.tall ?? 1;
        const wide = (tall * frame.width) / frame.height;
        return (
          <svg
            key={index}
            x={at.x - footX * wide}
            y={at.y - footY * tall}
            width={wide}
            height={tall}
            viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
            preserveAspectRatio="none"
          >
            <image href={`${IMAGE}?v=${atlas.version}`} width={atlas.width} height={atlas.height} />
          </svg>
        );
      })}
    </svg>
  );
}
