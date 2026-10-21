import {
  BRIDGE_SPAN,
  BRIDGE_WAYS,
  CULTURES,
  JETTY_AXES,
  PIECE_SIDES,
  SETTLEMENT_PIECES,
  bridgeKey,
  jettyKey,
  settlementPieceKey,
} from '@villages/world';
import type { BridgeWay } from '@villages/world';

import { bridgeFootingOf } from './footing';
import { useAtlas } from './frame/Atlas';
import { Standing, UNIT } from './Standing';
import type { StructuresAtlas } from './Standing';

/** The settlements' atlas, which `world:structures` cuts beside the structures'. */
const IMAGE = '/art/settlements.webp';

/**
 * The pieces a settlement is laid out in and the bridges, as `world:structures` cut them from `world/sprites/settlements/`
 * and `world/sprites/bridges/`: every piece in every culture standing on its footprint's diamonds, as tall as the map
 * draws it, its shadow under it; each jetty and bridge lying over the diamonds of its axis, so a picture painted over
 * one can be seen to stand where its placeholder stood. A placeholder is ringed in dashes. See
 * docs/plans/settlements-and-roads.md.
 */
export function SettlementPieces() {
  const atlas = useAtlas<StructuresAtlas>('settlements');
  if (atlas === null) return null;
  if (atlas === 'missing') {
    return (
      <p className="inspect-quiet">
        the settlements' pieces are not cut in this tree yet: npm run world:structures --prefix frontend
      </p>
    );
  }
  const placeholder = (key: string) =>
    atlas.frames[key]?.placeholder === true ? 'structures-placeholder' : '';
  return (
    <section className="inspect-group" aria-label="settlement pieces and bridges">
      <h2 className="inspect-group__title">Settlements' pieces and bridges</h2>
      <p className="inspect-note">
        world/sprites/settlements/ and world/sprites/bridges/, cut to public/art/settlements.webp: each piece
        at its own size, a world unit {UNIT} pixels here
      </p>
      <div className="inspect-scroll">
        <table className="inspect-table">
          <thead>
            <tr>
              <th>piece</th>
              {CULTURES.map((culture) => (
                <th key={culture}>{culture}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SETTLEMENT_PIECES.map((piece) => (
              <tr key={piece}>
                <td>
                  {piece}, {PIECE_SIDES[piece]} a side
                </td>
                {CULTURES.map((culture) => {
                  const key = settlementPieceKey(piece, culture);
                  return (
                    <td key={culture} className={placeholder(key)}>
                      <Standing
                        atlas={atlas}
                        at={key}
                        name={`${piece}, ${culture}, on its footprint`}
                        height={atlas.frames[key]?.tall ?? 1}
                        side={PIECE_SIDES[piece]}
                        image={IMAGE}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="structures-lying">
        {JETTY_AXES.map((axis) => (
          <span key={axis} className={placeholder(jettyKey(axis))}>
            <Lying atlas={atlas} at={jettyKey(axis)} axis={axis} span={3.4} name={`jetty along ${axis}`} />
          </span>
        ))}
        {BRIDGE_WAYS.map((way) => (
          <span key={way} className={placeholder(bridgeKey(way))}>
            <Lying
              atlas={atlas}
              at={bridgeKey(way)}
              axis={way}
              span={BRIDGE_SPAN}
              name={`bridge along ${way}`}
            />
          </span>
        ))}
      </div>
    </section>
  );
}

/** A bridge or a jetty over the diamonds its deck lies along, standing on its middle, and its axis drawn over them. */
function Lying({
  atlas,
  at,
  axis,
  span,
  name,
}: {
  atlas: StructuresAtlas;
  at: string;
  axis: BridgeWay;
  span: number;
  name: string;
}) {
  const frame = atlas.frames[at];
  if (frame === undefined) return null;
  const { diamonds, outline, picture, box } = bridgeFootingOf(
    axis,
    span,
    frame.tall ?? 1,
    frame.width / frame.height,
    frame.footX ?? 0.5,
    frame.footY ?? 1,
  );
  const points = (corners: readonly { x: number; y: number }[]) =>
    corners.map((corner) => `${corner.x},${corner.y}`).join(' ');
  const pad = 0.5;
  return (
    <svg
      className="structures-footing"
      role="img"
      aria-label={name}
      width={(box.width + pad * 2) * UNIT}
      height={(box.height + pad * 2) * UNIT}
      viewBox={`${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`}
    >
      {diamonds.map((corners, index) => (
        <polygon key={index} className="structures-diamond" points={points(corners)} />
      ))}
      <svg
        x={picture.x}
        y={picture.y}
        width={picture.width}
        height={picture.height}
        viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
        preserveAspectRatio="none"
      >
        <image href={`${IMAGE}?v=${atlas.version}`} width={atlas.width} height={atlas.height} />
      </svg>
      <polyline className="structures-outline" points={points(outline)} />
    </svg>
  );
}
