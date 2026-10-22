import type { ReactNode } from 'react';

import type { Placed } from '../../ui/diorama/Diorama';
import type { ScreenLattice } from '../../ui/diorama/lattice';
import type { Point } from './venue';

/** The faces of a block a venue stands on its lattice, light to dark: its top, its front left and its front right. */
export interface Faces {
  readonly top: string;
  readonly left: string;
  readonly right: string;
}

const INK = '#2b1d10';

const spot = (lattice: ScreenLattice, u: number, v: number, up: number): Point => ({
  x: u * lattice.u.x + v * lattice.v.x,
  y: u * lattice.u.y + v * lattice.v.y - up,
});

const pointsOf = (points: readonly Point[], left: number, top: number) =>
  points.map((point) => `${point.x - left},${point.y - top}`).join(' ');

/**
 * A block standing on a venue's lattice - a platform, a plinth - `cells` a side and `lift` of the scene's units tall,
 * its middle on the ground at `middle`: its top and the two sides of it facing us, drawn as the map's ground is turned,
 * so it stands square on the cobbles. `on` is drawn on its top, its middle at the top's. Placed so whatever stands on
 * its top is in front of it.
 */
export function blockPlaced(
  id: string,
  lattice: ScreenLattice,
  middle: Point,
  cells: number,
  lift: number,
  faces: Faces,
  on?: ReactNode,
): Placed {
  const h = cells / 2;
  const front = spot(lattice, h, h, 0);
  const left = spot(lattice, -h, h, 0);
  const right = spot(lattice, h, -h, 0);
  const up = (point: Point) => ({ x: point.x, y: point.y - lift });
  const top = [up(front), up(left), spot(lattice, -h, -h, lift), up(right)];
  const xs = [left.x, right.x];
  const box = { left: Math.min(...xs), top: Math.min(...top.map((point) => point.y)) };
  const width = Math.max(...xs) - box.left;
  const height = front.y - box.top;
  return {
    id,
    x: middle.x + box.left + width / 2,
    y: middle.y + front.y,
    depth: middle.y - lift - 1,
    node: (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <polygon
          points={pointsOf([left, front, up(front), up(left)], box.left, box.top)}
          fill={faces.left}
          stroke={INK}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <polygon
          points={pointsOf([front, right, up(right), up(front)], box.left, box.top)}
          fill={faces.right}
          stroke={INK}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <polygon
          points={pointsOf(top, box.left, box.top)}
          fill={faces.top}
          stroke={INK}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {on !== undefined && <g transform={`translate(${-box.left} ${-lift - box.top})`}>{on}</g>}
      </svg>
    ),
  };
}

/** The square's speakers' platforms: oak, three cells a side and a world unit and a quarter tall. */
export const PLATFORM = {
  cells: 3,
  lift: 1.25,
  faces: { top: '#a7835a', left: '#6f5236', right: '#8a6a46' },
};

/** The plinth the square's font stands on: stone, four cells a side and a little over a third of a world unit tall. */
export const FONT = { cells: 4, lift: 0.35, faces: { top: '#b3a892', left: '#857a68', right: '#9a8f7c' } };

/** How far above the ground the water in the font is, in world units: where a seal comes to rest. */
export const WATER = FONT.lift + 0.6;

/**
 * The square's font, a stand-in until it is painted: a stone basin of water on a plinth four cells a side. Drawn about
 * its middle, in the scene's units; `cell` is a world unit's.
 */
export function FontBasin({ cell }: { cell: number }) {
  const rx = 1.55 * cell;
  const ry = rx * Math.SQRT1_2;
  const deep = (WATER - FONT.lift) * cell;
  return (
    <g>
      <path
        d={`M${-rx} ${-deep} L${-rx} 0 A${rx} ${ry} 0 0 0 ${rx} 0 L${rx} ${-deep} A${rx} ${ry} 0 0 1 ${-rx} ${-deep} Z`}
        fill="#a39885"
        stroke={INK}
        strokeWidth="1.5"
      />
      <ellipse cx="0" cy={-deep} rx={rx} ry={ry} fill="#c4b9a3" stroke={INK} strokeWidth="1.5" />
      <ellipse cx="0" cy={-deep} rx={rx * 0.74} ry={ry * 0.74} fill="#6f7f86" stroke={INK} strokeWidth="1" />
    </g>
  );
}
