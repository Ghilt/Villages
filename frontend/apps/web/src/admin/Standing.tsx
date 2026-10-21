import { sceneryStore } from '../sprites/scenery/settings';

import { footingOf } from './footing';
import type { Atlas } from './frame/Atlas';
import type { StructureShadow } from '@villages/world';

/** How many pixels a world unit is drawn where a building stands on its footprint: a castle of eight is 72 tall. */
export const UNIT = 9;

/** An atlas of buildings, with the shadow `world:structures` cast for each building's picture. */
export type StructuresAtlas = Atlas & { readonly shadows?: Readonly<Record<string, StructureShadow>> };

/**
 * A building's picture standing on its footprint's diamonds, as the camera sees both closest in: the diamonds under it,
 * the shadow it casts on them as dark as the map draws it, and the square's outline drawn again over it, so its base
 * can be seen to lie in the square or not.
 */
export function Standing({
  atlas,
  at,
  name,
  height,
  side,
  image: href = '/art/structures.webp',
}: {
  atlas: StructuresAtlas | null;
  at: string;
  name: string;
  height: number;
  side: number;
  /** The atlas's picture: the structures' unless another is named. */
  image?: string;
}) {
  const frame = atlas?.frames[at];
  if (atlas === null || frame === undefined) return null;
  const { diamonds, outline, picture, box } = footingOf(
    height,
    frame.width / frame.height,
    frame.footX ?? 0.5,
    side,
  );
  // Cut at the picture's scale, its foot on the picture's: the foot is where the picture stands, the origin.
  const shadow = atlas.shadows?.[at];
  const scale = picture.height / frame.height;
  const cast =
    shadow === undefined
      ? null
      : {
          x: -shadow.footX * scale,
          y: -shadow.footY * scale,
          width: shadow.width * scale,
          height: shadow.height * scale,
        };
  const left = Math.min(box.x, cast?.x ?? box.x);
  const top = Math.min(box.y, cast?.y ?? box.y);
  const whole = {
    x: left,
    y: top,
    width: Math.max(box.x + box.width, cast === null ? 0 : cast.x + cast.width) - left,
    height: Math.max(box.y + box.height, cast === null ? 0 : cast.y + cast.height) - top,
  };
  const points = (corners: readonly { x: number; y: number }[]) =>
    corners.map((corner) => `${corner.x},${corner.y}`).join(' ');
  const pad = 0.5;
  const image = <image href={`${href}?v=${atlas.version}`} width={atlas.width} height={atlas.height} />;
  return (
    <svg
      className="structures-footing"
      role="img"
      aria-label={name}
      width={(whole.width + pad * 2) * UNIT}
      height={(whole.height + pad * 2) * UNIT}
      viewBox={`${whole.x - pad} ${whole.y - pad} ${whole.width + pad * 2} ${whole.height + pad * 2}`}
    >
      {diamonds.map((corners, index) => (
        <polygon key={index} className="structures-diamond" points={points(corners)} />
      ))}
      {shadow !== undefined && cast !== null && (
        <svg
          {...cast}
          viewBox={`${shadow.x} ${shadow.y} ${shadow.width} ${shadow.height}`}
          preserveAspectRatio="none"
          opacity={sceneryStore.get().shadows}
        >
          {image}
        </svg>
      )}
      <svg
        x={picture.x}
        y={picture.y}
        width={picture.width}
        height={picture.height}
        viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
        preserveAspectRatio="none"
      >
        {image}
      </svg>
      <polygon className="structures-outline" points={points(outline)} />
    </svg>
  );
}
