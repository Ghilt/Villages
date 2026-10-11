import { INK, hexOf as hex, pictureFor, styled } from '@villages/world';
import type { Culture } from '@villages/world';

/**
 * A structure's placeholder picture, drawn in SVG from the same shapes the map draws in Pixi: what a row of the
 * holdings leads with, in the look of the culture it is built in. The pictures painted for each type and culture
 * replace both when they come (step 13 of the plan).
 */
export function StructureFigure({
  type,
  ruin = false,
  culture = null,
  size = 36,
}: {
  type: string;
  ruin?: boolean;
  /** The culture it is built in, whose look it is drawn in; European with none. */
  culture?: Culture | null;
  size?: number;
}) {
  const stroke = { stroke: hex(INK), strokeWidth: 2, strokeLinejoin: 'round' as const };
  return (
    <svg className="holdings__figure" viewBox="-10 -16 120 120" width={size} height={size} aria-hidden="true">
      {styled(pictureFor(type, ruin), culture ?? 'european').parts.map((part, at) => {
        if (part[0] === 'rect') {
          const [, x, y, width, height, colour] = part;
          return <rect key={at} x={x} y={y} width={width} height={height} fill={hex(colour)} {...stroke} />;
        }
        if (part[0] === 'poly') {
          const points = part[1]
            .map((value, index) => (index % 2 === 0 ? `${value},` : `${value} `))
            .join('');
          return <polygon key={at} points={points.trim()} fill={hex(part[2])} {...stroke} />;
        }
        const [, cx, cy, r, colour] = part;
        return <circle key={at} cx={cx} cy={cy} r={r} fill={hex(colour)} {...stroke} />;
      })}
    </svg>
  );
}
