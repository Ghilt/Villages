import { INK, pictureOf } from '../sprites/structureShapes';

/** A colour of the shapes' table, as CSS writes it. */
const hex = (colour: number): string => `#${colour.toString(16).padStart(6, '0')}`;

/**
 * A structure's placeholder picture, drawn in SVG from the same shapes the map draws in Pixi: what a row of the
 * holdings leads with. The pictures cut from the moodboard replace both when they come (step 13 of the plan).
 */
export function StructureFigure({ type, size = 36 }: { type: string; size?: number }) {
  const stroke = { stroke: hex(INK), strokeWidth: 2, strokeLinejoin: 'round' as const };
  return (
    <svg className="holdings__figure" viewBox="-3 -3 106 106" width={size} height={size} aria-hidden="true">
      {pictureOf(type).parts.map((part, at) => {
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
