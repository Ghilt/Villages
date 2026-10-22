import type { ReactNode } from 'react';

import type { Size } from './dioramaFit';
import { latticeMatrix } from './lattice';
import type { ScreenLattice } from './lattice';

/**
 * A diorama's ground in the map's own lattice: a fill, whatever the venue lays on it, and the joints between its cells
 * over both, drawn as the map's ground is turned and the camera tips it, so the map's pictures stand square on it. `id`
 * names its pattern, unique on the page. See docs/UI-COMPONENTS.md and decision record 0116.
 */
export function LatticeGround({
  scene,
  lattice,
  id,
  fill,
  joint,
  children,
}: {
  scene: Size;
  lattice: ScreenLattice;
  id: string;
  /** What the cells are filled with, any SVG paint. */
  fill: string;
  /** The joints' colour. */
  joint: string;
  /** Laid on the fill and under the joints, in the scene's units: a worn patch, a pool of light. */
  children?: ReactNode;
}) {
  return (
    <svg
      viewBox={`0 0 ${scene.width} ${scene.height}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={id}
          width="1"
          height="1"
          patternUnits="userSpaceOnUse"
          patternTransform={latticeMatrix(lattice)}
        >
          <path d="M0 0 H1 V1" fill="none" stroke={joint} strokeWidth="0.06" />
        </pattern>
      </defs>
      <rect width={scene.width} height={scene.height} fill={fill} />
      {children}
      <rect width={scene.width} height={scene.height} fill={`url(#${id})`} />
    </svg>
  );
}
